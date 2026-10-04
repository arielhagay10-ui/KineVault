// Local catalogue maintenance, split into preparation, visual review, rendering and publication.
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { captureMotion } from "./lib/capture-motion.mjs";
import { requireCurrentCurationClaim } from "./lib/curation-claim.mjs";

process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const app = process.env.RENDER_APP_URL ?? "http://127.0.0.1:3000";
for (const value of [url, app]) if (!["localhost", "127.0.0.1"].includes(new URL(value).hostname)) throw new Error("Local services required");
const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const fullBody = process.argv.includes("--full-body");
const directory = resolve(fullBody ? ".local-artifacts/full-body-curation" : ".local-artifacts/catalog-curation");
await mkdir(directory, { recursive: true });
const manifestPath = resolve(directory, "manifest.json");
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
function sql(query) {
  return execFileSync("docker", ["exec", "supabase_db_kinevault", "psql", "-U", "postgres", "-d", "postgres", "-Atq", "-v", "ON_ERROR_STOP=1", "-c", query], { encoding: "utf8" }).trim();
}
function rpcAs(userId, name, args) {
  if (!/^[0-9a-f-]{36}$/.test(userId)) throw new Error("Invalid curator");
  const parameters = Object.entries(args).map(([key, value]) => `${key} => ${literal(typeof value === "object" ? JSON.stringify(value) : value)}`).join(",");
  return JSON.parse(sql(`begin; set local request.jwt.claim.sub = ${literal(userId)}; set local role authenticated; select to_jsonb(public.${name}(${parameters})); commit;`));
}
async function rpc(name, args) {
  const { data, error } = await service.rpc(name, args);
  if (error) throw error;
  return data;
}
const angle = (x = 0, y = 0, z = 0) => ({ x, y, z });
const arms = (shoulder, elbow) => ({ "left-shoulder": angle(shoulder[0], 0, -shoulder[1]), "right-shoulder": angle(shoulder[0], 0, shoulder[1]), "left-elbow": angle(elbow), "right-elbow": angle(elbow) });
const scene = (equipment, start, peak, y = 0, x = 0, z = 0) => ({
  durationMs: 3200, cameraAngle: "three_quarter", equipment: { slug: equipment, x, y, z, scale: 1 },
  keyframes: [{ timeMs: 0, poses: start }, { timeMs: 1600, poses: peak }, { timeMs: 3200, poses: start }],
});
const scenes = fullBody ? {
  "incline-dumbbell-bench-press": { ...scene("dumbbell-pair", arms([0, 65], 90), arms([-90, 5], 5)), motionStyle: "bench-press" },
  "dumbbell-bent-over-row": { ...scene("dumbbell-pair", arms([-55, 3], 10), arms([-5, 3], 95)), motionStyle: "row" },
  "dumbbell-squat": { ...scene("dumbbell-pair", { ...arms([0, 5], 5), torso: angle(0) }, { ...arms([-20, 5], 5), torso: angle(35) }), motionStyle: "squat" },
  "dumbbell-romanian-deadlift": { ...scene("dumbbell-pair", { ...arms([0, 5], 5), torso: angle(0) }, { ...arms([-55, 5], 5), torso: angle(35) }), motionStyle: "hinge" },
  "dumbbell-stationary-lunge": { ...scene("dumbbell-pair", { ...arms([-8, 5], 5), torso: angle(0) }, { ...arms([-8, 5], 5), torso: angle(35) }), motionStyle: "split-squat" },
} : {
  "dumbbell-curl": scene("dumbbell-pair", arms([0, 3], 10), arms([0, 3], 110)),
  "dumbbell-lateral-raise": scene("dumbbell-pair", arms([0, 5], 10), arms([0, 75], 10)),
  "dumbbell-shoulder-press": scene("dumbbell-pair", arms([-90, 75], 90), arms([0, 165], 5)),
  "cable-lateral-raise": scene("single-cable", { "left-shoulder": angle(0, 0, -5), "left-elbow": angle(10) }, { "left-shoulder": angle(0, 0, -75), "left-elbow": angle(10) }),
  "cable-triceps-pushdown": scene("single-cable", { "left-elbow": angle(95) }, { "left-elbow": angle(10) }, 2.25, 2.75, 0.6),
};
const newExercises = {
  "dumbbell-bent-over-row": ["Dumbbell Bent-Over Row", "row", "latissimus-dorsi", "shoulder-extension", "A bilateral dumbbell row performed with the torso hinged forward."],
  "dumbbell-squat": ["Dumbbell Squat", "squat", "quadriceps", "knee-extension", "A squat holding a dumbbell at each side, with both feet planted."],
  "dumbbell-romanian-deadlift": ["Dumbbell Romanian Deadlift", "deadlift", "hamstrings", "hip-extension", "A standing dumbbell hip hinge with a modest knee bend."],
  "dumbbell-stationary-lunge": ["Dumbbell Stationary Lunge", "lunge", "quadriceps", "knee-extension", "A stationary split-stance lunge holding dumbbells at the sides. The feet remain in place throughout the repetition."],
};
const mode = process.argv[2];
if (mode === "prepare") {
  if (existsSync(manifestPath)) throw new Error("A curation manifest already exists; continue its preview, render or publish step");
  const { data, error } = await service.auth.admin.createUser({ email: `catalog-curator-${Date.now()}@example.test`, password: randomUUID(), email_confirm: true });
  if (error) throw error;
  const userId = data.user.id;
  sql(`update public.roles set role='reviewer' where user_id=${literal(userId)};`);
  const items = [];
  for (const [slug, motion] of Object.entries(scenes)) {
    const id = sql(`select id from public.exercises where slug=${literal(slug)} and status='pending_media';`);
    if (sql(`select id from public.exercises where slug=${literal(slug)} and status='published';`)) continue;
    const details = newExercises[slug];
    if (!id && !details) continue;
    const draft = id ? rpcAs(userId, "prepare_catalog_candidate", { p_exercise_id: id })
      : rpcAs(userId, "save_private_exercise", { p_name: details[0], p_family_slug: details[1],
        p_primary_muscle_slugs: `{${details[2]}}`, p_joint_action_slugs: `{${details[3]}}`, p_equipment_slugs: "{dumbbell}", p_short_description: details[4] });
    rpcAs(userId, "save_private_scene", { p_private_id: draft, p_scene: motion });
    const submission = rpcAs(userId, "submit_private_exercise", { p_private_id: draft, p_duplicate_disposition: "new" });
    items.push({ slug, id: id || null, submission, draft });
  }
  for (let index = 0; index < items.length; index++) {
    const [job] = await rpc("claim_render_job");
    const target = items.find(candidate => candidate.submission === job?.submission_id);
    if (!target || !job.claim_id) throw new Error("Unrelated queued job or missing claim identifier; run the regular worker first");
    target.job = job.job_id;
    target.claimId = job.claim_id;
  }
  await writeFile(manifestPath, JSON.stringify({ userId, items }, null, 2));
  console.log(`Prepared ${items.length} distinct scenes.`);
} else {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (mode === "revise") {
    const item = manifest.items.find(item => item.slug === process.argv[3]);
    if (!item || item.rendered) throw new Error("An unrendered candidate slug is required");
    await requireCurrentCurationClaim(service, item);
    const status = sql(`select status from public.exercise_submissions where id=${literal(item.submission)};`);
    if (status === "submitted") rpcAs(manifest.userId, "begin_submission_review", { p_submission_id: item.submission });
    if (status !== "rejected") rpcAs(manifest.userId, "reject_submission", { p_submission_id: item.submission, p_reason: "other", p_comment: "Preview needs corrected equipment placement before publication." });
    const cancelled = sql(`update public.render_jobs set status='failed',error_code='preview_revised',claim_id=null where id=${literal(item.job)} and status='running' and claim_id=${literal(item.claimId)} and started_at > clock_timestamp() - interval '10 minutes' returning id;`);
    if (cancelled !== item.job) throw new Error("Saved render claim is expired or no longer current");
    const draft = item.draft ?? rpcAs(manifest.userId, "prepare_catalog_candidate", { p_exercise_id: item.id });
    rpcAs(manifest.userId, "save_private_scene", { p_private_id: draft, p_scene: scenes[item.slug] });
    item.submission = rpcAs(manifest.userId, "submit_private_exercise", { p_private_id: draft, p_duplicate_disposition: "new" });
    const [job] = await rpc("claim_render_job");
    if (job?.submission_id !== item.submission || !job.claim_id) throw new Error("Unexpected job or missing claim identifier");
    item.job = job.job_id;
    item.claimId = job.claim_id;
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  } else if (mode === "preview") {
    const browser = await chromium.launch({ headless: true, channel: "chrome", args: ["--use-gl=angle", "--use-angle=swiftshader"] });
    try {
      const page = await browser.newPage({ viewport: { width: 640, height: 640 } });
      await page.setExtraHTTPHeaders({ "x-kinevault-render-token": process.env.RENDER_WORKER_TOKEN });
      for (const item of manifest.items) {
        await page.goto(`${app}/internal/render/${item.job}`, { waitUntil: "networkidle" });
        await page.locator('[data-anatomy-state="ready"]').waitFor({ timeout: 60000 });
        for (const time of [0, 1600]) {
          await page.evaluate(async time => { window.kinevaultRenderFrame(time); await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); }, time);
          await page.locator("#render-frame").screenshot({ path: resolve(directory, `${item.slug}-${time}.png`) });
        }
      }
    } finally { await browser.close(); }
  } else if (mode === "render") {
    for (const item of manifest.items) {
      if (item.rendered) continue;
      await requireCurrentCurationClaim(service, item);
      const motion = await rpc("read_render_scene", { p_job_id: item.job });
      const output = resolve(directory, item.slug);
      await mkdir(output, { recursive: true });
      const files = await captureMotion({ scene: motion, pageUrl: `${app}/internal/render/${item.job}`, token: process.env.RENDER_WORKER_TOKEN, directory: output });
      const paths = {};
      for (const [kind, file] of Object.entries(files)) {
        paths[kind] = `${item.submission}/${item.job}/${item.claimId}/${kind === "poster" ? "poster.webp" : `demo.${kind}`}`;
        const { data: exists } = await service.storage.from("exercise-private").exists(paths[kind]);
        if (!exists) {
          const { error } = await service.storage.from("exercise-private").upload(paths[kind], await readFile(file), { contentType: kind === "poster" ? "image/webp" : `video/${kind}` });
          if (error) throw error;
        }
      }
      await rpc("complete_render_job", { p_job_id: item.job, p_claim_id: item.claimId, p_asset_group_id: randomUUID(), p_webm_path: paths.webm, p_mp4_path: paths.mp4, p_poster_path: paths.poster });
      item.rendered = true; item.paths = paths;
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      console.log(`Rendered ${item.slug}`);
    }
  } else if (mode === "publish") {
    for (const item of manifest.items) {
      if (item.published) continue;
      if (!item.rendered) throw new Error("Render and inspect every demo first");
      for (const [kind, path] of Object.entries(item.paths)) {
        const destination = `submissions/${item.submission}/demo.${kind === "poster" ? "webp" : kind}`;
        const { data: exists } = await service.storage.from("exercise-public").exists(destination);
        if (!exists) {
          const { error } = await service.storage.from("exercise-private").copy(path, destination, { destinationBucket: "exercise-public" });
          if (error) throw error;
        }
      }
      rpcAs(manifest.userId, "begin_submission_review", { p_submission_id: item.submission });
      if (fullBody) {
        const style = scenes[item.slug].motionStyle;
        const patterns = { "bench-press": "horizontal-push", row: "horizontal-pull", squat: "squat", hinge: "hip-hinge", "split-squat": "lunge" };
        const actions = { "bench-press": ["shoulder-horizontal-adduction", "elbow-extension"], row: ["shoulder-extension", "elbow-flexion"], squat: ["hip-extension", "knee-extension"], hinge: ["hip-extension"], "split-squat": ["hip-extension", "knee-extension"] };
        const instructions = {
          "bench-press": ["Sit against the inclined backrest with a dumbbell in each hand.", "Press the dumbbells away from the chest, then return under control."],
          row: ["Stand holding dumbbells and hinge forward at the hips.", "Draw the elbows back beside the torso, then lower the dumbbells."],
          squat: ["Stand with a dumbbell at each side and both feet planted.", "Bend the hips and knees to lower the body, then return to standing."],
          hinge: ["Stand holding dumbbells beside the thighs with a slight knee bend.", "Move the hips back as the torso inclines and the weights lower, then return upright."],
          "split-squat": ["Take a split stance and hold a dumbbell at each side.", "Lower in place by bending both knees, then rise. Repeat with the opposite leg forward."],
        };
        rpcAs(manifest.userId, "edit_submission_classifications", { p_submission_id: item.submission,
          p_patch: { movement_patterns: [patterns[style]], joint_actions: actions[style].map(slug => ({ slug, role: "primary" })),
            mechanic: "compound", force_type: style === "row" || style === "hinge" ? "pull" : "push",
            laterality: style === "split-squat" ? "unilateral" : "bilateral", resistance_source: "free-weight",
            setup_instructions: instructions[style][0], execution_instructions: instructions[style][1] },
          p_comment: "Add original setup instructions and normalized classifications for the inspected demonstration." });
      }
      rpcAs(manifest.userId, "approve_submission", { p_submission_id: item.submission, p_slug: item.slug, ...(item.id ? { p_candidate_exercise_id: item.id } : {}), p_comment: "Local catalogue curation: distinct Z-Anatomy demonstration with matching equipment; grip and motion visually checked." });
      item.published = true;
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      console.log(`Published ${item.slug}`);
    }
  } else throw new Error("Use prepare, preview, render, or publish");
}
