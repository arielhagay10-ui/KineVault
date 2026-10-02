"use server";

import { revalidatePath } from "next/cache";
import { getIdentity } from "@/lib/auth";
import { workshopSceneSchema } from "@/lib/motion/scene-schema";
import { createClient } from "@/lib/supabase/server";

export async function saveWorkshopScene(privateId: string | null, sceneValue: unknown, name?: string, createIfMissing = false): Promise<{ error: string | null; privateId?: string }> {
  const identity = await getIdentity();
  if (!identity) return { error: "Sign in to save your scene." };
  const parsed = workshopSceneSchema.safeParse(sceneValue);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: `${issue?.path.map(part => typeof part === "number" ? part + 1 : part).join(" → ") || "Scene"}: ${issue?.message ?? "Check the scene."}` };
  }
  const supabase = await createClient();
  if (name !== undefined) {
    if (name.trim().length < 2 || name.trim().length > 160) return { error: "Name must contain 2 to 160 characters." };
    const { data, error } = await supabase.rpc("save_workshop_draft", { p_scene: parsed.data, p_name: name.trim(), p_private_id: privateId ?? undefined, p_create_if_missing: createIfMissing });
    if (error || !data) return { error: "Could not save your private draft. Check sign-in and Retry; your work is retained." };
    revalidatePath("/my-exercises");
    return { error: null, privateId: data };
  }
  if (!privateId) {
    const { data, error } = await supabase.rpc("create_workshop_exercise", { p_scene: parsed.data });
    if (error || !data) return { error: "Could not save the scene. Try again." };
    revalidatePath("/my-exercises");
    return { error: null, privateId: data };
  }
  const { error } = await supabase.rpc("save_private_scene", { p_private_id: privateId, p_scene: parsed.data });
  if (error) return { error: "Could not save the scene. Check joint limits and try again." };
  revalidatePath("/my-exercises");
  return { error: null, privateId };
}
