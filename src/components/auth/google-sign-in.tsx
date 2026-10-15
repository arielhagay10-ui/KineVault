"use client";

import { useActionState } from "react";
import { signInWithGoogle } from "@/app/sign-in/actions";
import { FormError, submitPreservingValues } from "@/components/ui/form-feedback";

export function GoogleSignIn({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signInWithGoogle, { error: null, notice: null });
  return (
    <>
      <form action={action} onSubmit={event => submitPreservingValues(event, action)} aria-busy={pending} className="mt-7 space-y-3">
        <input type="hidden" name="next" value={next} />
        <button type="submit" disabled={pending}
          className="min-h-12 w-full rounded-xl border border-input bg-background px-5 py-3 text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-60">
          {pending ? "Opening Google..." : "Continue with Google"}
        </button>
        <FormError id="google-auth-error">{state.error}</FormError>
      </form>
      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" /><span>or use your email</span><span className="h-px flex-1 bg-border" /></div>
    </>
  );
}
