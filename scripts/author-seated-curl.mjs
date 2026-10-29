// Recover an already claimed legacy curl render without creating or publishing content.
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { captureMotion } from "./lib/capture-motion.mjs";
import { requireCurrentCurationClaim } from "./lib/curation-claim.mjs";

if (process.argv[2] !== "render") {
  throw new Error("Scripted curl authoring and publication are retired. Create or open a draft in /my-exercises, save motion in the workshop, and submit it for review.");
}

process.loadEnvFile(".env.local");
const incline = process.argv.includes("--incline");
const slug = incline ? "incline-dumbbell-curl" : "seated-dumbbell-curl";
const name = incline ? "Incline Dumbbell Curl" : "Seated Dumbbell Curl";
const app = process.env.RENDER_APP_URL ?? "http://127.0.0.1:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
for (const value of [app, url]) {
  if (!["localhost", "127.0.0.1"].includes(new URL(value).hostname)) throw new Error("Local services required");
}
const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const directory = resolve(`.local-artifacts/${slug}`);
const manifestPath = resolve(directory, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

if (manifest.rendered) throw new Error("Render already completed");
await requireCurrentCurationClaim(service, manifest);
const { data: scene, error: sceneError } = await service.rpc("read_render_scene", { p_job_id: manifest.job });
if (sceneError) throw sceneError;
const files = await captureMotion({ scene, pageUrl: `${app}/internal/render/${manifest.job}`,
  token: process.env.RENDER_WORKER_TOKEN, directory });
const paths = {};
for (const [kind, file] of Object.entries(files)) {
  paths[kind] = `${manifest.submission}/${manifest.job}/${manifest.claimId}/${kind === "poster" ? "poster.webp" : `demo.${kind}`}`;
  const { data: exists } = await service.storage.from("exercise-private").exists(paths[kind]);
  if (!exists) {
    const { error } = await service.storage.from("exercise-private").upload(paths[kind], await readFile(file),
      { contentType: kind === "poster" ? "image/webp" : `video/${kind}` });
    if (error) throw error;
  }
}
const { error: completeError } = await service.rpc("complete_render_job", {
  p_job_id: manifest.job, p_claim_id: manifest.claimId, p_asset_group_id: randomUUID(),
  p_webm_path: paths.webm, p_mp4_path: paths.mp4, p_poster_path: paths.poster,
});
if (completeError) throw completeError;
manifest.rendered = true;
manifest.paths = paths;
await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`Rendered ${name}`);
