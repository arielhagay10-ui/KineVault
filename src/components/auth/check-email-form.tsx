"use client";

import { useActionState, useRef } from "react";
import Link from "next/link";
import { resendAuthEmail, type AuthState } from "@/app/sign-in/actions";
import { FormError, focusInvalidField, submitPreservingValues, useFormErrorFocus } from "@/components/ui/form-feedback";
import { authPath } from "@/lib/auth-navigation";
import { AuthShell } from "./auth-shell";
import { CooldownSubmit } from "./cooldown-submit";

export function CheckEmailForm({ email, kind, next, retryAt, initialSeconds }: {
  email: string; kind: "signup" | "recovery"; next: string; retryAt: number; initialSeconds: number;
}) {
  const [state, action, pending] = useActionState<AuthState, FormData>(resendAuthEmail, { error: null, notice: null, retryAt });
  const form = useRef<HTMLFormElement>(null);
  useFormErrorFocus(form, state.error, state.field);
  const recovery = kind === "recovery";
  const title = email ? "Check your email" : recovery ? "Get a new reset link" : "Get a new confirmation link";
  const description = recovery
    ? "If an account uses this address, you'll receive a link to choose a new password. Check your spam folder too."
    : "If this address needs confirmation, you'll receive a link to finish creating your account. Check your spam folder too.";
  return (
    <AuthShell title={title} description={description} footer={<>
      <Link href={authPath(recovery ? "/reset-password" : "/sign-up", next)} className="rounded font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">Use a different email</Link>
      <Link href={authPath("/sign-in", next)} className="rounded text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">Back to sign in</Link>
    </>}>
      <form ref={form} action={action} onSubmit={event => submitPreservingValues(event, action)} aria-busy={pending}
        onInvalid={event => { event.preventDefault(); if (form.current) focusInvalidField(form.current); }} className="mt-7 space-y-5">
        <input type="hidden" name="kind" value={kind} /><input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="email" className="text-sm font-semibold">Email</label>
          <input id="email" name="email" type="email" defaultValue={email} readOnly={Boolean(email)} required maxLength={254} autoComplete="email" autoCapitalize="none" spellCheck={false}
            aria-invalid={state.field === "email" || undefined} aria-describedby={state.field === "email" ? "form-error" : undefined}
            className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring" />
        </div>
        <FormError>{state.error}</FormError>
        {state.notice && <p role="status" className="rounded-xl bg-muted px-4 py-3 text-sm leading-6 text-primary">{state.notice}</p>}
        <CooldownSubmit key={state.retryAt ?? 0} retryAt={state.retryAt} initialSeconds={state.retryAt === retryAt ? initialSeconds : undefined} pending={pending}
          label={email ? "Resend email" : recovery ? "Send reset email" : "Send confirmation email"} pendingLabel="Sending email..." />
        <p className="text-xs leading-5 text-muted-foreground">Use the newest email. Each link works once.</p>
      </form>
    </AuthShell>
  );
}
