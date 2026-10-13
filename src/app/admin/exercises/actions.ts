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

export type ModerationState = { error: string | null; updated: boolean };

export async function moderatePublicExercise(_previous: ModerationState, formData: FormData): Promise<ModerationState> {
  await requireRole(["reviewer", "admin"]);
  const parsed = z.object({ exerciseId: z.uuid(), action: z.enum(["verify", "hide", "restore", "unverify", "resolve_reports"]),
    comment: z.string().trim().min(1, "Enter a moderation reason.").max(2000) })
    .safeParse({ exerciseId: formData.get("exerciseId"), action: formData.get("action"), comment: formData.get("comment") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the decision.", updated: false };
  const input = parsed.data;
  const supabase = await createClient();
  const { data: exercise, error: loadError } = await supabase.from("exercises").select("slug").eq("id", input.exerciseId).maybeSingle();
  if (loadError || !exercise) return { error: "The exercise is unavailable.", updated: false };
  const result = input.action === "verify"
    ? await supabase.rpc("verify_community_exercise", { p_exercise_id: input.exerciseId, p_comment: input.comment })
    : await supabase.rpc("moderate_public_exercise", { p_exercise_id: input.exerciseId, p_action: input.action, p_comment: input.comment });
  if (result.error) return { error: "Could not apply this decision. Reload and try again.", updated: false };
  revalidatePath("/exercises");
  revalidatePath(`/exercises/${exercise.slug}`);
  revalidatePath("/admin/exercises");
  revalidatePath(`/admin/exercises/${input.exerciseId}`);
  return { error: null, updated: true };
}
