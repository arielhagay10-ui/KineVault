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
  const slug = `original-cable-raise-${suffix}`;
  await page.getByLabel("Public URL slug").fill(slug);
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByRole("link", { name: "View exercise", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "View exercise", exact: true }).click();
  await expect(page.locator("video")).toBeVisible();
  await expect.poll(() => page.locator("video").evaluate((video: HTMLVideoElement) => video.readyState)).toBeGreaterThanOrEqual(2);
  const { data: signed, error: signError } = await visitor.storage.from("exercise-public").createSignedUrl(`submissions/${submissionId}/demo.mp4`, 60);
  expect(signError).toBeNull();
  const response = await page.request.get(signed!.signedUrl);
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain("video/mp4");
  const raw = await page.request.get(`${url}/storage/v1/object/public/exercise-public/submissions/${submissionId}/demo.mp4`);
  expect(raw.ok()).toBeFalsy();
});
