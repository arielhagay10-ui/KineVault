import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { z } from "zod";

const run = promisify(execFile);

test("real motion renders stay private until approval and play publicly afterward", async ({ page }) => {
  test.setTimeout(240_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname)) throw new Error("Media fixtures require local Supabase");
  const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const owner = createClient(url, publicKey, { auth: { persistSession: false } });
  const visitor = createClient(url, publicKey, { auth: { persistSession: false } });
  const suffix = Date.now();
  const email = `media-review-${suffix}@example.test`;
  const password = "LocalMediaTestPass2026!";
  const { data: account, error: accountError } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (accountError) throw accountError;
  const userId = z.uuid().parse(account.user!.id);
  execFileSync("docker", ["exec", "supabase_db_kinevault", "psql", "-U", "postgres", "-d", "postgres", "-c",
    `update public.roles set role = 'reviewer' where user_id = '${userId}';`], { stdio: "pipe" });
  await owner.auth.signInWithPassword({ email, password });
  const { data: privateId, error: saveError } = await owner.rpc("save_private_exercise", {
    p_name: `Original Cable Raise ${suffix}`, p_family_slug: "lateral-raise",
    p_primary_muscle_slugs: ["lateral-deltoid"], p_joint_action_slugs: ["shoulder-abduction"], p_equipment_slugs: ["cable"],
  });
  if (saveError) throw saveError;
  const { error: sceneError } = await owner.rpc("save_private_scene", { p_private_id: privateId, p_scene: {
    durationMs: 500, cameraAngle: "front", equipment: null,
    keyframes: [{ timeMs: 0, poses: { "left-shoulder": { z: 0 } } }, { timeMs: 500, poses: { "left-shoulder": { z: -70 } } }],
    annotations: [{ startMs: 0, endMs: 500, label: "Raise", note: "Move the upper arm away from the torso.", jointAction: "shoulder-abduction" }],
  } });
  if (sceneError) throw sceneError;
  const { data: submissionId, error: submitError } = await owner.rpc("submit_private_exercise", { p_private_id: privateId, p_duplicate_disposition: "new" });
  if (submitError) throw submitError;
  const { data: submission } = await owner.from("exercise_submissions").select("original_content_id").eq("id", submissionId).single();
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data: media } = await owner.from("exercise_media").select("kind,storage_path").eq("content_id", submission!.original_content_id);
    if (media?.length === 3) break;
    await run(process.execPath, ["scripts/render-worker.mjs", "--once"], { timeout: 90_000 });
  }
  const { data: privateMedia } = await owner.from("exercise_media").select("storage_path").eq("content_id", submission!.original_content_id);
  expect(privateMedia).toHaveLength(3);
  const { data: hidden } = await visitor.storage.from("exercise-private").createSignedUrl(privateMedia![0].storage_path, 60);
  expect(hidden).toBeNull();

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto(`/admin/submissions/${submissionId}`);
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByRole("heading", { name: "Correct classifications" })).toBeVisible();
  await page.getByRole("textbox", { name: "Label", exact: true }).fill("Reviewed raise");
  await page.getByLabel("Reason for note corrections").fill("Clarify the reviewed phase label.");
  await page.getByRole("button", { name: "Save movement notes" }).click();
  await expect(page.getByText("Movement notes saved in the review history.")).toBeVisible();
  const slug = `original-cable-raise-${suffix}`;
  await page.getByLabel("Public URL slug").fill(slug);
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByRole("link", { name: "View exercise", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "View exercise", exact: true }).click();
  await expect(page.locator("video")).toBeVisible();
  await page.getByRole("button", { name: "Save favorite", exact: true }).click();
  await expect(page.getByRole("button", { name: "Saved", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Saved", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save favorite", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => page.locator("video").evaluate((video: HTMLVideoElement) => video.readyState)).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole("button", { name: "Reviewed raise", exact: true })).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => page.locator("video").evaluate((video: HTMLVideoElement) => video.paused)).toBeTruthy();
  const { data: signed, error: signError } = await visitor.storage.from("exercise-public").createSignedUrl(`submissions/${submissionId}/demo.mp4`, 60);
  expect(signError).toBeNull();
  const response = await page.request.get(signed!.signedUrl);
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain("video/mp4");
  const raw = await page.request.get(`${url}/storage/v1/object/public/exercise-public/submissions/${submissionId}/demo.mp4`);
  expect(raw.ok()).toBeFalsy();

  const { data: published } = await owner.from("exercises").select("id").eq("slug", slug).single();
  await page.goto(`/admin/exercises/${published!.id}/edit`);
  await page.getByLabel("Reviewer notes").fill("Reviewed geometry determines resistance; no automatic inference from animation.");
  await page.getByLabel("Reason for corrections").fill("Explain the external resistance uncertainty.");
  await page.getByRole("button", { name: "Save corrections" }).click();
  await expect(page.getByText("A new reviewed version was published. Earlier versions are preserved.")).toBeVisible();
  await expect(page.getByText("Version 2", { exact: false })).toBeVisible();

  // A second real render supplies an excluded control for the required Explore flow.
  const { data: curlId, error: curlError } = await owner.rpc("save_private_exercise", {
    p_name: `Excluded Dumbbell Curl ${suffix}`, p_family_slug: "curl", p_primary_muscle_slugs: ["biceps-brachii"],
    p_joint_action_slugs: ["elbow-flexion"], p_equipment_slugs: ["dumbbell"],
  });
  if (curlError) throw curlError;
  const { error: curlSceneError } = await owner.rpc("save_private_scene", { p_private_id: curlId, p_scene: {
    durationMs: 500, cameraAngle: "side", equipment: null,
    keyframes: [{ timeMs: 0, poses: { "left-elbow": { x: 0 } } }, { timeMs: 500, poses: { "left-elbow": { x: 90 } } }],
  } });
  if (curlSceneError) throw curlSceneError;
  const { data: curlSubmission, error: curlSubmitError } = await owner.rpc("submit_private_exercise", { p_private_id: curlId, p_duplicate_disposition: "new" });
  if (curlSubmitError) throw curlSubmitError;
  const { data: curlSnapshot } = await owner.from("exercise_submissions").select("original_content_id").eq("id", curlSubmission).single();
  await run(process.execPath, ["scripts/render-worker.mjs", "--once"], { timeout: 90_000 });
  const { data: curlMedia } = await owner.from("exercise_media").select("kind,storage_path").eq("content_id", curlSnapshot!.original_content_id);
  expect(curlMedia).toHaveLength(3);
  for (const asset of curlMedia!) {
    const { error: copyError } = await service.storage.from("exercise-private").copy(asset.storage_path,
      `submissions/${curlSubmission}/demo.${asset.kind === "poster" ? "webp" : asset.kind}`, { destinationBucket: "exercise-public" });
    if (copyError) throw copyError;
  }
  const { error: beginError } = await owner.rpc("begin_submission_review", { p_submission_id: curlSubmission });
  if (beginError) throw beginError;
  const { error: approveError } = await owner.rpc("approve_submission", { p_submission_id: curlSubmission, p_slug: `excluded-curl-${suffix}` });
  if (approveError) throw approveError;
  await page.goto("/exercises");
  await page.getByRole("checkbox", { name: "Shoulder Abduction", exact: true }).check();
  await page.locator('details').filter({ has: page.locator('summary').filter({ hasText: /^Equipment$/ }) }).locator("summary").click();
  await page.locator('input[name="equipment"][value="cable"]').check();
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/jointAction=shoulder-abduction/);
  await expect(page).toHaveURL(/equipment=cable/);
  const results = page.getByRole("region", { name: "Search results" });
  await expect(results.getByRole("link", { name: new RegExp(`Original Cable Raise ${suffix}`) })).toBeVisible();
  await expect(results.getByRole("link", { name: new RegExp(`Excluded Dumbbell Curl ${suffix}`) })).toHaveCount(0);
  await results.getByRole("link", { name: new RegExp(`Original Cable Raise ${suffix}`) }).click();
  await expect(page.getByRole("link", { name: "Shoulder Abduction", exact: true })).toBeVisible();
  await expect(page.getByText("Reviewed geometry determines resistance; no automatic inference from animation.")).toBeVisible();
  await page.route("**/demo.webm*", (route) => route.abort());
  await page.reload();
  await expect.poll(() => page.locator("video").evaluate((video: HTMLVideoElement) => video.readyState)).toBeGreaterThanOrEqual(2);
  await expect.poll(() => page.locator("video").evaluate((video: HTMLVideoElement) => video.currentSrc.includes("demo.mp4"))).toBeTruthy();
  await page.locator("video").screenshot({ path: "test-results/published-demo.png" });
});
