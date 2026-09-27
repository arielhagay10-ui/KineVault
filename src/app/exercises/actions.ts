"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getIdentity } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function copyPublicExercise(formData: FormData) {
  const id = formData.get("exerciseId");
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) throw new Error("Invalid exercise ID");
  const identity = await getIdentity();
  if (!identity) redirect("/sign-in?next=/exercises");
  const supabase = await createClient();
  const { data: privateId, error } = await supabase.rpc("copy_public_exercise", { p_exercise_id: id });
  if (error || !privateId) throw new Error("Could not copy this exercise");
  revalidatePath("/my-exercises");
  redirect(`/my-exercises/${privateId}/edit`);
}
