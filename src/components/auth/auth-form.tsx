"use client";

import { useActionState, useRef } from "react";
import Link from "next/link";
import { signIn, signUp, requestPasswordReset, updatePassword, type AuthState } from "@/app/sign-in/actions";
import { FormError, focusInvalidField, submitPreservingValues, useFormErrorFocus } from "@/components/ui/form-feedback";
import { authPath } from "@/lib/auth-navigation";
import { AuthShell } from "./auth-shell";
import { PasswordField } from "./password-field";
import { GoogleSignIn } from "./google-sign-in";
import { CooldownSubmit } from "./cooldown-submit";

type Mode = "sign-in" | "sign-up" | "forgot" | "update";
const copy = {
  "sign-in": { title: "Welcome back", description: "Sign in to save movements and pick up where you left off.", submit: "Sign in", pending: "Signing in..." },
  "sign-up": { title: "Create your account", description: "Save favorites, create private exercises, and contribute reviewed movements.", submit: "Create account", pending: "Creating your account..." },
  forgot: { title: "Reset your password", description: "Enter your email and we'll send you a link to choose a new password.", submit: "Send reset email", pending: "Sending reset email..." },
  update: { title: "Choose a new password", description: "Choose a password you haven't used elsewhere.", submit: "Set new password", pending: "Saving your password..." },
};

export function AuthForm({ mode, next = "/dashboard", googleEnabled = false, initialError = null, confirmationFailed = false }: {
  mode: Mode; next?: string; googleEnabled?: boolean; initialError?: string | null; confirmationFailed?: boolean;
}) {
  const action = mode === "sign-up" ? signUp : mode === "forgot" ? requestPasswordReset : mode === "update" ? updatePassword : signIn;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, { error: initialError, notice: null });
  const form = useRef<HTMLFormElement>(null);
  useFormErrorFocus(form, state.error, state.field);
  const text = copy[mode];
  const showGoogle = googleEnabled && (mode === "sign-in" || mode === "sign-up");
  const linkClass = "rounded underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring";
  return (
    <AuthShell title={text.title} description={text.description} footer={mode === "sign-in" ? <>
      <Link href={authPath("/sign-up", next)} className={`${linkClass} font-medium text-primary`}>Create an account</Link>
      <Link href={authPath("/reset-password", next)} className={`${linkClass} text-muted-foreground`}>Forgot password?</Link>
    </> : <Link href={authPath("/sign-in", next)} className={`${linkClass} font-medium text-primary`}>{mode === "sign-up" ? "Sign in" : "Back to sign in"}</Link>}>
      {showGoogle && <GoogleSignIn next={next} />}
      <form ref={form} action={formAction} onSubmit={event => submitPreservingValues(event, formAction)} aria-busy={pending}
        onInvalid={event => { event.preventDefault(); if (form.current) focusInvalidField(form.current); }} className={`${showGoogle ? "" : "mt-7 "}space-y-5`}>
        <input type="hidden" name="next" value={next} />
        {mode !== "update" && <div>
          <label htmlFor="email" className="text-sm font-semibold">Email</label>
          <input id="email" type="email" name="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} required
            aria-invalid={state.field === "email" || undefined} aria-describedby={state.field === "email" ? "form-error" : undefined}
            className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring" />
        </div>}
        {mode !== "forgot" && <PasswordField newPassword={mode !== "sign-in"} invalid={state.field === "password"} />}
        <FormError>{state.error}</FormError>
        {confirmationFailed && <Link href={`${authPath("/check-email", next)}&kind=signup`} className={`${linkClass} block text-sm font-medium text-primary`}>Send a new confirmation link</Link>}
        {state.notice && <p role="status" className="rounded-xl bg-muted px-4 py-3 text-sm leading-6 text-primary">{state.notice}</p>}
        <CooldownSubmit key={state.retryAt ?? 0} retryAt={state.retryAt} pending={pending} label={text.submit} pendingLabel={text.pending} />
      </form>
    </AuthShell>
  );
}
