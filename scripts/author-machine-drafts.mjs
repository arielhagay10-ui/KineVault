// Creates private, editable machine demonstrations using the existing owner RPCs.
// Pass the owner ID verified from the signed-in user's existing library.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ownerId = process.argv[2];
if (!/^[0-9a-f-]{36}$/.test(ownerId ?? "")) throw Error("Pass the verified local owner UUID");
const directory = resolve(".local-artifacts/machines");
await mkdir(directory, { recursive: true });
execFileSync(process.execPath, ["node_modules/typescript/bin/tsc", "src/lib/motion/studio-machines.ts", "--outDir", `${directory}/tools`, "--module", "commonjs", "--target", "es2020", "--esModuleInterop", "--skipLibCheck"], { stdio: "inherit" });
const { machineDemoScene } = (await import(pathToFileURL(`${directory}/tools/studio-machines.js`).href)).default;
const manifestPath = `${directory}/manifest.json`;
const manifest = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, "utf8")) : { ownerId, drafts: [] };
if (manifest.ownerId !== ownerId) throw Error("Manifest belongs to another owner");
const checkpoint = () => writeFile(manifestPath, JSON.stringify(manifest, null, 2));
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
const sql = query => execFileSync("docker", ["exec", "supabase_db_kinevault", "psql", "-U", "postgres", "-d", "postgres", "-Atq", "-v", "ON_ERROR_STOP=1", "-c", query], { encoding: "utf8" }).trim();
function rpc(name, args) {
  const parameters = Object.entries(args).map(([key, value]) => `${key} => ${literal(typeof value === "object" ? JSON.stringify(value) : value)}`).join(",");
  return JSON.parse(sql(`begin; set local request.jwt.claim.sub=${literal(ownerId)}; set local role authenticated; select to_jsonb(public.${name}(${parameters})); commit;`));
}
const specs = [
  { slug: "lat-pulldown-machine", name: "Supinated Lat Pulldown", family: "lat-pulldown", primary: "latissimus-dorsi", secondary: "biceps-brachii", body_position: "seated", force_type: "pull", actions: ["shoulder-extension", "elbow-flexion"], joints: ["shoulder", "elbow"], pattern: "vertical-pull", grip: "supinated",
    description: "Seated bilateral underhand pulldown with a fixed overhead pulley, moving weight stack and thigh support.",
    setup: "Sit facing forward with both feet planted. Set the thigh pad above the thighs and hold the bar with palms facing toward you.",
    execution: "Pull the bar toward the upper chest, keeping the torso upright. Return under control until the arms are comfortably extended.",
    cues: "Keep the wrists straight, elbows under the bar and feet still. Avoid pulling behind the neck.", reference: "https://hasfit.com/exercises/back/lat-pulldown/" },
  { slug: "smith-machine", name: "Smith Machine Sissy Squat", family: "squat", primary: "quadriceps", secondary: "gluteus-maximus", body_position: "standing", force_type: "push", actions: ["knee-extension"], joints: ["hip", "knee"], pattern: "squat", grip: "pronated",
    description: "Knee-dominant Smith machine sissy squat with a guided bar, tall rails, rack hooks and safety stops.",
    setup: "Place the bar across the upper back. Set the safety stops below your comfortable squat depth. Stand with feet about shoulder width and hold the bar with both hands.",
    execution: "Bend the knees to lower the body under control, keeping the torso relatively upright and the bar on its guide rails. Extend the knees to return.",
    cues: "Keep the whole foot planted and knees aligned with the toes. Use a comfortable depth and avoid bouncing.", reference: "https://www.lifefitness.com/en-us/catalog/strength-training/plate-loaded/plate-loaded-vertical-smith-machine" },
  { slug: "leg-press", name: "45-Degree Leg Press", family: "squat", primary: "quadriceps", secondary: "gluteus-maximus", body_position: "seated", force_type: "push", actions: ["hip-extension", "knee-extension"], joints: ["hip", "knee"], pattern: "squat", grip: "neutral",
    description: "Bilateral 45-degree sled press with back support, fixed guide rails, side handles and a moving footplate.",
    setup: "Sit against the back pad and place both feet on the platform about hip width. Hold the side handles and set the safety catches for a comfortable range.",
    execution: "Extend the hips and knees to move the sled up the rails. Lower slowly without lifting the pelvis or heels from their supports.",
    cues: "Keep the back against the pad and knees aligned with the feet. Finish with a slight knee bend.", reference: "https://www.lifefitness.com/en-us/catalog/strength-training/plate-loaded/life-fitness-linear-leg-press" },
];
specs.push({ ...specs[0], name: "Frontal Lat Pulldown", grip: "pronated", actions: ["shoulder-adduction", "elbow-flexion"],
  reference: "https://www.acefitness.org/resources/everyone/exercise-library/158/seated-lat-pulldown/",
  description: "Seated overhand pulldown with shoulder adduction in the frontal plane. Both elbows travel sideways while the cable and weight stack follow the bar.",
  setup: "Sit with both feet planted and thighs under the support. Hold the bar with an overhand grip, palms facing away from you.",
  execution: "Bring the elbows down at the sides to lower the bar toward the upper chest. Return slowly with both shoulders moving in the frontal plane.",
});
for (const spec of specs) {
  const frontal = spec.name === "Frontal Lat Pulldown";
  let record = manifest.drafts.find(draft => draft.slug === spec.slug && !!draft.frontal === frontal);
  if (!record) {
    const existing = sql(`select p.id from public.private_exercises p join public.exercise_content c on c.id=p.content_id where p.owner_id=${literal(ownerId)} and lower(c.name)=${literal(spec.name.toLowerCase())};`);
    if (existing) throw Error(`Inspect existing ${spec.name} draft before creating a duplicate`);
    const patch = { name: spec.name, family: spec.family, description: spec.description,
      muscles: [{ slug: spec.primary, role: "primary" }, { slug: spec.secondary, role: "secondary" }],
      joints: spec.joints.map(slug => ({ slug, role: "primary" })), joint_actions: spec.actions.map(slug => ({ slug, role: "primary" })),
      equipment: [{ slug: spec.slug, role: "required" }], movement_patterns: [spec.pattern],
      body_position: spec.body_position, grip: spec.grip, plane: frontal ? "frontal" : "sagittal", resistance_source: "machine", resistance_profile: "unknown", peak_resistance_position: "unknown",
      difficulty: "beginner", exercise_type: "strength", mechanic: "compound", force_type: spec.force_type, laterality: "bilateral",
      setup_instructions: spec.setup, execution_instructions: spec.execution, form_cues: spec.cues,
      common_mistakes: "Using more travel than the supports allow, moving too quickly, or losing hand or foot contact.",
      range_of_motion_notes: "Use a comfortable range while maintaining support contact.", reviewer_notes: `Original draft instructions. Reference: ${spec.reference}. Awaiting the owner's final review and publication.` };
    record = { slug: spec.slug, frontal, name: spec.name, privateId: rpc("save_private_metadata", { p_patch: patch }), objectId: randomUUID() };
    manifest.drafts.push(record); await checkpoint();
  }
  if (process.argv.includes("--revise-metadata") && record.sceneSaved && spec.slug !== "leg-press") {
    rpc("save_private_metadata", { p_private_id: record.privateId, p_patch: { name: spec.name, description: spec.description, setup_instructions: spec.setup, execution_instructions: spec.execution, grip: spec.grip, plane: frontal ? "frontal" : "sagittal", joint_actions: spec.actions.map(slug => ({ slug, role: "primary" })) } });
    record.name = spec.name; await checkpoint();
  }
  if (record.sceneSaved && process.argv.includes("--add-base-poses")) {
    const saved = JSON.parse(sql(`select jsonb_build_object('durationMs',s.duration_ms,'cameraAngle',s.default_camera_angle,'motionStyle',s.motion_style,'studio',s.studio_layout,'equipment',null,'annotations','[]'::jsonb,'keyframes',(select jsonb_agg(jsonb_build_object('timeMs',f.position_ms,'poses',jsonb_build_object('torso',jsonb_build_object('x',0,'y',0,'z',0))) order by f.position_ms) from public.motion_keyframes f where f.scene_id=s.id)) from public.exercise_scenes s join public.private_exercises e on e.content_id=s.content_id where e.id=${literal(record.privateId)} and e.owner_id=${literal(ownerId)} and not exists(select 1 from public.motion_keyframes f join public.motion_joint_poses p on p.keyframe_id=f.id where f.scene_id=s.id) and not exists(select 1 from public.scene_equipment where scene_id=s.id) and not exists(select 1 from public.motion_phase_annotations where scene_id=s.id);`) || "null");
    if (saved) rpc("save_private_scene", { p_private_id: record.privateId, p_scene: saved });
  }
  if (record.sceneSaved && !process.argv.includes("--refresh-scenes")) { console.log(`Existing draft ${record.name}: ${record.privateId}`); continue; }
  const scene = machineDemoScene(spec.slug, record.objectId, spec.slug === "lat-pulldown-machine" ? spec.grip : undefined);
  rpc("save_private_scene", { p_private_id: record.privateId, p_scene: scene });
  record.sceneSaved = true; await checkpoint();
  await writeFile(`${directory}/${spec.slug}${frontal ? '-frontal' : ''}-scene.json`, JSON.stringify(scene, null, 2));
  console.log(`Created editable draft ${record.name}: ${record.privateId}`);
}
await writeFile(`${directory}/motion-contract.md`, "Each scene is one 4.8-second rep with 17 keyframes and cosine travel.\nSupinated pulldown: overhead to upper chest and return; palms toward the body, neutral wrists, seat/thigh support; resistance toward the overhead pulley.\nFrontal pulldown: overhand grip, elbows in the shoulder frontal plane, shaft across closed fingers, wrist bend below 35 degrees, same supports; 0.93m vertical bar travel.\nSmith machine sissy squat: accepted knee-dominant motion, 0.65m guided descent/return; bar supported across upper back, elbows below/slightly behind shoulders, wrist bend below 35 degrees, fingers wrap around 0.025m bar; frame clears standing head; plates clear uprights.\nLeg press: fixed pelvis/back, feet on 45-degree footplate, 0.4m upward/forward sled travel and return; hands on fixed handles.\nMachine placement, scale, grip and carriage keyframes remain editable. Drafts stay private.\n");
