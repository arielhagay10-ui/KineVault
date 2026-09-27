"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getIdentity } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ShareState = { url: string | null; error: string | null };

export async function replacePrivateShare(_previous: ShareState, formData: FormData): Promise<ShareState> {
  if (!await getIdentity()) return { url: null, error: "Sign in to share this exercise." };
  const parsed = z.uuid().safeParse(formData.get("privateId"));
  if (!parsed.success) return { url: null, error: "Invalid exercise." };
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const supabase = await createClient();
  const { error } = await supabase.rpc("replace_private_share", {
    p_private_id: parsed.data,
    p_token_hash: tokenHash,
  });
  if (error) return { url: null, error: "The share link could not be created." };
  revalidatePath(`/my-exercises/${parsed.data}/edit`);
  return { url: `/shared/${token}`, error: null };
}

export async function revokePrivateShare(formData: FormData) {
  if (!await getIdentity()) return;
  const parsed = z.uuid().safeParse(formData.get("privateId"));
  if (!parsed.success) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_private_share", { p_private_id: parsed.data });
  if (error) throw new Error("Share link could not be revoked");
  revalidatePath(`/my-exercises/${parsed.data}/edit`);
}
