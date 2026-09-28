"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function prepareCandidate(data: FormData) {
  await requireRole(["reviewer", "admin"]);
  const id = z.uuid().parse(data.get("exerciseId"));
  const supabase = await createClient();
  const { data: draftId, error } = await supabase.rpc("prepare_catalog_candidate", { p_exercise_id: id });
  if (error || !draftId) throw new Error("This candidate is no longer available. Reload the candidate list.");
  redirect(`/my-exercises/${draftId}/edit`);
}
