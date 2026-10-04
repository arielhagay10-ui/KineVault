import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, posix, resolve, sep } from "node:path";
import { captureMotion } from "./lib/capture-motion.mjs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const version = "z-anatomy-v8";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const appUrl = process.env.RENDER_APP_URL ?? "http://127.0.0.1:3000";
const token = process.env.RENDER_WORKER_TOKEN;
if (!supabaseUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY || !token || token.length < 32) throw new Error("Render environment incomplete");
// This maintenance command is intentionally restricted to local development.
for (const url of [supabaseUrl, appUrl]) if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("Render refresh requires local services");
const service = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: candidates, error } = await service.rpc("list_render_refresh_targets", { p_renderer_version: version });
if (error) throw error;
const requestedSlugs = process.argv.find(argument => argument.startsWith("--slugs="))?.slice(8).split(",");
let targets = candidates;
if (requestedSlugs?.length) {
  const catalog = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data: exercises, error: exerciseError } = await catalog.from("exercises").select("current_content_id").in("slug", requestedSlugs).eq("status", "published");
  if (exerciseError) throw exerciseError;
  const { data: media, error: mediaError } = await catalog.from("exercise_media").select("asset_group_id").in("content_id", exercises.map(item => item.current_content_id));
  if (mediaError) throw mediaError;
  const groups = new Set(media.map(item => item.asset_group_id));
  targets = candidates.filter(item => groups.has(item.asset_group_id));
}
if (!targets?.length) { process.stdout.write("All saved renders are current.\n"); }
else {
const temporaryDirectory = await mkdtemp(join(tmpdir(), "kinevault-refresh-"));
const cache = new Map();
try {
  let completed = 0;
  for (const target of targets) {
    const { data: scene, error: sceneError } = await service.rpc("read_render_refresh_scene", { p_asset_group_id: target.asset_group_id });
    if (sceneError || !scene) throw sceneError ?? new Error("Refresh scene unavailable");
    const hash = createHash("sha256").update(JSON.stringify(scene)).digest("hex");
    let files = cache.get(hash);
    if (!files) {
      const directory = join(temporaryDirectory, hash); await mkdir(directory);
      process.stdout.write(`Rendering ${scene.durationMs}ms ${scene.cameraAngle} scene…\n`);
      files = await captureMotion({ scene, pageUrl: `${appUrl}/internal/render/${target.asset_group_id}?refresh=1`, token, directory,
        onMetrics: metrics => process.stdout.write(`Render phases ${JSON.stringify({ assetGroupId: target.asset_group_id, ...metrics })}\n`) });
      cache.set(hash, files);
    }
    for (const asset of target.assets) {
      const replacementPath = posix.join(posix.dirname(asset.path), version, posix.basename(asset.path));
      const { data: exists } = await service.storage.from(asset.bucket).exists(replacementPath);
      if (!exists) {
        const { error: uploadError } = await service.storage.from(asset.bucket).upload(replacementPath, await readFile(files[asset.kind]), {
          contentType: asset.kind === "poster" ? "image/webp" : `video/${asset.kind}`, cacheControl: "3600", upsert: false,
        });
        if (uploadError) throw uploadError;
      }
    }
    const { error: registerError } = await service.rpc("register_render_replacements", { p_asset_group_id: target.asset_group_id, p_renderer_version: version });
    if (registerError) throw registerError;
    process.stdout.write(`Refreshed video set ${++completed}/${targets.length}\n`);
  }
  process.stdout.write(`${completed} saved video sets now use ${version}; original files preserved.\n`);
} finally {
  const absolute = resolve(temporaryDirectory);
  if (!absolute.startsWith(resolve(tmpdir()) + sep) || !basename(absolute).startsWith("kinevault-refresh-")) throw new Error("Unsafe refresh directory");
  await rm(absolute, { recursive: true, force: true });
}
}
