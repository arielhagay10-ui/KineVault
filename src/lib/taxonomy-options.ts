import "server-only";
import { unstable_cache } from "next/cache";
import { createAnonymousClient } from "@/lib/supabase/anonymous";

export const TAXONOMY_CACHE_TAG = "public-taxonomy-options";

export const loadTaxonomyOptions = unstable_cache(async () => {
  const supabase = createAnonymousClient();
  const [muscles, joints, jointActions, families, movementPatterns, planes,
    equipmentCategories, equipment, attachments, resistanceSources, bodyPositions, grips, stances] = await Promise.all([
    supabase.from("muscles").select("slug,name").order("name"),
    supabase.from("joints").select("id,slug,name").order("name"),
    supabase.from("joint_actions").select("slug,name,joint_id,joints(name)").order("slug"),
    supabase.from("exercise_families").select("slug,name").order("name"),
    supabase.from("movement_patterns").select("slug,name").order("name"),
    supabase.from("planes_of_motion").select("slug,name").order("name"),
    supabase.from("equipment_categories").select("slug,name").order("name"),
    supabase.from("equipment").select("slug,name").order("name"),
    supabase.from("attachments").select("slug,name").order("name"),
    supabase.from("resistance_sources").select("slug,name").order("name"),
    supabase.from("body_positions").select("slug,name").order("name"),
    supabase.from("grips").select("slug,name").order("name"),
    supabase.from("stances").select("slug,name").order("name"),
  ]);
  if ([muscles, joints, jointActions, families, movementPatterns, planes, equipmentCategories,
    equipment, attachments, resistanceSources, bodyPositions, grips, stances].some(result => result.error)) {
    throw new Error("Exercise classifications could not be loaded");
  }
  return {
    muscles: muscles.data ?? [], joints: joints.data ?? [], families: families.data ?? [],
    jointActions: (jointActions.data ?? []).map(action => ({
      slug: action.slug, name: `${action.joints?.name ?? "Joint"} ${action.name}`,
    })),
    movementPatterns: movementPatterns.data ?? [], planes: planes.data ?? [],
    equipmentCategories: equipmentCategories.data ?? [], equipment: equipment.data ?? [],
    attachments: attachments.data ?? [], resistanceSources: resistanceSources.data ?? [],
    bodyPositions: bodyPositions.data ?? [], grips: grips.data ?? [], stances: stances.data ?? [],
  };
}, ["public-taxonomy-options-v1"], { tags: [TAXONOMY_CACHE_TAG], revalidate: 3600 });
