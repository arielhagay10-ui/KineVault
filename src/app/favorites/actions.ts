"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getIdentity } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function toggleFavorite(formData: FormData) {
  const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).safeParse(formData.get("slug"));
  const exerciseId = z.uuid().safeParse(formData.get("exerciseId"));
  if (!slug.success || !exerciseId.success) throw new Error("Invalid exercise");
  const identity = await getIdentity();
  if (!identity) redirect(`/sign-in?next=${encodeURIComponent(`/exercises/${slug.data}`)}`);
  const supabase = await createClient();
  const { data: existing } = await supabase.from("favorites")
    .select("exercise_id").eq("exercise_id", exerciseId.data).eq("user_id", identity.userId).maybeSingle();
  const result = existing
    ? await supabase.from("favorites").delete().eq("exercise_id", exerciseId.data).eq("user_id", identity.userId)
    : await supabase.from("favorites").insert({ exercise_id: exerciseId.data, user_id: identity.userId });
  if (result.error) throw new Error("Favorite could not be updated");
  revalidatePath(`/exercises/${slug.data}`);
  revalidatePath("/dashboard");
}
