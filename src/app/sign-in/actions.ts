"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authPath, safeNextPath } from "@/lib/auth-navigation";
import { authEmailSchema, clearPendingEmail, emailKindSchema, getPendingEmail, rememberPendingEmail, resendDelayMs } from "@/lib/auth-pending-email";
import { getAuthSettings } from "@/lib/auth-settings";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string | null; notice: string | null; field?: string | null; retryAt?: number };
const signInCredentials = z.object({ email: authEmailSchema, password: z.string().min(1).max(128) });
const newCredentials = z.object({ email: authEmailSchema, password: z.string().min(10).max(128) });

function providerError(error: { code?: string; status?: number; name?: string } | null | undefined, fallback: string): AuthState {
  if (error?.status === 429 || error?.code === "over_email_send_rate_limit" || error?.code === "over_request_rate_limit") {
    return { error: "Too many attempts. Wait a minute before trying again.", notice: null, retryAt: Date.now() + resendDelayMs };
  }
  if (error?.name === "AuthRetryableFetchError" || (error?.status ?? 0) >= 500 || error?.code === "request_timeout") {
    return { error: "Authentication is temporarily unavailable. Try again in a moment.", notice: null };
  }
  if (error?.code === "weak_password") return { error: "Choose a longer password that you have not used elsewhere.", notice: null, field: "password" };
  return { error: fallback, notice: null };
}

function emailRedirect(next: string) {
  return `${getAuthSettings().siteUrl}${authPath("/auth/confirm", next)}`;
}

function readCredentials(formData: FormData, newAccount: boolean) {
  const input = { email: formData.get("email"), password: formData.get("password") };
  return (newAccount ? newCredentials : signInCredentials).safeParse(input);
}

export async function signIn(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = readCredentials(formData, false);
  if (!parsed.success) return { error: "Enter a valid email and password.", notice: null, field: String(parsed.error.issues[0]?.path[0] ?? "email") };
  const supabase = await createClient();
  const result = await supabase.auth.signInWithPassword(parsed.data).catch(() => null);
  const next = safeNextPath(formData.get("next")?.toString());
  if (result?.error?.code === "email_not_confirmed") {
    await rememberPendingEmail({ email: parsed.data.email, kind: "signup", next }, false);
    redirect("/check-email");
  }
  if (!result) return { error: "We could not connect to sign you in. Try again in a moment.", notice: null };
  if (result.error) return providerError(result.error, "The email or password is incorrect. Check your details and try again.");
  await clearPendingEmail();
  revalidatePath("/", "layout");
  redirect(next);
}

export async function signUp(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = readCredentials(formData, true);
  if (!parsed.success) return { error: "Use a valid email and a password of at least 10 characters.", notice: null, field: String(parsed.error.issues[0]?.path[0] ?? "email") };
  const supabase = await createClient();
  const next = safeNextPath(formData.get("next")?.toString());
  const result = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: emailRedirect(next) },
  }).catch(() => null);
  if (!result || result.error) return providerError(result?.error, "We could not create the account. Please try again in a moment.");
  if (!result.data.session) {
    await rememberPendingEmail({ email: parsed.data.email, kind: "signup", next });
    redirect("/check-email");
  }
  await clearPendingEmail();
  revalidatePath("/", "layout");
  redirect(next);
}

export async function signInWithGoogle(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const { siteUrl, googleEnabled } = getAuthSettings();
  if (!googleEnabled) return { error: "Google sign-in is unavailable. Use your email and password.", notice: null };
  const supabase = await createClient();
  const result = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${siteUrl}${authPath("/auth/callback", formData.get("next")?.toString())}` },
  }).catch(() => null);
  if (!result || result.error || !result.data.url) return { error: "Google sign-in could not start. Try again or use your email and password.", notice: null };
  redirect(result.data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await clearPendingEmail();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function requestPasswordReset(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const email = authEmailSchema.safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter a valid email address.", notice: null, field: "email" };
  const supabase = await createClient();
  const next = safeNextPath(formData.get("next")?.toString());
  const pending = await getPendingEmail();
  if (pending && pending.retryAt > Date.now()) return { error: "Wait a minute before requesting another email.", notice: null, retryAt: pending.retryAt };
  const result = await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: emailRedirect(next) }).catch(() => null);
  if (!result || result.error) return providerError(result?.error, "We could not send a reset email. Try again in a moment.");
  await rememberPendingEmail({ email: email.data, kind: "recovery", next });
  redirect("/check-email");
}

export async function resendAuthEmail(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const email = authEmailSchema.safeParse(formData.get("email"));
  const kind = emailKindSchema.safeParse(formData.get("kind"));
  if (!email.success) return { error: "Enter a valid email address.", notice: null, field: "email" };
  if (!kind.success) return { error: "Choose sign-up or password reset to request a new email.", notice: null };
  const pending = await getPendingEmail();
  if (pending && pending.retryAt > Date.now()) return { error: "Wait before requesting another email.", notice: null, retryAt: pending.retryAt };
  const next = safeNextPath(formData.get("next")?.toString());
  const supabase = await createClient();
  const result = await (kind.data === "signup"
    ? supabase.auth.resend({ type: "signup", email: email.data, options: { emailRedirectTo: emailRedirect(next) } })
    : supabase.auth.resetPasswordForEmail(email.data, { redirectTo: emailRedirect(next) })).catch(() => null);
  if (!result || (result.error && result.error.code !== "user_not_found")) return providerError(result?.error, "We could not send the email. Try again in a moment.");
  const saved = await rememberPendingEmail({ email: email.data, kind: kind.data, next });
  return { error: null, notice: "If this address needs an email, a new link is on its way. Check your spam folder too.", retryAt: saved.retryAt };
}

export async function updatePassword(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const password = z.string().min(10).max(128).safeParse(formData.get("password"));
  if (!password.success) return { error: "Use a password of at least 10 characters.", notice: null, field: "password" };
  const supabase = await createClient();
  const result = await supabase.auth.updateUser({ password: password.data }).catch(() => null);
  if (!result || result.error) return providerError(result?.error, "The password could not be changed. Request a new reset link and try again.");
  await clearPendingEmail();
  revalidatePath("/", "layout");
  redirect(safeNextPath(formData.get("next")?.toString()));
}
