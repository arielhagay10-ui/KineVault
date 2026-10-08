import { execFile, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { z } from "zod";
import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { auditAccessibility, setAppearance } from "./accessibility.helpers";

const run = promisify(execFile);
const localHosts = ["localhost", "127.0.0.1", "[::1]"];

async function expectDecodedMedia(page: Page, testInfo: TestInfo, browserName: "chromium" | "firefox" | "webkit") {
  if (process.platform === "win32" && browserName === "webkit") {
    // Independent valid MP4/WebM probes fail with MEDIA_ERR_SRC_NOT_SUPPORTED
    // in this Windows runtime. Keep transport and accessibility coverage;
    // playback remains explicitly unverified until a macOS/Safari run.
    const sources = await page.locator("video source").evaluateAll(elements => elements.map(element => ({ src: (element as HTMLSourceElement).src, type: (element as HTMLSourceElement).type })));
    expect(sources.map(source => source.type).sort()).toEqual(["video/mp4", "video/webm"]);
    for (const source of sources) {
      const response = await page.request.get(source.src);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain(source.type);
      expect((await response.body()).length).toBeGreaterThan(0);
    }
    testInfo.annotations.push({ type: "unverified-media-playback", description: "Windows WebKit rejected independent valid MP4/WebM decoder probes; signed transport and accessibility are checked." });
    await testInfo.attach(`signed-media-transport-${testInfo.annotations.length}`, { body: JSON.stringify({ formats: sources.map(source => source.type), signedTransport: "passed", playback: "unverified", reason: "Windows WebKit decoder limitation" }), contentType: "application/json" });
    return;
  }
  // Decode checks are separate from the native touch/keyboard interaction suite.
  await page.locator("video").evaluate((video: HTMLVideoElement) => { void video.play().catch(() => {}); });
  await expect.poll(() => page.locator("video").evaluate((video: HTMLVideoElement) => ({
    ready: video.readyState >= 2, error: video.error?.code ?? null, network: video.networkState,
    sources: Array.from(video.querySelectorAll("source")).map(source => ({
      type: source.type, supported: video.canPlayType(source.type), path: new URL(source.src).pathname,
    })),
  }))).toMatchObject({ ready: true, error: null });
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("populated submission, review, history and signed media expose accessible controls", async ({ page, browser, browserName, baseURL }, testInfo) => {
  test.setTimeout(300_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !baseURL || !localHosts.includes(new URL(url).hostname) || !localHosts.includes(new URL(baseURL).hostname)) {
    throw new Error("Moderation readiness fixtures require local app and Supabase URLs");
  }
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const suffix = randomUUID();
  const password = `Readiness-${randomUUID()}!`;
  const accounts: { userId: string; email: string }[] = [];
  const ownerContext = await browser.newContext({ viewport: page.viewportSize(), hasTouch: testInfo.project.use.hasTouch });
  const ownerPage = await ownerContext.newPage();
  const sql = (statement: string) => execFileSync("docker", ["exec", "supabase_db_kinevault", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", statement], { stdio: "pipe" });
  try {
    for (const role of ["owner", "reviewer"]) {
      const email = `accessibility-${role}-${suffix}@example.test`;
      const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (account.error) throw account.error;
      accounts.push({ userId: z.uuid().parse(account.data.user.id), email });
    }
    sql(`begin; select set_config('app.audit_comment', 'Temporary accessibility fixture reviewer', true); update public.roles set role = 'reviewer' where user_id = '${accounts[1].userId}'; commit;`);
    const auth = await owner.auth.signInWithPassword({ email: accounts[0].email, password });
    if (auth.error) throw auth.error;
    await signIn(ownerPage, accounts[0].email, password);
    await signIn(page, accounts[1].email, password);

    const scanThemes = async (target: Page, label: string) => {
      for (const theme of ["light", "dark"] as const) {
        await setAppearance(target, theme);
        await auditAccessibility(target, testInfo, `${theme}-${label}`);
      }
    };
    const createSubmission = async (name: string, render: boolean) => {
      const draft = await owner.rpc("save_private_exercise", { p_name: name, p_family_slug: "lateral-raise",
        p_primary_muscle_slugs: ["lateral-deltoid"], p_joint_action_slugs: ["shoulder-abduction"], p_equipment_slugs: ["cable"] });
      if (draft.error) throw draft.error;
      const scene = await owner.rpc("save_private_scene", { p_private_id: draft.data, p_scene: {
        durationMs: 500, cameraAngle: "front", equipment: { slug: "single-cable", x: 0, y: 0, z: 0, scale: 1 },
        keyframes: [{ timeMs: 0, poses: { "left-shoulder": { z: 0 } } }, { timeMs: 500, poses: { "left-shoulder": { z: -70 } } }],
        annotations: [{ startMs: 0, endMs: 500, label: "Raise", note: "Move the upper arm away from the torso.", jointAction: "shoulder-abduction" }],
      } });
      if (scene.error) throw scene.error;
      await ownerPage.goto(`/my-exercises/${draft.data}/submit`);
      await expect(ownerPage.getByRole("button", { name: "Submit for review", exact: true })).toBeVisible();
      await scanThemes(ownerPage, `${render ? "media" : "changes"}-submission-form`);
      const submission = await owner.rpc("submit_private_exercise", { p_private_id: draft.data, p_duplicate_disposition: "new" });
      if (submission.error) throw submission.error;
      if (render) {
        const snapshot = await owner.from("exercise_submissions").select("original_content_id").eq("id", submission.data).single();
        if (snapshot.error) throw snapshot.error;
        const contentId = z.uuid().parse(snapshot.data.original_content_id);
        sql(`update public.render_jobs job set queued_at = '1970-01-01' where job.status = 'queued' and job.scene_id in (select id from public.exercise_scenes where content_id = '${contentId}');`);
        await run(process.execPath, ["scripts/render-worker.mjs", "--once"], { timeout: 90_000, env: { ...process.env, RENDER_APP_URL: baseURL } });
        const media = await owner.from("exercise_media").select("kind").eq("content_id", contentId);
        if (media.error) throw media.error;
        expect(media.data.map(asset => asset.kind).sort()).toEqual(["mp4", "poster", "webm"]);
      }
      return submission.data;
    };
    const mediaSubmission = await createSubmission(`Accessible Cable Raise ${suffix}`, true);
    await page.goto(`/admin/submissions/${mediaSubmission}`, { waitUntil: "domcontentloaded" });
    await page.locator("video").click();
    await expectDecodedMedia(page, testInfo, browserName);
    await scanThemes(page, "submitted-review-signed-media");
    await page.getByRole("button", { name: "Record decision", exact: true }).click();
    const editor = page.getByRole("heading", { name: "Correct classifications" }).locator("..");
    await expect(editor).toBeVisible();
    await scanThemes(page, "active-review-editor");
    await editor.getByLabel("Name", { exact: true }).fill(`Reviewed Cable Raise ${suffix}`);
    await editor.getByLabel("Reviewer notes", { exact: true }).fill("Inspect cable geometry before classifying resistance.");
    await editor.getByLabel("Reason for corrections", { exact: true }).fill("Clarify the reviewed name and classification uncertainty.");
    await editor.getByRole("button", { name: "Save corrections", exact: true }).click();
    await expect(page.getByText("Corrections saved in the review history.")).toBeVisible();
    await page.getByRole("textbox", { name: "Label", exact: true }).fill("Reviewed raise");
    await page.getByLabel("Reason for note corrections", { exact: true }).fill("Clarify the movement annotation.");
    await page.getByRole("button", { name: "Save movement notes", exact: true }).click();
    await expect(page.getByText("Movement notes saved in the review history.")).toBeVisible();
    await scanThemes(page, "review-corrections-history");
    await page.getByLabel("Public URL slug", { exact: true }).fill(`accessible-raise-${suffix}`);
    await page.getByRole("button", { name: "Record decision", exact: true }).click();
    await expect(page.getByRole("link", { name: "View exercise", exact: true })).toBeVisible();
    await scanThemes(page, "approved-review-history");
    await page.getByRole("link", { name: "View exercise", exact: true }).click({ noWaitAfter: true });
    await expect(page).toHaveURL(/\/exercises\/accessible-raise-/);
    await expect(page.locator("video")).toBeVisible();
    await expectDecodedMedia(page, testInfo, browserName);
    await expect(page.getByRole("button", { name: "Reviewed raise", exact: true })).toBeVisible();
    await scanThemes(page, "public-signed-media");
    await ownerPage.goto(`/submissions/${mediaSubmission}`, { waitUntil: "domcontentloaded" });
    await expect(ownerPage.locator("ins").filter({ hasText: `Reviewed Cable Raise ${suffix}` })).toBeVisible();
    await scanThemes(ownerPage, "contributor-approved-diff");

    const changesSubmission = await createSubmission(`Accessible Change Request ${suffix}`, false);
    await page.goto(`/admin/submissions/${changesSubmission}`);
    await page.getByRole("button", { name: "Record decision", exact: true }).click();
    await page.getByRole("combobox", { name: "Decision", exact: true }).selectOption("request_changes");
    await page.getByRole("combobox", { name: "Reason", exact: true }).selectOption("poor_media");
    await page.getByLabel("Review comment", { exact: true }).fill("Please show the full movement from the side.");
    await page.getByRole("button", { name: "Record decision", exact: true }).click();
    await expect(page.getByText("This review is changes requested.")).toBeVisible();
    await scanThemes(page, "requested-changes-review");
    await ownerPage.goto(`/submissions/${changesSubmission}`);
    await expect(ownerPage.getByText("Please show the full movement from the side.")).toBeVisible();
    await scanThemes(ownerPage, "contributor-requested-changes");
    await ownerPage.goto("/notifications");
    await expect(ownerPage.getByText("Please show the full movement from the side.")).toBeVisible();
    await scanThemes(ownerPage, "populated-notifications");
  } finally {
    const errors: unknown[] = [];
    try { await ownerContext.close(); } catch (error) { errors.push(error); }
    // Withdraw only this fixture's public record; retain immutable review history.
    if (accounts[0]) {
      try { sql(`update public.exercises set status = 'withdrawn' where created_by = '${accounts[0].userId}' and status = 'published';`); }
      catch (error) { errors.push(error); }
    }
    const cleanup = await Promise.allSettled(accounts.map(account => cleanupLocalFixture({ admin, ...account, password })));
    errors.push(...cleanup.filter(result => result.status === "rejected").map(result => result.reason));
    if (errors.length) throw new AggregateError(errors, "Accessibility fixture cleanup failed");
  }
});
