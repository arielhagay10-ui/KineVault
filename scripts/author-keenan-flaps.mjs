// Persistent local workshop test. Reuses its draft and normal authoring APIs.
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const directory = resolve(".local-artifacts/workshop/keenan-flaps");
const manifestPath = resolve(directory, "manifest.json");
await mkdir(directory, { recursive: true });
const scene = JSON.parse(await readFile(resolve(directory, "scene.json"), "utf8"));
const manifest = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, "utf8")) : {};
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
const sql = query => execFileSync("docker", ["exec", "supabase_db_kinevault", "psql", "-U", "postgres", "-d", "postgres", "-Atq", "-v", "ON_ERROR_STOP=1", "-c", query], { encoding: "utf8" }).trim();
const checkpoint = () => writeFile(manifestPath, JSON.stringify(manifest, null, 2));
manifest.userId ??= JSON.parse(await readFile(".local-artifacts/full-body-curation/manifest.json", "utf8")).userId;
if (!/^[0-9a-f-]{36}$/.test(manifest.userId)) throw Error("An existing local author is required");
function rpcAs(name, args) {
  const parameters = Object.entries(args).map(([key, value]) => `${key} => ${literal(typeof value === "object" ? JSON.stringify(value) : value)}`).join(",");
  return JSON.parse(sql(`begin; set local request.jwt.claim.sub=${literal(manifest.userId)}; set local role authenticated; select to_jsonb(public.${name}(${parameters})); commit;`));
}
const name = "Keenan Flaps · Workshop Test";
if (!manifest.draft) {
  const published = sql("select slug from public.exercises where slug ilike '%keenan%';");
  if (published) throw Error("Inspect the existing Keenan exercise before creating a test draft");
  const drafts = sql(`select p.id from public.private_exercises p join public.exercise_content c on c.id=p.content_id where p.owner_id=${literal(manifest.userId)} and lower(c.name)=${literal(name.toLowerCase())};`);
  if (drafts.includes("\n")) throw Error("Multiple existing test drafts need inspection");
  if (drafts) manifest.draft = drafts;
}
// Existing movement notes must stop referring to extension before removing it.
if (manifest.draft) rpcAs("save_private_scene", { p_private_id: manifest.draft, p_scene: {
  ...scene, annotations: scene.annotations.map(item => ({ ...item, jointAction: null })),
} });
manifest.draft = rpcAs("save_private_metadata", {
  ...(manifest.draft ? { p_private_id: manifest.draft } : {}),
  p_patch: {
    name, family: "row", description: "A private chest-supported, unilateral upper-arm cuff cable test. The right shoulder adducts in the torso's frontal plane with a fixed elbow bend.",
    muscles: [{ slug: "latissimus-dorsi", role: "primary" }],
    joints: [{ slug: "shoulder", role: "primary" }],
    joint_actions: [{ slug: "shoulder-adduction", role: "primary" }],
    equipment: [{ slug: "cable", role: "required" }, { slug: "bench", role: "required" }],
    attachments: ["arm-cuff"],
    movement_patterns: ["isolation"], body_position: "seated", plane: "frontal",
    resistance_source: "cable", exercise_type: "strength", mechanic: "isolation", force_type: "pull", laterality: "unilateral",
    setup_instructions: "Aim the 65-degree bench toward the cable stack. Sit facing the pad with a small right side bend, supported chest and feet under the bent knees. Set the pulley slightly above the right shoulder at 1.7 m. Connect the cable to a cuff just above the right elbow.",
    execution_instructions: "Pull the right upper arm from out to the side toward the ribs in the torso's frontal plane. Keep the elbow bend fixed, left arm resting and chest supported. Return under control.",
    form_cues: "Keep the supported right side bend steady, feet planted, shins upright and elbow bend constant. The cuff carries the cable load.",
    reviewer_notes: "Private workshop regression demo based on the latest supplied seated reference. Checks bench aim toward the stack, a fixed right side bend, raised pulley, seated knee flexion, final ankle joint limits, save/reload and loop geometry.",
  },
});
await checkpoint();
rpcAs("save_private_scene", { p_private_id: manifest.draft, p_scene: scene });
manifest.shareToken ??= randomBytes(32).toString("base64url");
await checkpoint();
let tokenHash = createHash("sha256").update(manifest.shareToken).digest("hex");
const existingShare = sql(`select revoked_at is null from public.private_exercise_shares where private_exercise_id=${literal(manifest.draft)} and token_hash=${literal(tokenHash)};`);
if (existingShare !== "t") {
  if (existingShare === "f") {
    manifest.shareToken = randomBytes(32).toString("base64url");
    tokenHash = createHash("sha256").update(manifest.shareToken).digest("hex");
    await checkpoint();
  }
  rpcAs("replace_private_share", { p_private_id: manifest.draft, p_token_hash: tokenHash });
}
manifest.previewUrl = `http://127.0.0.1:3000/shared/${manifest.shareToken}`;
await checkpoint();
const savedMetadata = rpcAs("read_shared_private_metadata", { p_token_hash: tokenHash });
const savedScene = rpcAs("read_shared_private_scene", { p_token_hash: tokenHash });
const savedCable = savedScene.studio.objects.find(item => item.slug === "cable-machine");
const expectedCable = scene.studio.objects.find(item => item.slug === "cable-machine");
const savedBench = savedScene.studio.objects.find(item => item.slug === "bench");
const expectedBench = scene.studio.objects.find(item => item.slug === "bench");
if (savedMetadata.laterality !== "unilateral" || savedMetadata.plane !== "frontal"
  || savedScene.studio.frontalPlane !== true
  || savedScene.studio.objects.filter(item => item.slug === "cable-machine").length !== 1
  || savedScene.keyframes.length !== scene.keyframes.length
  || ["x", "z", "rotationY", "pulleyHeight"].some(field => Math.abs(savedCable[field] - expectedCable[field]) > 0.000001)
  || ["rotationY", "benchAngle"].some(field => Math.abs(savedBench[field] - expectedBench[field]) > 0.000001)) throw Error("The saved unilateral demo did not round trip");
await writeFile(resolve(directory, "motion-contract.md"), "Unilateral Keenan flaps workshop test, 4.8 seconds.\nBench: 65-degree backrest aimed toward the stack. Figure seated facing the pad with a constant 8-degree right side bend and no torso twist.\nStart/end: right upper arm out to the side. Midpoint: right upper arm adducted toward ribs. Frontal-plane shoulder lock stays on through all 17 samples.\nRight elbow stays bent 30 degrees; left arm rests with 100-degree elbow bend. Wrists neutral, hands open. One cuff sits above the right elbow.\nPulley: 1.7 m, about 20 cm above the working shoulder. Stack manually placed in front of the bench to match the latest reference; shoulder-side alignment remains an independent editor option.\nPelvis on seat, chest supported, feet under bent knees, shins within 25 degrees of vertical. Final ankles stay inside their existing joint limits after the leg solve and any authored foot rotation. Knees use their anatomical hinge.\nCosine-spaced keyframes ease reversals. Private preview only. Preserve Z-Anatomy and BodyParts3D attribution.\n");
console.log(`Saved Keenan flaps test: ${manifest.previewUrl}`);
