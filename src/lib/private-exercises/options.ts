import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Option = { slug: string; name: string };
export type PrivateExerciseOptions = {
  families: Option[];
  muscles: Option[];
  joints: Option[];
  jointActions: Option[];
  equipment: Option[];
  bodyPositions: Option[];
};

export async function loadPrivateExerciseOptions(): Promise<PrivateExerciseOptions> {
  const supabase = await createClient();
  const [families, muscles, joints, actions, equipment, positions] = await Promise.all([
    supabase.from("exercise_families").select("slug,name").order("name"),
    supabase.from("muscles").select("slug,name").order("name"),
    supabase.from("joints").select("slug,name").order("name"),
    supabase.from("joint_actions").select("slug,name,joints(name)").order("slug"),
    supabase.from("equipment").select("slug,name").order("name"),
    supabase.from("body_positions").select("slug,name").order("name"),
  ]);
  if ([families, muscles, joints, actions, equipment, positions].some((result) => result.error)) {
    throw new Error("Exercise classifications could not be loaded");
  }
  return {
    families: families.data ?? [],
    muscles: muscles.data ?? [],
    joints: joints.data ?? [],
    jointActions: (actions.data ?? []).map((action) => ({
      slug: action.slug, name: `${action.joints?.name ?? "Joint"} ${action.name}`,
    })),
    equipment: equipment.data ?? [],
    bodyPositions: positions.data ?? [],
  };
}
