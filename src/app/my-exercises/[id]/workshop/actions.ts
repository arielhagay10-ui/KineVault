"use server";

import { revalidatePath } from "next/cache";
import { getIdentity } from "@/lib/auth";
import { workshopSceneSchema } from "@/lib/motion/scene-schema";
import { createClient } from "@/lib/supabase/server";

export async function saveWorkshopScene(privateId: string, sceneValue: unknown): Promise<{ error: string | null }> {
  const identity = await getIdentity();
  if (!identity) return { error: "Sign in to save your scene." };
  const parsed = workshopSceneSchema.safeParse(sceneValue);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the scene." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_private_scene", {
    p_private_id: privateId,
    p_scene: parsed.data,
  });
  if (error) return { error: "Could not save the scene. Check joint limits and try again." };
  revalidatePath(`/my-exercises/${privateId}/workshop`);
  return { error: null };
}
