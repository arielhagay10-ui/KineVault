"use client";

import { useActionState } from "react";
import { moderatePublicExercise } from "@/app/admin/exercises/actions";

export function PublicModerationForm({ exerciseId, hidden, verified, canRestore, openReports }: {
  exerciseId: string; hidden: boolean; verified: boolean; canRestore: boolean; openReports: number;
}) {
  const [state, action, pending] = useActionState(moderatePublicExercise, { error: null, updated: false });
  const button = "min-h-11 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold disabled:opacity-60";
  return <form action={action} className="space-y-4">
    <input type="hidden" name="exerciseId" value={exerciseId} />
    <label htmlFor="moderation-comment" className="block text-sm font-semibold">Moderation reason</label>
    <textarea id="moderation-comment" name="comment" required maxLength={2000} rows={3} className="w-full rounded-xl border border-border bg-card p-3" />
    <p className="text-xs text-muted-foreground">Decisions and reasons are saved in the moderation history.</p>
    {state.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{state.error}</p>}
    {state.updated && <p role="status" className="text-sm text-primary">Updated. The decision is saved.</p>}
    <div className="flex flex-wrap gap-3">
      {!hidden && !verified && <button name="action" value="verify" disabled={pending} className={button}>Mark verified</button>}
      {!hidden && verified && <button name="action" value="unverify" disabled={pending} className={button}>Remove verification</button>}
      {!hidden && <button name="action" value="hide" disabled={pending} className={button}>Hide exercise</button>}
      {hidden && canRestore && <button name="action" value="restore" disabled={pending} className={button}>Restore exercise</button>}
      {openReports > 0 && <button name="action" value="resolve_reports" disabled={pending} className={button}>Resolve reports</button>}
    </div>
  </form>;
}
