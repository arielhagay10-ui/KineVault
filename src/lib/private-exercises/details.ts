import type { WorkshopScene } from "@/lib/motion/workshop";
import type { Option } from "./options";

const familiarAreas: [RegExp, string][] = [
  [/deltoid/, "shoulder shoulders delts"], [/pector/, "chest pecs"],
  [/latissimus|trapezius|rhomboid/, "back lats traps"], [/biceps(?![ -]femoris)|brachialis/, "upper arm arms biceps"],
  [/triceps/, "upper arm arms triceps"], [/abdom|oblique/, "abs stomach core waist"],
  [/glute/, "butt hips glutes"], [/quadriceps|rectus[ -]femoris|vastus/, "thigh thighs legs quads"],
  [/hamstring|biceps[ -]femoris|semitend|semimembran/, "back thigh thighs legs hamstrings"],
  [/gastrocnemius|soleus/, "calf calves lower leg legs"], [/scapul/, "shoulder blade shoulders"],
  [/abduction/, "raise outward away"], [/adduction/, "bring together inward"],
  [/flexion/, "bend bending"], [/extension/, "straighten straightening"],
];

export function searchPrivateOptions(options: readonly Option[], query: string): Option[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return options.filter(option => {
    const formal = `${option.name} ${option.slug}`.toLowerCase().replaceAll("-", " ");
    const text = `${formal} ${familiarAreas.filter(([pattern]) => pattern.test(formal)).map(([, terms]) => terms).join(" ")}`;
    return words.every(word => text.includes(word));
  });
}

// These are suggestions from explicit scene objects/supports, never anatomy guesses.
export function suggestSceneDetails(scene: WorkshopScene, equipmentOptions: readonly Option[], positions: readonly Option[]) {
  const mapping: Record<string, string> = { "single-cable": "cable", "cable-machine": "cable", "dumbbell-pair": "dumbbell" };
  const sceneSlugs = [...(scene.studio?.objects ?? []).map(object => object.slug), ...(scene.equipment ? [scene.equipment.slug] : [])];
  const equipment = [...new Set(sceneSlugs.map(slug => mapping[slug] ?? slug))]
    .filter(slug => equipmentOptions.some(option => option.slug === slug));
  const seated = Boolean(scene.studio?.seating && scene.studio.seating.facing !== "back") || scene.studio?.objects.some(object =>
    object.machineUse && ["lat-pulldown-machine", "cable-row-machine", "pec-deck", "leg-press"].includes(object.slug));
  const bodyPosition = seated && positions.some(option => option.slug === "seated") ? "seated" : null;
  return { equipment, bodyPosition };
}
