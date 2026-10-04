import "server-only";
import { loadTaxonomyOptions } from "@/lib/taxonomy-options";

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
  const { families, muscles, joints, jointActions, equipment, bodyPositions } = await loadTaxonomyOptions();
  return { families, muscles, joints, jointActions, equipment, bodyPositions };
}
