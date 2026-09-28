"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { parseReviewForm } from "@/lib/moderation/schema";
import { createClient } from "@/lib/supabase/server";
import type { ReviewActionState } from "@/app/admin/submissions/actions";

export async function reviseExercise(_previous: ReviewActionState, form: FormData): Promise<ReviewActionState> {
  await requireRole(["reviewer", "admin"]);
  const input = z.object({ exerciseId: z.uuid(), contentId: z.uuid(), comment: z.string().trim().min(5).max(2000) })
    .safeParse({ exerciseId: form.get("exerciseId"), contentId: form.get("contentId"), comment: form.get("comment") });
  const patch = parseReviewForm(form);
  if (!input.success || !patch.success) return { error: "Check the classifications and add a useful reason." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("revise_public_exercise", {
    p_exercise_id: input.data.exerciseId, p_expected_content_id: input.data.contentId,
    p_patch: patch.data, p_comment: input.data.comment,
  });
  if (error) return { error: error.code === "P0001" ? error.message : "The new version could not be saved. Reload and try again." };
  revalidatePath(`/admin/exercises/${input.data.exerciseId}/edit`);
  revalidatePath("/exercises", "layout");
  revalidatePath("/families", "layout");
  return { error: null, message: "A new reviewed version was published. Earlier versions are preserved." };
}
