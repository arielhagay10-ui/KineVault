import { execFile, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { z } from "zod";
import type { Database } from "../../src/lib/database.types";
import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { dismissWorkshopTutorial, jointField, openWorkshopTool, selectWorkshopJoint, selectWorkshopMoment } from "../e2e/workshop-menu.helpers";

const run = promisify(execFile);

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });

test("a workshop UI recording survives review and plays with the original anatomy", async ({ page }) => {
  test.setTimeout(300_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname)) throw new Error("Media fixtures require local Supabase");
  const service = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const owner = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const suffix = randomUUID();
  const email = `workshop-publication-${suffix}@example.test`;
  const password = "WorkshopPublication2026!";
  const name = `Workshop Elbow Motion ${suffix}`;
  const slug = `workshop-elbow-motion-${suffix}`;
  const { data: account, error: accountError } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (accountError) throw accountError;
  const userId = z.uuid().parse(account.user!.id);

  try {
    execFileSync("docker", ["exec", "supabase_db_kinevault", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c",
      `update public.roles set role = 'reviewer' where user_id = '${userId}';`], { stdio: "pipe" });
    const signedIn = await owner.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw signedIn.error;
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/my-exercises/new");
    await dismissWorkshopTutorial(page);
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible();
    await openWorkshopTool(page, "Timeline");
    const duration = page.getByRole("textbox", { name: "Time to finish seconds", exact: true });
    await duration.fill("0.5");
    await duration.press("Enter");
    await selectWorkshopJoint(page, "Left elbow");
    await jointField(page, "x").fill("20");
    await jointField(page, "x").press("Enter");
    await page.getByRole("button", { name: "Capture start", exact: true }).click();
    await selectWorkshopMoment(page, "Finish");
    await selectWorkshopJoint(page, "Left elbow");
    await jointField(page, "x").fill("95");
    await jointField(page, "x").press("Enter");
    await page.getByRole("button", { name: "Capture pose", exact: true }).click();
    await selectWorkshopMoment(page, "Start");
    await expect(jointField(page, "x")).toHaveValue("20");
    await selectWorkshopMoment(page, "Finish");
    await expect(jointField(page, "x")).toHaveValue("95");

    await page.getByLabel("Exercise name", { exact: true }).fill(" ");
    await page.getByRole("button", { name: "Save exercise", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Name your exercise", exact: true });
    await dialog.getByRole("textbox", { name: "Exercise name", exact: true }).fill(name);
    await dialog.getByRole("button", { name: "Save exercise", exact: true }).click();
    await expect(page.getByText(/Saved at.*Private/)).toBeVisible();
    const { data: drafts, error: draftsError } = await owner.from("private_exercises")
      .select("id,content_id,exercise_content(name)").eq("owner_id", userId);
    if (draftsError) throw draftsError;
    const draft = (drafts ?? []).find((item) => item.exercise_content?.name === name);
    expect(draft).toBeDefined();
    const privateId = draft!.id;

    await page.goto(`/my-exercises/${privateId}/workshop`);
    await dismissWorkshopTutorial(page);
    await selectWorkshopJoint(page, "Left elbow");
    await selectWorkshopMoment(page, "Start");
    await expect(jointField(page, "x")).toHaveValue("20");
    await selectWorkshopMoment(page, "Finish");
    await expect(jointField(page, "x")).toHaveValue("95");

    const readScene = async (contentId: string) => {
      const { data: scene, error: sceneError } = await owner.from("exercise_scenes")
        .select("id,duration_ms,default_camera_angle,motion_style,studio_layout,motion_source_submission_id")
        .eq("content_id", contentId).single();
      if (sceneError) throw sceneError;
      const { data: frames, error: frameError } = await owner.from("motion_keyframes")
        .select("position_ms,motion_joint_poses(rig_joint_id,rotation_x,rotation_y,rotation_z,rotation_w)")
        .eq("scene_id", scene.id).order("position_ms");
      if (frameError) throw frameError;
      return { scene, frames: frames.map((frame) => ({
        timeMs: frame.position_ms,
        poses: frame.motion_joint_poses
          .map(({ rig_joint_id, rotation_x, rotation_y, rotation_z, rotation_w }) =>
            ({ rig_joint_id, rotation_x, rotation_y, rotation_z, rotation_w }))
          .sort((left, right) => left.rig_joint_id.localeCompare(right.rig_joint_id)),
      })) };
    };
    const source = await readScene(draft!.content_id);
    expect(source.frames.length).toBeGreaterThanOrEqual(2);
    // A looping recording returns to its start pose in the final frame.
    expect(new Set(source.frames.map(frame => JSON.stringify(frame.poses))).size).toBeGreaterThan(1);
    const { error: metadataError } = await owner.rpc("save_private_metadata", { p_private_id: privateId, p_patch: {
      name, family: "curl", muscles: [{ slug: "biceps-brachii", role: "primary" }],
      joint_actions: [{ slug: "elbow-flexion", role: "primary" }],
    } });
    if (metadataError) throw metadataError;
    const { data: submissionId, error: submitError } = await owner.rpc("submit_private_exercise", {
      p_private_id: privateId, p_duplicate_disposition: "new",
    });
    if (submitError) throw submitError;
    const { data: submission, error: submissionError } = await owner.from("exercise_submissions")
      .select("original_content_id").eq("id", submissionId).single();
    if (submissionError) throw submissionError;
    const frozen = await readScene(submission.original_content_id);
    expect(frozen.scene.id).not.toBe(source.scene.id);
    expect(frozen.frames).toEqual(source.frames);
    expect(frozen.scene.studio_layout).toEqual(source.scene.studio_layout);

    // Move only this fixture ahead of existing development jobs.
    const contentId = z.uuid().parse(submission.original_content_id);
    execFileSync("docker", ["exec", "supabase_db_kinevault", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c",
      `update public.render_jobs job set queued_at = '1970-01-01' where job.status = 'queued' and job.scene_id in (select id from public.exercise_scenes where content_id = '${contentId}');`], { stdio: "pipe" });
    for (let attempt = 0; attempt < 8; attempt++) {
      const { data: media } = await owner.from("exercise_media").select("kind").eq("content_id", contentId);
      if (media?.length === 3) break;
      await run(process.execPath, ["scripts/render-worker.mjs", "--once"], { timeout: 90_000 });
    }
    const { data: rendered, error: renderError } = await owner.from("exercise_media")
      .select("kind,scene_id,storage_path,license_name,source_credit").eq("content_id", contentId);
    if (renderError) throw renderError;
    expect(new Set(rendered.map((item) => item.kind))).toEqual(new Set(["webm", "mp4", "poster"]));
    expect(rendered.every((item) => item.scene_id === frozen.scene.id && item.license_name === "CC BY-SA 4.0" && /Z-Anatomy.*BodyParts3D/.test(item.source_credit ?? ""))).toBe(true);

    for (const asset of rendered) {
      const destination = `submissions/${submissionId}/demo.${asset.kind === "poster" ? "webp" : asset.kind}`;
      const { error } = await service.storage.from("exercise-private").copy(asset.storage_path, destination,
        { destinationBucket: "exercise-public" });
      if (error) throw error;
    }
    const { error: reviewError } = await owner.rpc("begin_submission_review", { p_submission_id: submissionId });
    if (reviewError) throw reviewError;
    const { error: approvalError } = await owner.rpc("approve_submission", { p_submission_id: submissionId, p_slug: slug });
    if (approvalError) throw approvalError;
    const { data: published, error: publishedError } = await owner.from("exercises")
      .select("current_content_id,status").eq("slug", slug).single();
    if (publishedError) throw publishedError;
    expect(published.status).toBe("published");
    const publicScene = await readScene(published.current_content_id);
    expect(publicScene.scene.id).not.toBe(frozen.scene.id);
    expect(publicScene.scene.motion_source_submission_id).toBe(submissionId);
    expect(publicScene.frames).toEqual(source.frames);
    const { data: publicMedia, error: publicMediaError } = await owner.from("exercise_media")
      .select("kind,scene_id,storage_bucket,license_name,source_credit").eq("content_id", published.current_content_id);
    if (publicMediaError) throw publicMediaError;
    expect(new Set(publicMedia.map((item) => item.kind))).toEqual(new Set(["webm", "mp4", "poster"]));
    expect(publicMedia.every((item) => item.scene_id === publicScene.scene.id
      && item.storage_bucket === "exercise-public" && item.license_name === "CC BY-SA 4.0" && /Z-Anatomy.*BodyParts3D/.test(item.source_credit ?? ""))).toBe(true);

    await page.goto(`/exercises/${slug}`);
    const video = page.locator('video[aria-label="Exercise motion demonstration"]');
    await expect(video).toBeVisible();
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState)).toBeGreaterThanOrEqual(2);
    await expect.poll(() => video.evaluate((element: HTMLVideoElement, id) => element.currentSrc.includes(`submissions/${id}`), submissionId)).toBe(true);
    await page.getByRole("button", { name: "Inspect motion in 3D", exact: true }).click();
    const anatomy = page.locator('#motion-inspection [data-anatomy-state="ready"]');
    await expect(anatomy).toBeVisible();
    await expect(anatomy).toHaveAttribute("data-anatomy-model", /\/models\/z-anatomy\/model\.meshopt\..*\.glb$/);
  } finally {
    try {
      execFileSync("docker", ["exec", "supabase_db_kinevault", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c",
        `update public.exercises set status = 'withdrawn' where created_by = '${userId}' and status = 'published';`], { stdio: "pipe" });
    } finally {
      await cleanupLocalFixture({ admin: service, userId, email, password, owner });
    }
  }
});
