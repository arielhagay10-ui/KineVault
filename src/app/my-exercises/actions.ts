"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getIdentity } from "@/lib/auth";
import { parsePrivateExerciseForm, parsePrivateMetadata } from "@/lib/private-exercises/schema";
import { createClient } from "@/lib/supabase/server";

export type SaveState = { error: string | null };

export async function savePrivateExercise(_previous: SaveState, formData: FormData): Promise<SaveState> {
  const identity = await getIdentity();
  if (!identity) return { error: "Sign in to save a private exercise." };

  const parsed = parsePrivateExerciseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the exercise fields." };
  const input = parsed.data;
  const metadata = parsePrivateMetadata(formData, input);
  if (!metadata.success) return { error: metadata.error.issues[0]?.message ?? "Check the detailed classifications." };
  const supabase = await createClient();
  const { data: savedId, error } = await supabase.rpc("save_private_metadata", {
    p_private_id: input.privateId ?? undefined,
    p_patch: metadata.data,
  });
  if (error || !savedId) {
    return { error: "The exercise could not be saved. Check its classifications and try again." };
  }

  revalidatePath("/my-exercises");
  redirect(`/my-exercises/${savedId}/edit?saved=1`);
}

export async function deletePrivateExercise(formData: FormData) {
  const identity = await getIdentity();
  if (!identity) redirect("/sign-in");
  const privateId = formData.get("privateId");
  if (typeof privateId !== "string" || !/^[0-9a-f-]{36}$/.test(privateId)) {
    throw new Error("Invalid private exercise ID");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_private_exercise", { p_private_id: privateId });
  if (error) throw new Error("Private exercise could not be deleted");
  revalidatePath("/my-exercises");
  redirect("/my-exercises");
}
