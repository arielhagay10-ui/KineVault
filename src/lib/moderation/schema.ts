import { z } from "zod";
import { Constants } from "@/lib/database.types";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const nullableSlug = slug.nullable();
const entries = <T extends z.ZodType>(schema: T) => z.array(schema).max(20)
  .refine((items) => new Set(items.map((item) => typeof item === "string" ? item : (item as { slug: string }).slug)).size === items.length, "Choose each classification once.");
const roleEntries = (roles: readonly [string, ...string[]]) => entries(z.object({ slug, role: z.enum(roles) }));
const enums = Constants.public.Enums;

export const reviewPatchSchema = z.object({
  name: z.string().trim().min(2).max(160),
  aliases: z.array(z.string().trim().min(2).max(160)).max(20).default([])
    .refine((items) => new Set(items.map((item) => item.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " "))).size === items.length, "Each alias must be distinct."),
  description: z.string().trim().max(500).nullable(),
  family: nullableSlug,
  muscles: roleEntries(enums.muscle_role),
  joints: roleEntries(enums.joint_role),
  joint_actions: roleEntries(enums.joint_role),
  equipment: roleEntries(enums.equipment_role),
  attachments: entries(slug),
  movement_patterns: entries(slug),
  body_position: nullableSlug,
  grip: nullableSlug,
  stance: nullableSlug,
  plane: nullableSlug,
  resistance_source: nullableSlug,
  resistance_profile: z.enum(enums.resistance_profile),
  peak_resistance_position: z.enum(enums.peak_resistance_position),
  classification_confidence: z.enum(enums.classification_confidence).nullable(),
  reviewer_notes: z.string().trim().max(2000).nullable(),
  difficulty: z.enum(enums.exercise_difficulty).nullable(),
  exercise_type: z.enum(enums.exercise_type).nullable(),
  mechanic: z.enum(enums.exercise_mechanic).nullable(),
  force_type: z.enum(enums.force_type).nullable(),
  laterality: z.enum(enums.laterality).nullable(),
  setup_instructions: z.string().trim().max(4000).nullable(),
  execution_instructions: z.string().trim().max(4000).nullable(),
  form_cues: z.string().trim().max(4000).nullable(),
  common_mistakes: z.string().trim().max(4000).nullable(),
  safety_notes: z.string().trim().max(4000).nullable(),
  range_of_motion_notes: z.string().trim().max(4000).nullable(),
});
export type ReviewPatch = z.infer<typeof reviewPatchSchema>;
export type ReviewField = keyof ReviewPatch;
export const reviewFieldLabels: Record<ReviewField, string> = {
  name: "Name", aliases: "Aliases", description: "Description", family: "Exercise family",
  muscles: "Muscles", joints: "Joints", joint_actions: "Joint actions",
  equipment: "Equipment", attachments: "Attachments", movement_patterns: "Movement patterns",
  body_position: "Body position", grip: "Grip", stance: "Stance", plane: "Plane of motion",
  resistance_source: "Resistance source", resistance_profile: "External resistance profile",
  peak_resistance_position: "Peak resistance position", classification_confidence: "Classification confidence",
  reviewer_notes: "Reviewer notes", difficulty: "Difficulty", exercise_type: "Exercise type",
  mechanic: "Mechanic", force_type: "Force type", laterality: "Laterality",
  setup_instructions: "Setup", execution_instructions: "Execution", form_cues: "Form cues",
  common_mistakes: "Common mistakes", safety_notes: "Safety notes", range_of_motion_notes: "Range of motion",
};

export function parseReviewForm(data: FormData) {
  const result: Record<string, unknown> = {};
  for (const field of Object.keys(reviewFieldLabels)) {
    if (["muscles", "joints", "joint_actions", "equipment"].includes(field)) {
      result[field] = [...data.entries()].filter(([key, value]) => key.startsWith(`${field}.`) && value !== "")
        .map(([key, role]) => ({ slug: key.slice(field.length + 1), role }));
    } else if (field === "aliases") {
      result[field] = parseAliasLines(data.get(field));
    } else if (field === "attachments" || field === "movement_patterns") {
      result[field] = data.getAll(field);
    } else {
      const value = data.get(field);
      result[field] = value === "" || value === null ? null : value;
    }
  }
  return reviewPatchSchema.safeParse(result);
}

export function parseAliasLines(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) : [];
}

export function humanLabel(value: string) {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

export function formatReviewValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not classified";
  if (Array.isArray(value)) return value.map((item) => {
    if (typeof item === "string") return humanLabel(item);
    if (item && typeof item === "object" && "slug" in item && "role" in item) {
      return `${humanLabel(String(item.slug))} (${humanLabel(String(item.role))})`;
    }
    if (item && typeof item === "object" && "label" in item && "startMs" in item && "endMs" in item) {
      const note = "note" in item && item.note ? `: ${String(item.note)}` : "";
      const action = "jointAction" in item && item.jointAction ? ` (${humanLabel(String(item.jointAction))})` : "";
      return `${String(item.label)} [${Number(item.startMs) / 1000}–${Number(item.endMs) / 1000}s]${action}${note}`;
    }
    return "Unknown classification";
  }).join(", ") || "None";
  return String(value);
}
