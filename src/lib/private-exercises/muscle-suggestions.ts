import { z } from "zod";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const inputSchema = z.object({
  actions: z.array(slug).max(1000), resistedActions: z.array(slug).max(1000),
  resistanceSource: z.string().nullable(), grip: z.string().nullable(), bodyPosition: z.string().nullable(),
  availableMuscles: z.array(slug).max(1000),
});
export type MuscleSuggestionInput = z.infer<typeof inputSchema>;
export type MuscleRole = "primary" | "secondary" | "stabilizer";
export type MuscleSuggestion = {
  slug: string;
  reasons: { action: string; description: string; source: string }[];
};
export type MuscleSuggestionResult = {
  status: "unknown" | "partial" | "suggestions";
  muscles: MuscleSuggestion[]; unknownActions: string[]; notes: string[];
};

const upperSource = "https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs";
const lowerSource = "https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs";
type Rule = { muscles: readonly string[]; description: string; source: string };
// Contributors to a confirmed resisted action, not a ranking for an entire exercise.
const rules: Readonly<Record<string, Rule>> = {
  "elbow-flexion": { muscles: ["biceps-brachii", "brachialis"], description: "Contributes to bending the elbow against resistance.", source: upperSource },
  "elbow-extension": { muscles: ["triceps-brachii"], description: "Contributes to straightening the elbow against resistance.", source: upperSource },
  "shoulder-flexion": { muscles: ["anterior-deltoid"], description: "Contributes to raising the upper arm forward against resistance.", source: upperSource },
  "shoulder-extension": { muscles: ["latissimus-dorsi", "posterior-deltoid"], description: "Contributes to moving the upper arm backward against resistance.", source: upperSource },
  "shoulder-abduction": { muscles: ["lateral-deltoid"], description: "Contributes to lifting the upper arm sideways against resistance.", source: upperSource },
  "shoulder-adduction": { muscles: ["latissimus-dorsi", "pectoralis-major"], description: "Contributes to bringing the upper arm toward the body against resistance.", source: upperSource },
  "shoulder-horizontal-abduction": { muscles: ["posterior-deltoid"], description: "Contributes to moving the upper arm outward across the horizontal plane against resistance.", source: upperSource },
  "shoulder-horizontal-adduction": { muscles: ["pectoralis-major", "anterior-deltoid"], description: "Contributes to bringing the upper arm across the chest against resistance.", source: upperSource },
  "hip-extension": { muscles: ["gluteus-maximus", "hamstrings"], description: "Contributes to extending the hip against resistance.", source: lowerSource },
  "knee-extension": { muscles: ["quadriceps"], description: "Contributes to straightening the knee against resistance.", source: lowerSource },
  "knee-flexion": { muscles: ["hamstrings"], description: "Contributes to bending the knee against resistance.", source: lowerSource },
  "ankle-plantarflexion": { muscles: ["gastrocnemius", "soleus"], description: "Contributes to plantarflexion against resistance.", source: lowerSource },
};
const oppositePairs = [
  ["elbow-flexion", "elbow-extension"], ["shoulder-flexion", "shoulder-extension"],
  ["shoulder-abduction", "shoulder-adduction"], ["shoulder-horizontal-abduction", "shoulder-horizontal-adduction"],
  ["hip-flexion", "hip-extension"], ["knee-flexion", "knee-extension"], ["ankle-plantarflexion", "ankle-dorsiflexion"],
] as const;

export function suggestWorkingMuscles(raw: unknown): MuscleSuggestionResult {
  const parsed = inputSchema.safeParse(raw);
  const unknown = (note: string): MuscleSuggestionResult => ({ status: "unknown", muscles: [], unknownActions: [], notes: [note] });
  if (!parsed.success) return unknown("Check the selected actions and resistance setup before requesting suggestions.");
  const input = parsed.data;
  if (!input.actions.length) return unknown("Choose the joint actions performed in this exercise first.");
  if (!["free-weight", "cable", "machine", "bodyweight"].includes(input.resistanceSource ?? "")) {
    return unknown("Choose a known resistance source in the exercise details first.");
  }
  if (!input.resistedActions.length) return unknown("Confirm which actions work against resistance. A return movement does not automatically recruit the opposite muscles.");
  if (input.resistedActions.some(action => !input.actions.includes(action))) return unknown("Confirm loading only for joint actions selected for this exercise.");

  const resisted = new Set(input.resistedActions);
  const conflicting = new Set<string>();
  for (const [first, second] of oppositePairs) {
    if (resisted.has(first) && resisted.has(second)) { conflicting.add(first); conflicting.add(second); }
  }
  const notes: string[] = [];
  if (conflicting.size) notes.push("Opposing actions need separate loading reviews. Those actions were left unknown.");
  const muscles = new Map<string, MuscleSuggestion>();
  const unknownActions: string[] = [];
  let incomplete = false;
  for (const action of resisted) {
    const rule = Object.hasOwn(rules, action) ? rules[action] : undefined;
    if (!rule || conflicting.has(action)) { unknownActions.push(action); continue; }
    for (const muscle of rule.muscles) {
      if (action === "hip-extension" && muscle === "hamstrings" && input.actions.some(item => item.startsWith("knee-"))) {
        notes.push("Hamstring involvement in hip extension needs review when the knee also moves.");
        incomplete = true;
        continue;
      }
      if (!input.availableMuscles.includes(muscle)) { incomplete = true; continue; }
      const candidate = muscles.get(muscle) ?? { slug: muscle, reasons: [] };
      candidate.reasons.push({ action, description: rule.description, source: rule.source });
      muscles.set(muscle, candidate);
    }
  }
  if (incomplete) notes.push("Some contributors need additional review or are unavailable in the current muscle list.");
  if (resisted.has("elbow-flexion")) notes.push(input.grip
    ? "Grip changes elbow-flexor leverage. Review their roles rather than assuming a fixed ranking."
    : "Grip is unknown. Review elbow-flexor roles with the actual hand position.");
  if (resisted.has("ankle-plantarflexion")) notes.push("Review calf roles with the knee angle used in this exercise.");
  notes.push(input.bodyPosition
    ? "Body position alone does not establish support forces. Stabilizers and exercise-wide muscle roles need your review."
    : "Body position and supports are unknown. Stabilizers and exercise-wide muscle roles need your review.");
  if (input.actions.some(action => !resisted.has(action))) notes.push("Unconfirmed joint actions were not used for suggestions.");
  return {
    status: !muscles.size ? "unknown" : incomplete || unknownActions.length ? "partial" : "suggestions",
    muscles: [...muscles.values()].sort((a, b) => a.slug.localeCompare(b.slug)),
    unknownActions, notes: [...new Set(notes)],
  };
}
