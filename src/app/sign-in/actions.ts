"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/auth-navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string | null; notice: string | null; field?: string | null };
const signInCredentials = z.object({ email: z.email(), password: z.string().min(1) });
const newCredentials = z.object({ email: z.email(), password: z.string().min(10).max(128) });

function readCredentials(formData: FormData, newAccount: boolean) {
  const input = { email: formData.get("email"), password: formData.get("password") };
  return (newAccount ? newCredentials : signInCredentials).safeParse(input);
}

export async function signIn(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = readCredentials(formData, false);
  if (!parsed.success) return { error: "Enter a valid email and password.", notice: null, field: String(parsed.error.issues[0]?.path[0] ?? "email") };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Those sign-in details did not work.", notice: null };
  revalidatePath("/", "layout");
  redirect(safeNextPath(formData.get("next")?.toString()));
}

export async function signUp(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = readCredentials(formData, true);
  if (!parsed.success) return { error: "Use a valid email and a password of at least 10 characters.", notice: null, field: String(parsed.error.issues[0]?.path[0] ?? "email") };
  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${siteUrl}/auth/confirm` },
  });
  if (error) return { error: "The account could not be created. Please try again.", notice: null };
  if (!data.session) return { error: null, notice: "Check your email to confirm your account, then sign in." };
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function requestPasswordReset(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter a valid email address.", notice: null, field: "email" };
  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${siteUrl}/auth/confirm?next=/reset-password/update`,
  });
  return { error: null, notice: "If an account exists for this address, a reset email is on its way." };
}

export async function updatePassword(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const password = z.string().min(10).max(128).safeParse(formData.get("password"));
  if (!password.success) return { error: "Use a password of at least 10 characters.", notice: null, field: "password" };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { error: "The password could not be changed. Open a new reset link.", notice: null };
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
