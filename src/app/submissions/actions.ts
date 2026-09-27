"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getIdentity } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function withdrawSubmission(formData: FormData) {
  const parsed = z.uuid().safeParse(formData.get("submissionId"));
  if (!parsed.success) throw new Error("Invalid submission ID");
  const identity = await getIdentity();
  if (!identity) redirect("/sign-in?next=/submissions");
  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_submission", { p_submission_id: parsed.data });
  if (error) throw new Error("This submission could not be withdrawn");
  revalidatePath("/submissions");
  redirect(`/submissions/${parsed.data}`);
}
