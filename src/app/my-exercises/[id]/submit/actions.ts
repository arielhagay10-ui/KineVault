"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getIdentity } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  privateId: z.uuid(),
  disposition: z.enum(["new", "variation", "possible_duplicate"]),
  relatedExerciseId: z.uuid().nullable(),
  revisionOfId: z.uuid().nullable(),
  allowMotionReuse: z.boolean(),
  suggestions: z.array(z.object({
    taxonomyName: z.enum(["muscles", "joints", "joint_actions", "equipment", "equipment_categories", "attachments", "movement_patterns", "exercise_families"]),
    suggestedName: z.string().trim().min(2).max(120),
    explanation: z.string().max(1000),
  })).max(8),
}).superRefine((value, context) => {
  if ((value.disposition === "new") !== (value.relatedExerciseId === null)) {
    context.addIssue({ code: "custom", message: "Choose the related exercise." });
  }
});

export type SubmissionState = { error: string | null };

export async function submitPrivateExercise(_previous: SubmissionState, formData: FormData): Promise<SubmissionState> {
  const identity = await getIdentity();
  if (!identity) return { error: "Sign in to submit this exercise." };
  let suggestions: unknown;
  try { suggestions = JSON.parse(String(formData.get("suggestions") ?? "[]")); }
  catch { return { error: "Check the taxonomy suggestions." }; }
  const parsed = schema.safeParse({
    privateId: formData.get("privateId"),
    disposition: formData.get("disposition"),
    relatedExerciseId: formData.get("relatedExerciseId") || null,
    revisionOfId: formData.get("revisionOfId") || null,
    allowMotionReuse: formData.get("allowMotionReuse") === "on",
    suggestions,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the submission." };
  const input = parsed.data;
  const supabase = await createClient();
  const { data: submissionId, error } = await supabase.rpc("submit_private_exercise", {
    p_private_id: input.privateId,
    p_duplicate_disposition: input.disposition,
    p_related_exercise_id: input.relatedExerciseId ?? undefined,
    p_allow_motion_reuse: input.allowMotionReuse,
    p_revision_of_id: input.revisionOfId ?? undefined,
    p_suggestions: input.suggestions,
  });
  if (error || !submissionId) {
    const message = error?.message ?? "Could not submit this exercise.";
    if (message.includes("motion demonstration")) return { error: "Create and save a motion demo in the workshop first." };
    if (message.includes("primary muscle")) return { error: "Choose a primary muscle in exercise details." };
    if (message.includes("primary joint action")) return { error: "Choose a primary joint action in exercise details." };
    if (message.includes("family")) return { error: "Choose an exercise family in exercise details." };
    return { error: "Could not submit. Review the exercise details and try again." };
  }
  revalidatePath("/submissions");
  redirect(`/submissions/${submissionId}`);
}
