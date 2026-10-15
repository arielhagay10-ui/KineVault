"use client";

import { useActionState, useRef } from "react";
import Link from "next/link";
import { confirmEmail } from "@/app/auth/confirm/actions";
import { authPath } from "@/lib/auth-navigation";
import { FormError, submitPreservingValues, useFormErrorFocus } from "@/components/ui/form-feedback";
import { AuthShell } from "./auth-shell";

export function ConfirmEmailForm({ tokenHash, type, next }: { tokenHash: string | null; type: "email" | "recovery"; next: string }) {
  const [state, action, pending] = useActionState(confirmEmail, { error: null, notice: null });
  const form = useRef<HTMLFormElement>(null);
  useFormErrorFocus(form, state.error);
  const recovery = type === "recovery";
  const title = !tokenHash ? "This link is incomplete" : recovery ? "Reset your password" : "Confirm your email";
  return (
    <AuthShell title={title} description={!tokenHash ? "Request a new email to continue." : recovery
      ? "Continue to choose a new password for your account." : "Confirm your email to finish signing in to KineVault."}
      footer={<Link href={`${authPath("/check-email", next)}&kind=${recovery ? "recovery" : "signup"}`}
        className="rounded font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">Send a new link</Link>}>
      {tokenHash && <form ref={form} action={action} onSubmit={event => submitPreservingValues(event, action)} aria-busy={pending} className="mt-7 space-y-5">
        <input type="hidden" name="token_hash" value={tokenHash} /><input type="hidden" name="type" value={type} /><input type="hidden" name="next" value={next} />
        <FormError>{state.error}</FormError>
        <button type="submit" disabled={pending}
          className="min-h-12 w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-60">
          {pending ? "Checking your link..." : recovery ? "Choose a new password" : "Confirm email"}
        </button>
      </form>}
    </AuthShell>
  );
}
