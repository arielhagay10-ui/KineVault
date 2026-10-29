// Read public, current exercise versions through the same RLS as the catalog.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = z.url().parse(process.env.NEXT_PUBLIC_SUPABASE_URL);
const key = z.string().min(1).parse(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const slug = z.object({ slug: z.string().min(1) });
const uuid = z.uuid();
const catalogSchema = z.object({ id: uuid, slug: z.string(), current_content_id: uuid });
const contentSchema = z.object({ id: uuid, name: z.string(), family_id: uuid.nullable() });
const tagged = z.object({ role: z.string(), muscles: slug });
const sceneSchema = z.object({
  id: uuid, duration_ms: z.number().positive(), motion_style: z.string(), studio_layout: z.unknown(),
});
const frameSchema = z.object({
  id: uuid, position_ms: z.number().nonnegative(),
  motion_joint_poses: z.array(z.object({
    rotation_x: z.coerce.number().finite(), rotation_y: z.coerce.number().finite(),
    rotation_z: z.coerce.number().finite(), rotation_w: z.coerce.number().finite(), rig_joints: slug,
  })),
});
async function rows(table, fields, schema, filter = request => request, order = "id") {
  const result = [];
  for (let start = 0; ; start += 200) {
    const { data, error } = await filter(db.from(table).select(fields)).order(order).range(start, start + 199);
    if (error) throw new Error(`Cannot export ${table}: ${error.message}`);
    const page = z.array(schema).parse(data);
    result.push(...page);
    if (page.length < 200) return result;
  }
}
async function query(request, schema) {
  const { data, error } = await request;
  if (error) throw new Error(`Cannot export public content: ${error.message}`);
  return schema.parse(data);
}
const exercises = await rows("exercises", "id,slug,current_content_id", catalogSchema,
  request => request.eq("status", "published"));
const muscles = await rows("muscles", "id,slug", slug.extend({ id: uuid }));
const examples = [];
for (const exercise of exercises) {
  const id = exercise.current_content_id;
  const [content, labels, equipment, setup, scenes] = await Promise.all([
    query(db.from("exercise_content").select("id,name,family_id").eq("id", id).single(), contentSchema),
    query(db.from("exercise_muscles").select("role,muscles(slug)").eq("content_id", id).order("muscle_id"), z.array(tagged)),
    query(db.from("exercise_equipment").select("role,equipment(slug)").eq("content_id", id).order("equipment_id"),
      z.array(z.object({ role: z.string(), equipment: slug }))),
    query(db.from("exercise_biomechanics")
      .select("classification_confidence,resistance_profile,body_positions(slug),grips(slug),stances(slug),resistance_sources(slug)")
      .eq("content_id", id).maybeSingle(), z.object({
      classification_confidence: z.string().nullable(), resistance_profile: z.string(),
      body_positions: slug.nullable(), grips: slug.nullable(), stances: slug.nullable(), resistance_sources: slug.nullable(),
    }).nullable()),
    query(db.from("exercise_scenes").select("id,duration_ms,motion_style,studio_layout").eq("content_id", id), z.array(sceneSchema)),
  ]);
  if (scenes.length > 1) throw new Error(`Multiple scenes for ${id}`);
  const scene = scenes[0];
  const frames = scene ? await rows("motion_keyframes",
    "id,position_ms,motion_joint_poses(rotation_x,rotation_y,rotation_z,rotation_w,rig_joints(slug))",
    frameSchema, request => request.eq("scene_id", scene.id), "position_ms") : [];
  const assets = scene ? await rows("scene_equipment",
    "id,position_x,position_y,position_z,scale,equipment_assets(slug)", z.object({
      id: uuid, position_x: z.coerce.number().finite(), position_y: z.coerce.number().finite(),
      position_z: z.coerce.number().finite(), scale: z.coerce.number().positive(), equipment_assets: slug,
    }), request => request.eq("scene_id", scene.id)) : [];
  const current = await query(db.from("exercises").select("id,slug,current_content_id")
    .eq("id", exercise.id).eq("status", "published").single(), catalogSchema);
  if (current.current_content_id !== id) throw new Error("Exercise changed during export; retry");
  const sample = { exercise_id: exercise.id, content_id: id, name: content.name,
    slug: exercise.slug, family_id: content.family_id, catalog_muscles: labels, equipment, setup,
    scene: scene ? { ...scene, frames, assets } : null };
  examples.push({ ...sample, snapshot_sha256: createHash("sha256").update(JSON.stringify(sample)).digest("hex") });
}
const output = resolve(process.argv[2] ?? `.local-artifacts/muscle-model/catalog-${Date.now()}`);
await mkdir(resolve(output, ".."), { recursive: true });
await mkdir(output); // Refuse to replace an earlier export or review.
const save = (name, data) => writeFile(resolve(output, name), JSON.stringify(data, null, 2) + "\n", { flag: "wx" });
await save("catalog.json", { schema_version: 1, exported_at: new Date().toISOString(),
  source: "KineVault current public catalog via anonymous RLS", muscles: muscles.map(item => item.slug).sort(), examples });
await save("reviews.json", { schema_version: 1, reviews: examples.map(item => ({
  content_id: item.content_id, snapshot_sha256: item.snapshot_sha256, group_id: item.family_id,
  reviewer: null, evidence: [], rights_confirmed: false, motion_reviewed: false, setup_reviewed: false,
  labels: {},
})) });
console.log(JSON.stringify({ output, public_exercises: examples.length,
  with_scene: examples.filter(item => item.scene).length, muscle_vocabulary: muscles.length,
  reviewed_for_training: 0 }, null, 2));
