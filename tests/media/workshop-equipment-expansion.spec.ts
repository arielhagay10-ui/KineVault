import { execFile, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import ffmpeg from "ffmpeg-static";
import { createQuickScene } from "../../src/lib/motion/quick-create";
import { createStudioObject } from "../../src/lib/motion/studio";
import { defaultBand } from "../../src/lib/motion/studio-band";
import { identityTransform } from "../../src/lib/motion/workshop";
import { cleanupLocalFixture } from "../helpers/local-fixtures";

const run = promisify(execFile);
for (const slug of ["row-machine", "shoulder-press-machine", "chest-press-machine", "t-bar-row-machine", "leg-press"] as const) test(`${slug} and anchored bands render playable private video`, async ({ page, baseURL }) => {
  test.setTimeout(600_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `equipment-media-${randomUUID()}@example.test`, password = "EquipmentMediaFixture2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  let renderJobId: string | undefined;
  try {
    const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    await owner.auth.signInWithPassword({ email, password });
    const scene = createQuickScene(slug), machine = scene.studio!.objects[0];
    const durationMs = slug === "t-bar-row-machine" ? 3200 : 500;
    scene.durationMs = durationMs;
    scene.keyframes = [0, durationMs / 2, durationMs].map(timeMs => ({ timeMs, poses: {} }));
    if (slug !== "t-bar-row-machine") machine.frames = [0, durationMs / 2, durationMs].map(timeMs => ({ ...identityTransform, timeMs, machinePosition: timeMs === durationMs / 2 ? 1 : 0 }));
    const band = { ...createStudioObject("resistance-band", randomUUID(), 1), band: defaultBand() };
    band.band.start = { target: "left-foot", point: { x: 0, y: -.08, z: .15 } };
    band.band.end = { target: "left-hand", point: { x: .03, y: -.15, z: .13 } };
    band.band.length = 1.2;
    if (slug !== "t-bar-row-machine") scene.studio!.objects.push(band, { ...createStudioObject("stool", randomUUID(), 2), x: -1.3, z: 0 }, { ...createStudioObject("plyo-box", randomUUID(), 3), x: 1.6, z: 0 });
    const created = await owner.rpc("save_workshop_draft", { p_scene: scene, p_name: `Equipment render ${slug}` });
    if (created.error) throw created.error;
    const draft = await owner.from("private_exercises").select("content_id").eq("id", created.data).single();
    if (draft.error) throw draft.error;
    const saved = await owner.from("exercise_scenes").select("id,studio_layout").eq("content_id", draft.data.content_id).single();
    if (saved.error) throw saved.error;
    expect(saved.data.studio_layout).toMatchObject({ objects: expect.arrayContaining([expect.objectContaining(slug === "t-bar-row-machine" ? { slug, machineUse: true } : { slug: "resistance-band", band: band.band })]) });
    const jobId = randomUUID(), directory = resolve(`.local-artifacts/equipment-expansion/media/${slug}`);
    renderJobId = jobId;
    mkdirSync(directory, { recursive: true });
    execFileSync("docker", ["exec", "supabase_db_kinevault", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c",
      `insert into public.render_jobs(id,scene_id,requested_by,status,claim_id,attempt_count,started_at) values ('${jobId}','${saved.data.id}','${account.data.user.id}','running','${randomUUID()}',1,now());`], { stdio: "pipe" });
    const captured = await run(process.execPath, ["--env-file=.env.local", "--input-type=module", "-e", `
      import { captureMotion } from './scripts/lib/capture-motion.mjs';
      const [directory, jobId, origin, durationMs] = process.argv.slice(1);
      await captureMotion({ scene: { durationMs: Number(durationMs) }, directory, pageUrl: new URL('/internal/render/' + jobId, origin).href,
        token: process.env.RENDER_WORKER_TOKEN, onMetrics: metrics => console.log(JSON.stringify(metrics)) });
    `, directory, jobId, baseURL!, String(durationMs)], { timeout: 540_000 });
    writeFileSync(`${directory}/metrics.json`, captured.stdout);
    const hashes = execFileSync(ffmpeg!, ["-hide_banner", "-loglevel", "error", "-i", `${directory}/demo.mp4`, "-f", "framemd5", "-"], { encoding: "utf8" })
      .split("\n").filter(line => line && !line.startsWith("#")).map(line => line.split(",").at(-1)!.trim());
    expect(new Set(hashes).size).toBeGreaterThan(2);
    for (const [name, time] of [["start", "0"], ["middle", String(durationMs / 2000)], ["return", String(durationMs * .9 / 1000)]]) execFileSync(ffmpeg!, ["-hide_banner", "-loglevel", "error", "-y", "-ss", time,
      "-i", `${directory}/demo.mp4`, "-frames:v", "1", `${directory}/${name}.png`], { stdio: "pipe" });
    const mediaUrl = new URL(`/__equipment-media/${slug}.mp4`, baseURL).href;
    await page.route(mediaUrl, route => route.fulfill({ contentType: "video/mp4", body: readFileSync(`${directory}/demo.mp4`) }));
    await page.setContent('<video controls muted aria-label="Rendered equipment movement"></video>');
    const video = page.locator("video");
    await video.evaluate((element: HTMLVideoElement, source) => { element.src = source; }, mediaUrl);
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState)).toBeGreaterThanOrEqual(2);
    await video.evaluate((element: HTMLVideoElement) => element.play());
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.ended), { timeout: 15_000 }).toBe(true);
  } finally {
    if (renderJobId) execFileSync("docker", ["exec", "supabase_db_kinevault", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", `delete from public.render_jobs where id = '${renderJobId}';`], { stdio: "pipe" });
    await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password });
  }
});
