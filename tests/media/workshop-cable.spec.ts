import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { execFile, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { addWorkshopEquipment } from "../../src/lib/motion/workshop-freedom";
import { blankWorkshopScene, identityTransform, type StudioObject } from "../../src/lib/motion/workshop";
import { createQuickScene } from "../../src/lib/motion/quick-create";
import { createStudioObject } from "../../src/lib/motion/studio";
import { automaticWeightTransform } from "../../src/lib/motion/automatic-weight-grip";
import { editHeldWeightPose } from "../../src/lib/motion/held-weight-pose";
import { carryHeldWeightsWithBody } from "../../src/lib/motion/held-weight-body";
import { changingElbowPulloverScene, nearLimitPulloverScene, sharedDumbbellScene } from "../helpers/shared-dumbbell";

const run = promisify(execFile);

for (const variant of ["wide-bar", "seated-row-rope", "free-row-deadlift", "one-hand-barbell", "custom-barbell", "custom-rope", "custom-machine", "lat-pulldown", "leg-press", "pec-deck", "automatic-dumbbells", "resting-dumbbells", "joint-driven-dumbbells", "carried-dumbbells", "lying-front-raise-dumbbells", "joint-driven-barbell", "shared-goblet-dumbbells", "shared-pullover-dumbbells", "shared-near-limit-dumbbells", "shared-varying-dumbbells", "shared-left-arm-dumbbells"] as const) test(`a saved ${variant} produces playable private media`, async ({ page }) => {
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
    const machineVariant = variant === "lat-pulldown" || variant === "leg-press" || variant === "pec-deck";
    if (variant.startsWith("shared-")) {
      Object.assign(scene, variant === "shared-near-limit-dumbbells" ? nearLimitPulloverScene().scene
        : variant === "shared-varying-dumbbells" || variant === "shared-left-arm-dumbbells" ? changingElbowPulloverScene(variant === "shared-left-arm-dumbbells" ? "left" : undefined).scene
        : sharedDumbbellScene(variant === "shared-goblet-dumbbells" ? "goblet" : "pullover", true).scene);
      if (variant === "shared-pullover-dumbbells") {
        Object.assign(scene, editHeldWeightPose(scene, 1, "all", {
          "left-shoulder": { x: -110, y: 0, z: 0 }, "right-shoulder": { x: -110, y: 0, z: 0 },
        }));
        Object.assign(scene, editHeldWeightPose(scene, 1, "selected", {
          "left-elbow": { x: 75, y: 0, z: 0 }, "right-elbow": { x: 75, y: 0, z: 0 },
        }));
        expect(scene.studio!.objects.find(item => item.slug === "dumbbell")!.poseDriver).toBe("arm");
      }
    } else if (machineVariant) {
      Object.assign(scene, createQuickScene(variant === "lat-pulldown" ? "lat-pulldown-machine" : variant));
    } else if (variant === "joint-driven-barbell") {
      scene.durationMs = 3200;
      scene.keyframes = structuredClone(blankWorkshopScene.keyframes);
      const bar = { ...createStudioObject("barbell", randomUUID(), 0), attachment: "both" as const };
      scene.studio = { body: identityTransform, objects: [bar] };
      Object.assign(bar, automaticWeightTransform(identityTransform, bar, "both", scene, 0));
      Object.assign(scene, editHeldWeightPose(scene, 1, "selected", { "left-elbow": { x: 155, y: 0, z: 0 }, "right-elbow": { x: 155, y: 0, z: 0 } }));
    } else if (variant === "resting-dumbbells") {
      scene.durationMs = blankWorkshopScene.durationMs;
      scene.keyframes = structuredClone(blankWorkshopScene.keyframes);
      const weights: StudioObject[] = (["left", "right"] as const).map(side => ({ ...createStudioObject("dumbbell", randomUUID(), 0), attachment: side }));
      scene.studio = { body: identityTransform, objects: weights };
      for (const weight of weights) weight.frames = scene.keyframes.map(frame => ({ ...automaticWeightTransform(identityTransform, weight, weight.attachment, scene, frame.timeMs), timeMs: frame.timeMs }));
    } else if (variant === "automatic-dumbbells" || variant === "joint-driven-dumbbells" || variant === "carried-dumbbells" || variant === "lying-front-raise-dumbbells") {
      scene.durationMs = 3200;
      scene.keyframes = [0, 1600, 3200].map(timeMs => ({ timeMs, poses: { "left-elbow": { x: timeMs === 1600 ? 80 : 15, y: 0, z: 0 }, "right-elbow": { x: timeMs === 1600 ? 80 : 15, y: 0, z: 0 } } }));
      const bench = { ...createStudioObject("bench", randomUUID(), 0), x: 0, z: 0, benchAngle: 65 };
      const weights: StudioObject[] = (["left", "right"] as const).map(side => ({ ...createStudioObject("dumbbell", randomUUID(), 1), attachment: side }));
      scene.studio = { body: identityTransform, objects: [bench, ...weights], seating: variant === "carried-dumbbells" ? undefined : { benchId: bench.id, facing: "supine" } };
      for (const weight of weights) weight.frames = scene.keyframes.map(frame => ({ ...automaticWeightTransform(identityTransform, weight, weight.attachment, scene, frame.timeMs), timeMs: frame.timeMs }));
      if (variant === "joint-driven-dumbbells") Object.assign(scene, editHeldWeightPose(scene, 1, "selected", { "left-elbow": { x: 105, y: 0, z: 0 }, "right-elbow": { x: 105, y: 0, z: 0 } }));
      if (variant === "carried-dumbbells") Object.assign(scene, carryHeldWeightsWithBody(scene, { ...scene, studio: { ...scene.studio!, seating: { benchId: bench.id, facing: "supine" } } }));
      if (variant === "lying-front-raise-dumbbells") {
        bench.benchAngle = 0;
        scene.keyframes = [0, 1600, 3200].map(timeMs => ({ timeMs, poses: {
          "left-elbow": { x: 15, y: 0, z: 0 }, "right-elbow": { x: 15, y: 0, z: 0 },
        } }));
        Object.assign(scene, editHeldWeightPose(scene, 1, "selected", { "left-shoulder": { x: 90, y: 0, z: 0 }, "right-shoulder": { x: 90, y: 0, z: 0 } }));
      }
    } else if (variant === "one-hand-barbell" || variant === "custom-barbell") {
      scene.durationMs = 3200;
      scene.keyframes = [0, 1600, 3200].map(timeMs => ({ timeMs, poses: { "left-wrist": { x: -90, y: 0, z: 0 } } }));
      scene.studio!.objects = [{ ...scene.studio!.objects[0], slug: "barbell", name: "One-hand barbell", attachment: "left", cableAttachment: undefined, x: .45, y: 1.3, z: .4,
        ...(variant === "custom-barbell" ? { gripOffsets: { left: { x: -.08, y: 0, z: 0 } } } : {}),
        frames: [0, 1600, 3200].map(timeMs => ({ ...identityTransform, x: .45, y: timeMs === 1600 ? 1.5 : 1.3, z: .4, timeMs, rotationZ: timeMs === 1600 ? 10 : 0 })) }];
    } else if (variant === "custom-machine") {
      const machine = createQuickScene("smith-machine");
      scene.durationMs = machine.durationMs;
      scene.keyframes = machine.keyframes.map(frame => ({ ...frame, poses: { ...frame.poses, "left-wrist": { x: -90, y: 0, z: 0 } } }));
      scene.studio = machine.studio;
      scene.studio!.objects[0].gripOffsets = { left: { x: -.08, y: 0, z: 0 }, right: { x: .08, y: 0, z: 0 } };
    } else if (variant !== "wide-bar") {
      const row = createQuickScene("cable-row-machine").studio!.objects[0];
      row.frames = undefined;
      Object.assign(row, { attachment: "both", cableAttachment: variant === "seated-row-rope" || variant === "custom-rope" ? "rope" : "angled-bar", machineUse: variant === "seated-row-rope" || variant === "custom-rope", machinePosition: .4 });
      if (variant === "custom-rope") row.gripOffsets = { left: { x: .025, y: 0, z: 0 }, right: { x: -.025, y: 0, z: 0 } };
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
    const metadata = await owner.rpc("save_private_exercise", { p_private_id: created.data, p_name: "Workshop render fixture", p_family_slug: variant === "lat-pulldown" ? "lat-pulldown" : variant === "leg-press" ? "squat" : variant === "pec-deck" ? "chest-fly" : "curl",
      p_primary_muscle_slugs: [variant === "lat-pulldown" ? "latissimus-dorsi" : variant === "leg-press" ? "quadriceps" : variant === "pec-deck" ? "pectoralis-major" : "biceps-brachii"], p_joint_action_slugs: [variant === "lat-pulldown" ? "shoulder-adduction" : variant === "leg-press" ? "knee-extension" : variant === "pec-deck" ? "shoulder-horizontal-adduction" : "elbow-flexion"], p_equipment_slugs: [variant === "leg-press" || variant === "pec-deck" ? variant : variant.endsWith("dumbbells") ? "dumbbell" : variant.endsWith("barbell") ? "barbell" : "cable"] });
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
    if (machineVariant || variant === "custom-machine" || variant === "seated-row-rope" || variant.startsWith("shared-")) {
      const posterPath = media.data.find(item => item.kind === "poster")!.storage_path;
      const posterUrl = await owner.storage.from("exercise-private").createSignedUrl(posterPath, 120);
      if (posterUrl.error) throw posterUrl.error;
      const poster = await page.request.get(posterUrl.data.signedUrl);
      expect(poster.ok()).toBe(true);
      writeFileSync(`${folder}/${variant}-poster.webp`, await poster.body());
      writeFileSync(`${folder}/${variant}-media.json`, JSON.stringify({ sceneId: renderSceneId, jobId: queued.id, paths }, null, 2));
    }
    await page.setContent('<video controls muted aria-label="Rendered cable movement"></video>');
    await page.locator("video").evaluate((video: HTMLVideoElement, source) => { video.src = source; }, signed.data.signedUrl);
    await expect.poll(() => page.locator("video").evaluate((video: HTMLVideoElement) => video.readyState)).toBeGreaterThanOrEqual(2);
    await expect.poll(() => page.locator("video").evaluate((video: HTMLVideoElement) => video.videoWidth)).toBeGreaterThan(0);
    await page.locator("video").screenshot({ path: `${folder}/rendered-${variant}.png` });
    if (variant.startsWith("custom-") || variant.endsWith("dumbbells") || variant === "joint-driven-barbell" || variant === "seated-row-rope" || machineVariant) {
      await page.locator("video").evaluate((video: HTMLVideoElement) => video.play());
      await expect.poll(() => page.locator("video").evaluate((video: HTMLVideoElement) => video.ended), { timeout: 15_000 }).toBe(true);
      for (let sample = 0; sample <= 16; sample++) {
        await page.locator("video").evaluate(async (video: HTMLVideoElement, progress) => {
          const target = Math.min(video.duration - .04, video.duration * progress);
          if (Math.abs(video.currentTime - target) < .001) return;
          await new Promise<void>(resolve => { video.addEventListener("seeked", () => resolve(), { once: true }); video.currentTime = target; });
        }, sample / 16);
        await page.locator("video").screenshot({ path: `${folder}/${variant}-${sample}.png` });
      }
    }
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
