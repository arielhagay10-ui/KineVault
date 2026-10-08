import { createStudioObject, sampleStudioObject, studioAssetNames } from "./studio";
import { isStudioMachine, rowHandleHeight } from "./studio-machines";
import { blankWorkshopScene, identityTransform, jointLimits, jointSlugs, studioAssetSlugs, type JointSlug, type RigPose, type SceneTransform, type StudioObject, type WorkshopScene } from "./workshop";

export interface EquipmentOption { slug: string; label: string; active?: boolean }
export const popularWorkshopEquipment = ["dumbbell", "barbell", "kettlebell", "cable-machine", "bench", "squat-rack"] as const;
export function workshopDemonstrationCaption(object: Pick<StudioObject, "slug" | "machineMode">, timeMs: number, durationMs: number) {
  if (timeMs < durationMs / 4) return "Start: check hands, feet and supports.";
  if (timeMs >= durationMs * .65) return "Return slowly to the start; keep the same contacts.";
  switch (object.slug) {
    case "cable-row-machine": return "Pull to the torso; elbows stay beside the body.";
    case "pec-deck": return object.machineMode === "reverse" ? "Open both arms with the chest supported." : "Close both arms in front of the chest.";
    case "lat-pulldown-machine": return "Pull the bar down toward the upper chest; keep the seat contact.";
    case "smith-machine": return "Move the bar along its guides; keep both feet planted.";
    case "leg-press": return "Push the platform away, then return while keeping the back supported.";
    default: return "Move through the chosen travel and inspect the intended contacts.";
  }
}
const aliases: Record<string, StudioObject["slug"]> = { "dumbbell-pair": "dumbbell", "single-cable": "cable-machine" };
const synonyms: Record<string, string[]> = {
  "cable-machine": ["single cable", "pulley", "functional trainer", "cable station"],
  "cable-row-machine": ["seated row", "seated rowing", "rowing machine", "low row"],
  "pec-deck": ["chest fly", "chest machine", "butterfly", "reverse fly", "rear delt fly"],
  "lat-pulldown-machine": ["lat pull down", "pulldown", "back machine"],
  "smith-machine": ["guided bar", "smith rack"], "leg-press": ["sled", "leg machine"],
  bench: ["seat", "incline seat", "flat bench", "incline bench", "weight bench"],
  "squat-rack": ["power rack", "power cage", "squat stand"],
  barbell: ["bar", "free weight bar"], dumbbell: ["hand weight", "dumbbell pair", "free weights"], kettlebell: ["kettle bell", "bell weight"],
};
const normalize = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function editDistance(first: string, second: string) {
  const rows = Array.from({ length: first.length + 1 }, (_, index) => [index, ...Array<number>(second.length).fill(0)]);
  rows[0] = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let i = 1; i <= first.length; i++) {
    for (let j = 1; j <= second.length; j++) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (first[i - 1] === second[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && first[i - 1] === second[j - 2] && first[i - 2] === second[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  }
  return rows[first.length][second.length];
}

/** Caller assets are merged with every supported studio asset, including machines. */
export function workshopEquipmentOptions(options: EquipmentOption[] = []): EquipmentOption[] {
  const supported = new Map<string, EquipmentOption>(studioAssetSlugs.map(slug => [slug, { slug, label: studioAssetNames[slug] }]));
  for (const option of options) {
    const slug = aliases[option.slug] ?? option.slug;
    if (supported.has(slug) && !aliases[option.slug]) supported.set(slug, { ...option, slug });
    else if (!supported.has(slug)) supported.set(slug, option);
  }
  return [...supported.values()];
}

export function searchWorkshopEquipment(options: EquipmentOption[], query: string): EquipmentOption[] {
  const needle = normalize(query.slice(0, 160)), words = needle.split(" ");
  return options.filter(option => option.active !== false).map(option => {
    const terms = [option.label, option.slug, ...(synonyms[aliases[option.slug] ?? option.slug] ?? [])].map(normalize);
    const score = !needle ? 0 : Math.min(...terms.map(term => {
      if (term === needle) return 0;
      if (term.includes(needle)) return 1;
      if (words.every(word => term.split(" ").some(part => part.startsWith(word)))) return 2;
      const distance = editDistance(needle, term);
      if (needle.length >= 4 && distance <= Math.max(1, Math.floor(needle.length / 5))) return 3 + distance / 10;
      if (words.every(word => term.split(" ").some(part => word.length >= 4 && editDistance(word, part) <= Math.max(1, Math.floor(word.length / 5))))) return 4;
      return Infinity;
    }));
    return { option, score };
  }).filter(item => Number.isFinite(item.score)).sort((a, b) => a.score - b.score).map(item => item.option);
}

export function equipmentGroup(slug: string): "Machines" | "Weights" | "Supports" {
  const canonical = aliases[slug] ?? slug;
  return ["barbell", "dumbbell", "kettlebell"].includes(canonical) ? "Weights" : ["bench", "squat-rack"].includes(canonical) ? "Supports" : "Machines";
}

export function createQuickScene(slug: string): WorkshopScene {
  const canonical = aliases[slug] ?? slug;
  if (!studioAssetSlugs.some(asset => asset === canonical)) throw new Error("This equipment has no workshop model. Choose a listed machine, weight or support.");
  const scene = structuredClone(blankWorkshopScene);
  const object = createStudioObject(canonical as StudioObject["slug"], crypto.randomUUID(), 0);
  scene.studio!.presentation = { highlight: "none", isolate: false, view: "three_quarter" };
  if (isStudioMachine(canonical)) {
    Object.assign(object, identityTransform, { machineUse: true, machinePosition: canonical === "smith-machine" ? 1 : 0 });
    if (canonical === "lat-pulldown-machine") object.machineGrip = "supinated";
    if (canonical === "pec-deck") object.machineMode = "regular";
  } else if (["barbell", "dumbbell", "kettlebell"].includes(canonical)) {
    object.attachment = canonical === "dumbbell" ? "left" : "both";
  } else if (canonical === "cable-machine") {
    Object.assign(object, { x: 0.95, z: 1.2, attachment: "left", cableAttachment: "d-handle" });
  }
  scene.studio!.objects.push(object);
  if (slug === "dumbbell-pair") scene.studio!.objects.push({ ...object, id: crypto.randomUUID(), attachment: "right", x: -object.x });
  return isStudioMachine(canonical) ? generateMachineRepetition(scene, object.id, canonical === "smith-machine" ? 1 : 0, canonical === "smith-machine" ? 0 : 1) : scene;
}

function transformAt(object: StudioObject, timeMs: number): SceneTransform {
  const sampled = sampleStudioObject(object, timeMs), result = { ...identityTransform };
  for (const key of Object.keys(result) as (keyof SceneTransform)[]) result[key] = sampled[key];
  return result;
}

/** Replace only selected-machine travel. Existing poses, placement frames and anatomy remain authored. */
export function generateMachineRepetition(scene: WorkshopScene, objectId: string, start: number, finish: number, heights?: { start: number; finish: number }): WorkshopScene {
  if (![start, finish].every(value => Number.isFinite(value) && value >= 0 && value <= 1)) throw new Error("Start and finish must be between 0 and 1.");
  const object = scene.studio?.objects.find(item => item.id === objectId);
  if (!object || !isStudioMachine(object.slug)) throw new Error("Select a supported machine before generating its movement.");
  if (heights && (object.slug !== "cable-row-machine" || ![heights.start, heights.finish].every(value => Number.isFinite(value) && value >= rowHandleHeight.min && value <= rowHandleHeight.max))) throw new Error("Cable row handle heights must be between 0.7 and 1.85 meters at standard size.");
  const midpoint = Math.round(scene.durationMs / 2);
  const requiredTimes = new Set([0, midpoint, scene.durationMs, ...(object.frames ?? []).map(frame => frame.timeMs)]);
  if (requiredTimes.size > 24) throw new Error("This machine already has 24 placement moments. Remove a moment in Advanced before adding the start, finish and return.");
  for (let index = 0; index <= 16 && requiredTimes.size < 24; index++) requiredTimes.add(Math.round(scene.durationMs * index / 16));
  const frames = [...requiredTimes].sort((a, b) => a - b).map(timeMs => {
    const halfProgress = timeMs <= midpoint ? timeMs / midpoint : (scene.durationMs - timeMs) / (scene.durationMs - midpoint);
    const blend = (1 - Math.cos(Math.PI * halfProgress)) / 2;
    const height = heights ? heights.start + (heights.finish - heights.start) * blend : sampleStudioObject(object, timeMs).machineHandleHeight;
    return { ...transformAt(object, timeMs), timeMs, machinePosition: start + (finish - start) * blend, ...(height !== undefined ? { machineHandleHeight: height } : {}) };
  });
  return { ...scene, studio: { ...scene.studio!, objects: scene.studio!.objects.map(item => item.id === objectId ? { ...item, machinePosition: start, ...(heights ? { machineHandleHeight: heights.start } : {}), frames } : item) } };
}

function assertPoseIndex(scene: WorkshopScene, index: number) {
  if (!Number.isInteger(index) || !scene.keyframes[index]) throw new Error("Choose an existing pose moment.");
}

export function copyWorkshopPose(scene: WorkshopScene, sourceIndex: number, targetIndex: number | "all"): WorkshopScene {
  assertPoseIndex(scene, sourceIndex);
  if (targetIndex !== "all") assertPoseIndex(scene, targetIndex);
  return { ...scene, keyframes: scene.keyframes.map((frame, index) => index === targetIndex || targetIndex === "all" ? { ...frame, poses: structuredClone(scene.keyframes[sourceIndex].poses) } : frame) };
}

export function mirrorWorkshopPose(scene: WorkshopScene, index: number): WorkshopScene {
  assertPoseIndex(scene, index);
  const poses: RigPose = {};
  for (const slug of jointSlugs) {
    const angle = scene.keyframes[index].poses[slug];
    if (!angle) continue;
    const opposite = (slug.startsWith("left-") ? slug.replace("left-", "right-") : slug.startsWith("right-") ? slug.replace("right-", "left-") : slug) as JointSlug;
    // Wrist X/Y encode anatomical turn/flexion, already side-aware in the rig.
    const mirrored = { x: angle.x, y: slug.endsWith("wrist") ? angle.y : -angle.y, z: -angle.z };
    for (const axis of ["x", "y", "z"] as const) mirrored[axis] = Math.max(jointLimits[opposite][axis][0], Math.min(jointLimits[opposite][axis][1], mirrored[axis]));
    poses[opposite] = mirrored;
  }
  return { ...scene, keyframes: scene.keyframes.map((frame, frameIndex) => frameIndex === index ? { ...frame, poses } : frame) };
}

export function matchWorkshopLoop(scene: WorkshopScene): WorkshopScene {
  const matched = copyWorkshopPose(scene, 0, scene.keyframes.length - 1);
  if (!scene.studio) return matched;
  return { ...matched, studio: { ...scene.studio, objects: scene.studio.objects.map(object => {
    if (!object.frames?.length) return object;
    const start = object.frames[0];
    const frames = object.frames.filter(frame => frame.timeMs !== scene.durationMs);
    if (frames.length >= 24) throw new Error("Remove an equipment moment in Advanced before matching the loop.");
    return { ...object, frames: [...frames, { ...start, timeMs: scene.durationMs }] };
  }) } };
}

export type EquipmentPreferences = { recent: string[]; favorites: string[] };
export function equipmentPreferencesKey(ownerKey: string) { return `kinevault:workshop-equipment:v1:${encodeURIComponent(ownerKey)}`; }
export function readEquipmentPreferences(value: string | null): EquipmentPreferences {
  try {
    const parsed: unknown = JSON.parse(value ?? "null");
    if (!parsed || typeof parsed !== "object") return { recent: [], favorites: [] };
    const object = parsed as Record<string, unknown>;
    const known = (items: unknown) => Array.isArray(items) ? [...new Set(items.filter((slug): slug is string => typeof slug === "string" && studioAssetSlugs.some(asset => asset === slug)))].slice(0, 20) : [];
    return { recent: known(object.recent).slice(0, 6), favorites: known(object.favorites) };
  } catch { return { recent: [], favorites: [] }; }
}
