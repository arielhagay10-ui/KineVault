"use server";

import { z } from "zod";
import { getIdentity } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ReportState = { error: string | null; sent: boolean };

export async function reportPublicExercise(_previous: ReportState, formData: FormData): Promise<ReportState> {
  if (!await getIdentity()) return { error: "Sign in to report an exercise.", sent: false };
  const parsed = z.object({ exerciseId: z.uuid(), reason: z.string().trim().min(1, "Describe the issue.").max(2000) })
    .safeParse({ exerciseId: formData.get("exerciseId"), reason: formData.get("reason") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your report.", sent: false };
  const supabase = await createClient();
  const { error } = await supabase.rpc("report_public_exercise", { p_exercise_id: parsed.data.exerciseId, p_reason: parsed.data.reason });
  return error ? { error: "Could not send the report. Try again.", sent: false } : { error: null, sent: true };
}

export async function recordExerciseView(exerciseId: string) {
  const parsed = z.uuid().safeParse(exerciseId);
  if (!parsed.success || !await getIdentity()) return;
  const supabase = await createClient();
  await supabase.rpc("record_exercise_engagement", { p_exercise_id: parsed.data, p_kind: "view" });
}
