"use client";

import { useActionState } from "react";
import { reportPublicExercise } from "@/app/exercises/community-actions";

export function ExerciseReport({ exerciseId }: { exerciseId: string }) {
  const [state, action, pending] = useActionState(reportPublicExercise, { error: null, sent: false });
  return <details className="mt-6 border-t border-border pt-4">
    <summary className="min-h-11 cursor-pointer text-sm font-semibold text-muted-foreground">Report exercise</summary>
    {state.sent ? <p role="status" className="mt-3 text-sm text-primary">Report sent. A moderator will review it.</p>
      : <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="exerciseId" value={exerciseId} />
        <label htmlFor="report-reason" className="block text-sm font-semibold">Reason for report</label>
        <textarea id="report-reason" name="reason" required maxLength={2000} rows={3} className="w-full rounded-xl border border-border bg-card p-3" />
        {state.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{state.error}</p>}
        <button disabled={pending} className="min-h-11 rounded-xl border border-border px-4 py-2 text-sm font-semibold disabled:opacity-60">{pending ? "Sending…" : "Send report"}</button>
      </form>}
  </details>;
}
