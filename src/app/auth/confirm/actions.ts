"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AuthState } from "@/app/sign-in/actions";
import { authPath, safeNextPath } from "@/lib/auth-navigation";
import { clearPendingEmail } from "@/lib/auth-pending-email";
import { confirmationSchema } from "@/lib/auth-confirmation";
import { createClient } from "@/lib/supabase/server";

export async function confirmEmail(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = confirmationSchema.safeParse({ token_hash: formData.get("token_hash"), type: formData.get("type") });
  if (!parsed.success) return { error: "This link is incomplete. Request a new email to continue.", notice: null };
  const supabase = await createClient();
  const result = await supabase.auth.verifyOtp(parsed.data).catch(() => null);
  if (!result) return { error: "We could not check this link. Try again in a moment.", notice: null };
  if (result.error?.status === 429 || result.error?.code === "over_request_rate_limit") {
    return { error: "Too many attempts. Wait a minute before trying this link again.", notice: null };
  }
  if (result.error) return {
    error: result.error.code === "otp_expired"
      ? "This link has expired or has already been used. Request a new email below."
      : "We could not check this link. Try again in a moment.",
    notice: null,
  };
  await clearPendingEmail();
  revalidatePath("/", "layout");
  const next = safeNextPath(formData.get("next")?.toString());
  redirect(parsed.data.type === "recovery" ? authPath("/reset-password/update", next) : next);
}
