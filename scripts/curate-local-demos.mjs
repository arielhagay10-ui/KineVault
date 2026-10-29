// Legacy preview/render support for already prepared local curation manifests.
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { captureMotion } from "./lib/capture-motion.mjs";
import { requireCurrentCurationClaim } from "./lib/curation-claim.mjs";

const mode = process.argv[2];
if (mode !== "preview" && mode !== "render") {
  throw new Error("Batch curation authoring and publication are retired. Open /admin/candidates, save motion in the workshop, and submit the draft for review.");
}

process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const app = process.env.RENDER_APP_URL ?? "http://127.0.0.1:3000";
for (const value of [url, app]) {
  if (!["localhost", "127.0.0.1"].includes(new URL(value).hostname)) throw new Error("Local services required");
}
const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const fullBody = process.argv.includes("--full-body");
const directory = resolve(fullBody ? ".local-artifacts/full-body-curation" : ".local-artifacts/catalog-curation");
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8"));

async function rpc(name, args) {
  const { data, error } = await service.rpc(name, args);
  if (error) throw error;
  return data;
}

if (mode === "preview") {
  const browser = await chromium.launch({ headless: true, channel: "chrome", args: ["--use-gl=angle", "--use-angle=swiftshader"] });
  try {
    const page = await browser.newPage({ viewport: { width: 640, height: 640 } });
    await page.setExtraHTTPHeaders({ "x-kinevault-render-token": process.env.RENDER_WORKER_TOKEN });
    for (const item of manifest.items) {
      await page.goto(`${app}/internal/render/${item.job}`, { waitUntil: "networkidle" });
      await page.locator('[data-anatomy-state="ready"]').waitFor({ timeout: 60000 });
      for (const time of [0, 1600]) {
        await page.evaluate(async timeMs => {
          window.kinevaultRenderFrame(timeMs);
          await new Promise(requestAnimationFrame);
          await new Promise(requestAnimationFrame);
        }, time);
        await page.locator("#render-frame").screenshot({ path: resolve(directory, `${item.slug}-${time}.png`) });
      }
    }
  } finally {
    await browser.close();
  }
} else {
  for (const item of manifest.items) {
    if (item.rendered) continue;
    await requireCurrentCurationClaim(service, item);
    const motion = await rpc("read_render_scene", { p_job_id: item.job });
    const output = resolve(directory, item.slug);
    await mkdir(output, { recursive: true });
    const files = await captureMotion({ scene: motion, pageUrl: `${app}/internal/render/${item.job}`,
      token: process.env.RENDER_WORKER_TOKEN, directory: output });
    const paths = {};
    for (const [kind, file] of Object.entries(files)) {
      paths[kind] = `${item.submission}/${item.job}/${item.claimId}/${kind === "poster" ? "poster.webp" : `demo.${kind}`}`;
      const { data: exists } = await service.storage.from("exercise-private").exists(paths[kind]);
      if (!exists) {
        const { error } = await service.storage.from("exercise-private").upload(paths[kind], await readFile(file),
          { contentType: kind === "poster" ? "image/webp" : `video/${kind}` });
        if (error) throw error;
      }
    }
    await rpc("complete_render_job", { p_job_id: item.job, p_claim_id: item.claimId,
      p_asset_group_id: randomUUID(), p_webm_path: paths.webm, p_mp4_path: paths.mp4, p_poster_path: paths.poster });
    item.rendered = true;
    item.paths = paths;
    await writeFile(resolve(directory, "manifest.json"), JSON.stringify(manifest, null, 2));
    console.log(`Rendered ${item.slug}`);
  }
}
