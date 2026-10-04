// Single-exercise local authoring; every stage checkpoints for safe resumption.
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { seatedCurlScene } from "../src/lib/motion/seated-curl.ts";
import { inclineCurlScene } from "../src/lib/motion/incline-curl.ts";
const incline = process.argv.includes("--incline");
const slug = incline ? "incline-dumbbell-curl" : "seated-dumbbell-curl";
const name = incline ? "Incline Dumbbell Curl" : "Seated Dumbbell Curl";
const authoredScene = incline ? inclineCurlScene : seatedCurlScene;
import { captureMotion } from "./lib/capture-motion.mjs";
import { requireCurrentCurationClaim } from "./lib/curation-claim.mjs";

process.loadEnvFile(".env.local");
const app = process.env.RENDER_APP_URL ?? "http://127.0.0.1:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
for (const value of [app, url]) if (!["localhost", "127.0.0.1"].includes(new URL(value).hostname)) throw Error("Local services required");
const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const directory = resolve(`.local-artifacts/${slug}`);
await mkdir(directory, { recursive: true });
const manifestPath = resolve(directory, "manifest.json");
const manifest = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, "utf8")) : { slug };
const checkpoint = () => writeFile(manifestPath, JSON.stringify(manifest, null, 2));
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
const sql = query => execFileSync("docker", ["exec", "supabase_db_kinevault", "psql", "-U", "postgres", "-d", "postgres", "-Atq", "-v", "ON_ERROR_STOP=1", "-c", query], { encoding: "utf8" }).trim();
function rpcAs(name, args) {
  if (!/^[0-9a-f-]{36}$/.test(manifest.userId)) throw Error("A valid existing curator is required");
  const parameters = Object.entries(args).map(([key, value]) => `${key} => ${literal(typeof value === "object" ? JSON.stringify(value) : value)}`).join(",");
  return JSON.parse(sql(`begin; set local request.jwt.claim.sub=${literal(manifest.userId)}; set local role authenticated; select to_jsonb(public.${name}(${parameters})); commit;`));
}
async function rpc(name, args = {}) {
  const { data, error } = await service.rpc(name, args);
  if (error) throw error;
  return data;
}
const mode = process.argv[2];
if (mode === "prepare") {
  const existing = sql(`select e.id from public.exercises e join public.exercise_content c on c.id=e.current_content_id where e.slug=${literal(slug)} or lower(c.name)=${literal(name.toLowerCase())};`);
  if (existing) throw Error(`An existing ${name} must be reused`);
  if (!manifest.userId) {
    // Reuse the existing local curator; do not grant any new roles.
    manifest.userId = JSON.parse(await readFile(".local-artifacts/full-body-curation/manifest.json", "utf8")).userId;
    await checkpoint();
  }
  if (!manifest.draft) {
    const drafts = sql(`select p.id from public.private_exercises p join public.exercise_content c on c.id=p.content_id where lower(c.name)=${literal(name.toLowerCase())};`);
    if (drafts) throw Error(`Existing ${name} drafts need inspection before reuse`);
    manifest.draft = rpcAs("save_private_metadata", { p_patch: {
      name, family: "curl",
      description: incline ? "A bilateral dumbbell curl performed with the back supported by a 45-degree incline bench and the upper arms hanging beside the torso." : "A seated curl using two dumbbells with a palms-forward grip. Both elbows bend together while the torso remains upright.",
      muscles: [{ slug: "biceps-brachii", role: "primary" }, { slug: "brachialis", role: "secondary" }],
      joints: [{ slug: "elbow", role: "primary" }], joint_actions: [{ slug: "elbow-flexion", role: "primary" }],
      equipment: [{ slug: "dumbbell", role: "required" }, { slug: "bench", role: "required" }],
      movement_patterns: ["isolation"], body_position: "seated", grip: "supinated", plane: "sagittal",
      resistance_source: "free-weight", resistance_profile: "bell_shaped", peak_resistance_position: "middle",
      difficulty: "beginner", exercise_type: "strength", mechanic: "isolation", force_type: "pull", laterality: "bilateral",
      setup_instructions: incline ? "Set the backrest to about 45 degrees and sit with your back and head supported. Plant both feet. Hold a dumbbell in each hand with palms facing forward and let the upper arms hang beside the bench." : "Sit upright on a stable bench with both feet flat. Hold one dumbbell in each hand, arms beside the torso and palms facing forward. Wrap your thumbs around the handles.",
      execution_instructions: "Bend both elbows to lift the dumbbells toward the shoulders. Keep the upper arms quiet and the wrists straight. Lower both weights under control to the starting position.",
      form_cues: incline ? "Keep the back on the pad, shoulders relaxed and upper arms still. Keep the wrists straight and lower slowly." : "Keep the chest tall, shoulders relaxed and feet still. Move through a comfortable range without swinging.",
      common_mistakes: "Rocking the torso, lifting the elbows to swing the weights, bending the wrists, or dropping the weights on the return.",
      range_of_motion_notes: "Start with nearly straight elbows and curl only as far as the wrists can remain neutral.",
      reviewer_notes: incline ? "Original instructions and adjustable bench model. Technique reference: https://www.muscleandstrength.com/exercises/incline-dumbbell-curl.html" : "Original instructions; technique reference: https://www.acefitness.org/resources/everyone/exercise-library/44/seated-biceps-curl/",
    } });
    await checkpoint();
  }
  if (manifest.submission) throw Error("Submitted scene is frozen");
  rpcAs("save_private_scene", { p_private_id: manifest.draft, p_scene: authoredScene });
  if (!manifest.shareToken) {
    manifest.shareToken = randomBytes(32).toString("base64url");
    await checkpoint();
    rpcAs("replace_private_share", { p_private_id: manifest.draft, p_token_hash: createHash("sha256").update(manifest.shareToken).digest("hex") });
  }
  await writeFile(resolve(directory, "motion-contract.md"), `${name}, 4.8 seconds.\nStart/end: elbows 10 degrees, upper arms hang vertically. Peak at 2.4 seconds: elbows 115 degrees.\nGravity down; palms supinated, no wrist bend or forearm twist. Torso and elbows stay quiet.\n${incline ? "Torso reclines 45 degrees; padded backrest supports the back and head. Adjustable steel bench has separate seat, hinge, brace and rubber feet." : "Torso stays upright."}\nSeat supports pelvis; both feet stay flat. Complete dumbbells clear hips, thighs, torso and bench.\nCosine-spaced keyframes ease reversals. Biceps highlighted; preserve Z-Anatomy and BodyParts3D credit.\n`);
  console.log(`Prepared draft ${manifest.draft}`);
} else if (mode === "submit") {
  if (!manifest.submission) {
    manifest.submission = rpcAs("submit_private_exercise", { p_private_id: manifest.draft, p_duplicate_disposition: "new" });
    await checkpoint();
  }
  console.log(`Submitted ${manifest.submission}`);
} else if (mode === "claim") {
  if (!manifest.job) {
    const pending = sql("select s.id from public.render_jobs j join public.exercise_submissions s on s.original_content_id=(select content_id from public.exercise_scenes where id=j.scene_id) where j.status in ('queued','running') order by j.queued_at,j.id;").split("\n");
    if (pending.length !== 1 || pending[0] !== manifest.submission) throw Error("Unrelated jobs exist; leave them untouched");
    const [job] = await rpc("claim_render_job");
    if (job?.submission_id !== manifest.submission || !job.claim_id) throw Error("Unexpected job or missing claim identifier");
    manifest.job = job.job_id;
    manifest.claimId = job.claim_id;
    await checkpoint();
  } else await requireCurrentCurationClaim(service, manifest);
  console.log(`Claimed ${manifest.job}`);
} else if (mode === "render") {
  if (manifest.rendered) throw Error("Render already completed");
  await requireCurrentCurationClaim(service, manifest);
  const scene = await rpc("read_render_scene", { p_job_id: manifest.job });
  const files = await captureMotion({ scene, pageUrl: `${app}/internal/render/${manifest.job}`, token: process.env.RENDER_WORKER_TOKEN, directory });
  const paths = {};
  for (const [kind, file] of Object.entries(files)) {
    paths[kind] = `${manifest.submission}/${manifest.job}/${manifest.claimId}/${kind === "poster" ? "poster.webp" : `demo.${kind}`}`;
    const { data: exists } = await service.storage.from("exercise-private").exists(paths[kind]);
    if (!exists) {
      const { error } = await service.storage.from("exercise-private").upload(paths[kind], await readFile(file), { contentType: kind === "poster" ? "image/webp" : `video/${kind}` });
      if (error) throw error;
    }
  }
  await rpc("complete_render_job", { p_job_id: manifest.job, p_claim_id: manifest.claimId, p_asset_group_id: randomUUID(), p_webm_path: paths.webm, p_mp4_path: paths.mp4, p_poster_path: paths.poster });
  manifest.rendered = true; manifest.paths = paths;
  await checkpoint();
  console.log(`Rendered ${name}`);
} else if (mode === "publish") {
  if (!manifest.rendered || manifest.published) throw Error("Require an inspected render awaiting publication");
  for (const [kind, path] of Object.entries(manifest.paths)) {
    const destination = `submissions/${manifest.submission}/demo.${kind === "poster" ? "webp" : kind}`;
    const { data: exists } = await service.storage.from("exercise-public").exists(destination);
    if (!exists) {
      const { error } = await service.storage.from("exercise-private").copy(path, destination, { destinationBucket: "exercise-public" });
      if (error) throw error;
    }
  }
  const status = sql(`select status from public.exercise_submissions where id=${literal(manifest.submission)};`);
  if (status === "submitted") rpcAs("begin_submission_review", { p_submission_id: manifest.submission });
  rpcAs("approve_submission", { p_submission_id: manifest.submission, p_slug: manifest.slug,
    p_comment: `${name}: inspected in two views, full-cycle geometry checks and normal/slow playback; original instructions and anatomy attribution retained.` });
  manifest.published = true;
  await checkpoint();
  console.log(`Published ${app}/exercises/${manifest.slug}`);
} else throw Error("Use prepare, submit, claim, render or publish");
