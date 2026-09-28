import { z } from "zod";

export const taxonomyNames = ["muscles", "joints", "joint_actions", "equipment_categories", "equipment", "attachments", "movement_patterns", "exercise_families", "body_positions", "grips", "stances", "planes_of_motion", "resistance_sources"] as const;
export const taxonomyNameSchema = z.enum(taxonomyNames);
export type TaxonomyName = z.infer<typeof taxonomyNameSchema>;
export const parentTaxonomies: readonly TaxonomyName[] = ["muscles", "joints", "equipment_categories", "equipment", "exercise_families"];
export const describedTaxonomies: readonly TaxonomyName[] = ["muscles", "joints", "joint_actions", "equipment", "attachments", "movement_patterns", "exercise_families"];

export const taxonomyRecordSchema = z.object({
  id: z.uuid(), name: z.string(), slug: z.string(),
  description: z.string().nullable().optional(), parent_id: z.uuid().nullable().optional(),
  joint_id: z.uuid().optional(), category_id: z.uuid().optional(),
});
export type TaxonomyRecord = z.infer<typeof taxonomyRecordSchema>;

export const taxonomyMutationSchema = z.object({
  table: taxonomyNameSchema, id: z.uuid().nullable(),
  name: z.string().trim().min(2).max(120), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
  description: z.string().trim().max(2000), parentId: z.uuid().nullable(),
  jointId: z.uuid().nullable(), categoryId: z.uuid().nullable(),
}).superRefine((value, context) => {
  if (value.table === "joint_actions" && !value.jointId) context.addIssue({ code: "custom", path: ["jointId"], message: "Choose the anatomical joint." });
  if (value.table === "equipment" && !value.categoryId) context.addIssue({ code: "custom", path: ["categoryId"], message: "Choose an equipment category." });
  if (value.id && value.id === value.parentId) context.addIssue({ code: "custom", path: ["parentId"], message: "A record cannot be its own parent." });
});
