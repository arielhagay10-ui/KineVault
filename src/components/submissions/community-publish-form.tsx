"use client";

import { useActionState } from "react";
import { publishPrivateExercise } from "@/app/my-exercises/[id]/submit/actions";

export function CommunityPublishForm({ privateId }: { privateId: string }) {
  const [state, action, pending] = useActionState(publishPrivateExercise, { error: null });
  return <form action={action} className="mt-6 space-y-4">
    <input type="hidden" name="privateId" value={privateId} />
    {state.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{state.error}</p>}
    <button type="submit" disabled={pending} className="min-h-11 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60">{pending ? "Publishing…" : "Publish exercise"}</button>
  </form>;
}
