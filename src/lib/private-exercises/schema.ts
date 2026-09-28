import { z } from "zod";
import { reviewPatchSchema, parseAliasLines } from "@/lib/moderation/schema";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const slugs = z.array(slug).max(20);

export const privateExerciseSchema = z.object({
  privateId: z.uuid().nullable(),
  name: z.string().trim().min(2).max(160),
  shortDescription: z.string().trim().max(500),
  familySlug: slug.nullable(),
  primaryMuscles: slugs,
  secondaryMuscles: slugs,
  stabilizerMuscles: slugs,
  joints: slugs,
  jointActions: slugs,
  equipment: slugs,
  resistanceProfile: z.enum([
    "ascending", "descending", "bell_shaped", "relatively_constant",
    "variable_complex", "unknown",
  ]),
  bodyPositionSlug: slug.nullable(),
}).superRefine((value, context) => {
  const muscles = [...value.primaryMuscles, ...value.secondaryMuscles, ...value.stabilizerMuscles];
  if (new Set(muscles).size !== muscles.length) {
    context.addIssue({ code: "custom", path: ["primaryMuscles"], message: "A muscle can have only one role." });
  }
});

export type PrivateExerciseInput = z.infer<typeof privateExerciseSchema>;

function strings(data: FormData, field: string): string[] {
  return [...new Set(data.getAll(field).filter((value): value is string => typeof value === "string"))];
}

function optional(data: FormData, field: string): string | null {
  const value = data.get(field);
  return typeof value === "string" && value !== "" ? value : null;
}

export function parsePrivateExerciseForm(data: FormData) {
  return privateExerciseSchema.safeParse({
    privateId: optional(data, "privateId"),
    name: data.get("name"),
    shortDescription: data.get("shortDescription") ?? "",
    familySlug: optional(data, "familySlug"),
    primaryMuscles: strings(data, "primaryMuscle"),
    secondaryMuscles: strings(data, "secondaryMuscle"),
    stabilizerMuscles: strings(data, "stabilizerMuscle"),
    joints: strings(data, "joint"),
    jointActions: strings(data, "jointAction"),
    equipment: strings(data, "equipment"),
    resistanceProfile: data.get("resistanceProfile") ?? "unknown",
    bodyPositionSlug: optional(data, "bodyPositionSlug"),
  });
}

export function parsePrivateMetadata(data: FormData, basic: PrivateExerciseInput) {
  const roleList = (values: string[], prefix: string, fallback: string) => values.map((value) => ({
    slug: value, role: data.get(`${prefix}.${value}`) || fallback,
  }));
  const details = Object.fromEntries([
    "grip", "stance", "plane", "resistance_source", "classification_confidence", "reviewer_notes",
    "difficulty", "exercise_type", "mechanic", "force_type", "laterality", "setup_instructions",
    "execution_instructions", "form_cues", "common_mistakes", "safety_notes", "range_of_motion_notes",
  ].map((field) => [field, optional(data, field)]));
  return reviewPatchSchema.safeParse({
    ...details, name: basic.name, aliases: parseAliasLines(data.get("aliases")), description: basic.shortDescription || null, family: basic.familySlug,
    muscles: [
      ...basic.primaryMuscles.map((value) => ({ slug: value, role: "primary" })),
      ...basic.secondaryMuscles.map((value) => ({ slug: value, role: "secondary" })),
      ...basic.stabilizerMuscles.map((value) => ({ slug: value, role: "stabilizer" })),
    ],
    joints: roleList(basic.joints, "jointRole", "primary"),
    joint_actions: roleList(basic.jointActions, "actionRole", "primary"),
    equipment: roleList(basic.equipment, "equipmentRole", "required"),
    attachments: strings(data, "attachments"), movement_patterns: strings(data, "movement_patterns"),
    body_position: basic.bodyPositionSlug, resistance_profile: basic.resistanceProfile,
    peak_resistance_position: data.get("peak_resistance_position") || "unknown",
  });
}
