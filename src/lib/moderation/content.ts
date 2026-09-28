import "server-only";
import { createClient } from "@/lib/supabase/server";
import { loadPrivateExerciseOptions, type Option, type PrivateExerciseOptions } from "@/lib/private-exercises/options";
import { reviewPatchSchema, type ReviewPatch } from "@/lib/moderation/schema";

export type ReviewOptions = PrivateExerciseOptions & {
  attachments: Option[]; movementPatterns: Option[]; grips: Option[];
  stances: Option[]; planes: Option[]; resistanceSources: Option[];
};

export async function loadReviewOptions(): Promise<ReviewOptions> {
  const supabase = await createClient();
  const [base, attachments, patterns, grips, stances, planes, sources] = await Promise.all([
    loadPrivateExerciseOptions(),
    supabase.from("attachments").select("slug,name").order("name"),
    supabase.from("movement_patterns").select("slug,name").order("name"),
    supabase.from("grips").select("slug,name").order("name"),
    supabase.from("stances").select("slug,name").order("name"),
    supabase.from("planes_of_motion").select("slug,name").order("name"),
    supabase.from("resistance_sources").select("slug,name").order("name"),
  ]);
  if ([attachments, patterns, grips, stances, planes, sources].some((result) => result.error)) {
    throw new Error("Review classifications could not be loaded");
  }
  return { ...base, attachments: attachments.data ?? [], movementPatterns: patterns.data ?? [],
    grips: grips.data ?? [], stances: stances.data ?? [], planes: planes.data ?? [], resistanceSources: sources.data ?? [] };
}

export async function loadReviewContent(contentId: string): Promise<ReviewPatch | null> {
  const supabase = await createClient();
  const [content, muscles, joints, actions, equipment, attachments, patterns, biomech] = await Promise.all([
    supabase.from("exercise_content").select("*,exercise_families(slug)").eq("id", contentId).maybeSingle(),
    supabase.from("exercise_muscles").select("role,muscles(slug)").eq("content_id", contentId),
    supabase.from("exercise_joints").select("role,joints(slug)").eq("content_id", contentId),
    supabase.from("exercise_joint_actions").select("role,joint_actions(slug)").eq("content_id", contentId),
    supabase.from("exercise_equipment").select("role,equipment(slug)").eq("content_id", contentId),
    supabase.from("exercise_attachments").select("attachments(slug)").eq("content_id", contentId),
    supabase.from("exercise_movement_patterns").select("movement_patterns(slug)").eq("content_id", contentId),
    supabase.from("exercise_biomechanics").select("*,body_positions(slug),grips(slug),stances(slug),planes_of_motion(slug),resistance_sources(slug)").eq("content_id", contentId).maybeSingle(),
  ]);
  if ([content, muscles, joints, actions, equipment, attachments, patterns, biomech].some((result) => result.error)) {
    throw new Error("Review content could not be loaded");
  }
  if (!content.data) return null;
  const c = content.data;
  const b = biomech.data;
  return reviewPatchSchema.parse({
    ...c, description: c.short_description, family: c.exercise_families?.slug ?? null,
    muscles: (muscles.data ?? []).map((item) => ({ slug: item.muscles?.slug, role: item.role })).sort(bySlug),
    joints: (joints.data ?? []).map((item) => ({ slug: item.joints?.slug, role: item.role })).sort(bySlug),
    joint_actions: (actions.data ?? []).map((item) => ({ slug: item.joint_actions?.slug, role: item.role })).sort(bySlug),
    equipment: (equipment.data ?? []).map((item) => ({ slug: item.equipment?.slug, role: item.role })).sort(bySlug),
    attachments: (attachments.data ?? []).map((item) => item.attachments?.slug).sort(),
    movement_patterns: (patterns.data ?? []).map((item) => item.movement_patterns?.slug).sort(),
    body_position: b?.body_positions?.slug ?? null, grip: b?.grips?.slug ?? null,
    stance: b?.stances?.slug ?? null, plane: b?.planes_of_motion?.slug ?? null,
    resistance_source: b?.resistance_sources?.slug ?? null,
    resistance_profile: b?.resistance_profile ?? "unknown", peak_resistance_position: b?.peak_resistance_position ?? "unknown",
    classification_confidence: b?.classification_confidence ?? null, reviewer_notes: b?.reviewer_notes ?? null,
  });
}

function bySlug(a: { slug?: string }, b: { slug?: string }) {
  return (a.slug ?? "").localeCompare(b.slug ?? "");
}
