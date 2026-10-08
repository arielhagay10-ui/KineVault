import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { execFile, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { addWorkshopEquipment } from "../../src/lib/motion/workshop-freedom";
import { blankWorkshopScene } from "../../src/lib/motion/workshop";
import { createQuickScene } from "../../src/lib/motion/quick-create";

const run = promisify(execFile);

for (const variant of ["wide-bar", "seated-row-rope", "free-row-deadlift"] as const) test(`a saved ${variant} produces playable private media`, async ({ page }) => {
  test.setTimeout(150_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
  const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `cable-media-${randomUUID()}@example.test`, password = "CableMediaFixture2026!";
  const account = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  let paths: string[] = [];
  let renderSceneId: string | undefined;
  try {
    const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    await owner.auth.signInWithPassword({ email, password });
    const scene = addWorkshopEquipment(structuredClone(blankWorkshopScene), "cable-machine", randomUUID());
    scene.durationMs = 500;
    scene.keyframes = [0, 250, 500].map(timeMs => ({ timeMs, poses: {
      "left-elbow": { x: timeMs === 250 ? 90 : 30, y: 0, z: 0 }, "right-elbow": { x: timeMs === 250 ? 90 : 30, y: 0, z: 0 },
    } }));
    Object.assign(scene.studio!.objects[0], { attachment: "both", cableAttachment: "lat-bar", pulleyHeight: 2.8 });
    if (variant !== "wide-bar") {
      const row = createQuickScene("cable-row-machine").studio!.objects[0];
      row.frames = undefined;
      Object.assign(row, { attachment: "both", cableAttachment: variant === "seated-row-rope" ? "rope" : "angled-bar", machineUse: variant === "seated-row-rope", machinePosition: .4 });
      scene.studio!.objects = [row];
      if (variant === "free-row-deadlift") {
        scene.studio!.body.x = 1.3;
        scene.keyframes = [0, 250, 500].map(timeMs => ({ timeMs, poses: {
          torso: { x: timeMs === 250 ? 5 : 30, y: 0, z: 0 },
          "left-hip": { x: timeMs === 250 ? 0 : 45, y: 0, z: 0 }, "right-hip": { x: timeMs === 250 ? 0 : 45, y: 0, z: 0 },
          "left-knee": { x: timeMs === 250 ? 0 : -25, y: 0, z: 0 }, "right-knee": { x: timeMs === 250 ? 0 : -25, y: 0, z: 0 },
        } }));
      }
    }
    const created = await owner.rpc("save_workshop_draft", { p_scene: scene, p_name: "Wide cable render fixture" });
    if (created.error) throw created.error;
    const metadata = await owner.rpc("save_private_exercise", { p_private_id: created.data, p_name: "Wide cable render fixture", p_family_slug: "curl",
      p_primary_muscle_slugs: ["biceps-brachii"], p_joint_action_slugs: ["elbow-flexion"], p_equipment_slugs: ["cable"] });
    if (metadata.error) throw metadata.error;
    const submission = await owner.rpc("submit_private_exercise", { p_private_id: created.data, p_duplicate_disposition: "new" });
    if (submission.error) throw submission.error;
    const record = await owner.from("exercise_submissions").select("original_content_id").eq("id", submission.data).single();
    if (record.error) throw record.error;
    const contentId = record.data.original_content_id;
    expect(contentId).toMatch(/^[0-9a-f-]{36}$/);
    const savedScene = await owner.from("exercise_scenes").select("id").eq("content_id", contentId).single();
    if (savedScene.error) throw savedScene.error;
    renderSceneId = savedScene.data.id;
    expect(renderSceneId).toMatch(/^[0-9a-f-]{36}$/);
    const queued: { id: string; status: string } = JSON.parse(execFileSync("docker", ["exec", "supabase_db_kinevault", "psql", "-U", "postgres", "-d", "postgres", "-At", "-c",
      `select json_build_object('id',id,'status',status) from public.render_jobs where scene_id = '${renderSceneId}';`], { encoding: "utf8" }));
    expect(queued.status).toBe("queued");
    execFileSync("docker", ["exec", "supabase_db_kinevault", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c",
      `update public.render_jobs set queued_at = '1970-01-01' where status = 'queued' and scene_id in (select id from public.exercise_scenes where content_id = '${contentId}');`], { stdio: "pipe" });
    const worker = await run(process.execPath, ["scripts/render-worker.mjs", "--once"], { timeout: 100_000 });
    expect(worker.stdout).toContain(queued.id);
    const media = await owner.from("exercise_media").select("kind,storage_path").eq("content_id", contentId);
    if (media.error) throw media.error;
    paths = media.data.map(item => item.storage_path);
    expect(media.data.map(item => item.kind).sort(), worker.stdout + worker.stderr).toEqual(["mp4", "poster", "webm"]);
    const videoPath = media.data.find(item => item.kind === "mp4")!.storage_path;
    const signed = await owner.storage.from("exercise-private").createSignedUrl(videoPath, 120);
    if (signed.error) throw signed.error;
    const response = await page.request.get(signed.data.signedUrl);
    expect(response.ok()).toBe(true);
    const folder = ".local-artifacts/workshop/cable-freedom"; mkdirSync(folder, { recursive: true });
    writeFileSync(`${folder}/${variant}.mp4`, await response.body());
    await page.setContent('<video controls muted aria-label="Rendered cable movement"></video>');
    await page.locator("video").evaluate((video: HTMLVideoElement, source) => { video.src = source; }, signed.data.signedUrl);
    await expect.poll(() => page.locator("video").evaluate((video: HTMLVideoElement) => video.readyState)).toBeGreaterThanOrEqual(2);
    await expect.poll(() => page.locator("video").evaluate((video: HTMLVideoElement) => video.videoWidth)).toBeGreaterThan(0);
    await page.locator("video").screenshot({ path: `${folder}/rendered-${variant}.png` });
  } finally {
    try {
    if (renderSceneId) execFileSync("docker", ["exec", "supabase_db_kinevault", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c",
      `update public.render_jobs set status = 'failed', error_code = 'render_failed' where scene_id = '${renderSceneId}' and status = 'queued';`], { stdio: "pipe" });
    if (paths.length) {
      const removed = await service.storage.from("exercise-private").remove(paths);
      if (removed.error) throw removed.error;
    }
    } finally {
      await cleanupLocalFixture({ admin: service, userId: account.data.user.id, email, password });
    }
  }
});
