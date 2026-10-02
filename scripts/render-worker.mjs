import { createClient } from "@supabase/supabase-js";
import ffmpegStatic from "ffmpeg-static";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { captureMotion } from "./lib/capture-motion.mjs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const renderToken = process.env.RENDER_WORKER_TOKEN;
const appUrl = (process.env.RENDER_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const ffmpegPath = process.env.FFMPEG_PATH ?? ffmpegStatic;
if (!supabaseUrl || !serviceKey || !renderToken || renderToken.length < 32 || !ffmpegPath) {
  throw new Error("Render worker environment is incomplete");
}
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function upload(path, filePath, contentType) {
  const bytes = await readFile(filePath);
  const { error } = await supabase.storage.from("exercise-private").upload(path, bytes, {
    contentType, cacheControl: "3600", upsert: false,
  });
  if (error) throw error;
}

async function renderOne() {
  const { data: claimed, error: claimError } = await supabase.rpc("claim_render_job");
  if (claimError) throw claimError;
  const job = claimed?.[0];
  if (!job) return false;

  let temporaryDirectory;
  let stage = "load scene";
  const uploaded = [];
  try {
    const { data: scene, error: sceneError } = await supabase.rpc("read_render_scene", { p_job_id: job.job_id });
    if (sceneError || !scene || !Number.isInteger(scene.durationMs)
      || scene.durationMs < 250 || scene.durationMs > 12000) {
      throw new Error("Claimed scene is unavailable or invalid");
    }
    temporaryDirectory = await mkdtemp(join(tmpdir(), "kinevault-render-"));
    stage = "capture and encode";
    const { webm, mp4, poster } = await captureMotion({ scene,
      pageUrl: `${appUrl}/internal/render/${job.job_id}`, token: renderToken, directory: temporaryDirectory });

    const prefix = `${job.submission_id}/${job.job_id}`;
    const outputs = [
      [`${prefix}/demo.webm`, webm, "video/webm"],
      [`${prefix}/demo.mp4`, mp4, "video/mp4"],
      [`${prefix}/poster.webp`, poster, "image/webp"],
    ];
    for (const [storagePath, localPath, mime] of outputs) {
      stage = `upload ${mime}`;
      await upload(storagePath, localPath, mime);
      uploaded.push(storagePath);
    }
    stage = "complete job";
    const { error: completeError } = await supabase.rpc("complete_render_job", {
      p_job_id: job.job_id,
      p_asset_group_id: randomUUID(),
      p_webm_path: outputs[0][0], p_mp4_path: outputs[1][0], p_poster_path: outputs[2][0],
    });
    if (completeError) throw completeError;
    process.stdout.write(`Rendered submission ${job.submission_id}\n`);
    return true;
  } catch (error) {
    process.stderr.write(`Render stage: ${stage}\n`);
    if (uploaded.length) await supabase.storage.from("exercise-private").remove(uploaded);
    await supabase.rpc("fail_render_job", { p_job_id: job.job_id, p_error_code: "render_error" });
    throw error;
  } finally {
    if (temporaryDirectory) {
      const absolute = resolve(temporaryDirectory);
      const temporaryRoot = resolve(tmpdir()) + sep;
      if (!absolute.startsWith(temporaryRoot) || !basename(absolute).startsWith("kinevault-render-")) {
        throw new Error("Unsafe render temporary directory");
      }
      await rm(absolute, { recursive: true, force: true });
    }
  }
}

const loop = process.argv.includes("--loop");
do {
  try {
    const worked = await renderOne();
    if (!worked || loop) await new Promise((resolveSleep) => setTimeout(resolveSleep, worked ? 100 : 5000));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Render failed"}\n`);
    if (!loop) process.exitCode = 1;
    else await new Promise((resolveSleep) => setTimeout(resolveSleep, 5000));
  }
} while (loop);
