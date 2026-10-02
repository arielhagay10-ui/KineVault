"use client";

import { useActionState } from "react";
import { duplicatePrivateExercise } from "@/app/my-exercises/actions";

export function DuplicatePrivateButton({ privateId }: { privateId: string }) {
  const [state, action, pending] = useActionState(duplicatePrivateExercise, { error: null });
  return <form action={action}>
    <input type="hidden" name="privateId" value={privateId} />
    <button type="submit" disabled={pending} className="min-h-11 rounded-xl border border-border bg-card px-4 py-3 text-base font-semibold disabled:opacity-60">
      {pending ? "Copying..." : "Duplicate / use as template"}
    </button>
    {state.error && <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">{state.error}</p>}
  </form>;
}
