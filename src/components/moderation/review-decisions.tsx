"use client";


import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { useActionState, useState } from "react";
import { decideSubmission } from "@/app/admin/submissions/actions";
import { Constants } from "@/lib/database.types";
import { humanLabel } from "@/lib/moderation/schema";

type Target = { id: string; name: string };
const inputClass = "mt-2 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm";

export function ReviewDecisions({ submissionId, status, defaultSlug, targets, relatedId, renderFailed, disabled, candidate }: {
  submissionId: string; status: string; defaultSlug: string; targets: Target[];
  relatedId: string | null; renderFailed: boolean; disabled: boolean;
  candidate?: { id: string; slug: string } | null;
}) {
  const [state, action, pending] = useActionState(decideSubmission, { error: null });
  const [decision, setDecision] = useState(status === "submitted" ? "begin" : "approve");
  const decisions = status === "submitted" ? ["begin"] : status === "in_review" ? ["approve", "request_changes", "reject", "merge"] : [];
  if (renderFailed && ["submitted", "in_review"].includes(status)) decisions.push("retry");
  if (!decisions.length) return <p className="text-sm text-muted-foreground">This review is {humanLabel(status)}.</p>;
  return <form action={action} className="space-y-4">
    <input type="hidden" name="submissionId" value={submissionId} />
    <fieldset disabled={disabled || pending} className="space-y-4 disabled:opacity-60">
      <label className="block text-sm font-semibold">Decision<select name="decision" value={decision} onChange={(event) => setDecision(event.target.value)} className={inputClass}>
        {decisions.map((item) => <option key={item} value={item}>{item === "begin" ? "Begin review" : item === "retry" ? "Retry failed render" : humanLabel(item)}</option>)}
      </select></label>
      {decision === "approve" && <>
        {candidate && <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="candidateId" value={candidate.id} defaultChecked className="mt-1 accent-primary" />
          Publish the original catalog candidate. Keep its URL ({candidate.slug}) and existing relationships.
        </label>}
        <label className="block text-sm font-semibold">Public URL slug<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={120} defaultValue={defaultSlug} className={inputClass} /></label>
        <label className="block text-sm font-semibold">Publish as<select name="relation" defaultValue={relatedId ? "variation" : "new"} className={inputClass}>
          <option value="new">Independent exercise</option><option value="variation">Variation of an existing exercise</option>
        </select></label>
        <p className="text-xs leading-5 text-muted-foreground">Approval requires completed WebM, MP4, and poster assets.</p>
      </>}
      {(decision === "approve" || decision === "merge") && <label className="block text-sm font-semibold">Existing exercise
        <select name="relatedId" defaultValue={relatedId ?? ""} required={decision === "merge"} className={inputClass}>
          <option value="">Choose an existing exercise</option>{targets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <span className="mt-2 block text-xs font-normal text-muted-foreground">Choose a comparison above to include another exercise here.</span>
      </label>}
      {(decision === "reject" || decision === "request_changes") && <label className="block text-sm font-semibold">Reason<select name="reason" defaultValue="other" className={inputClass}>
        {Constants.public.Enums.moderation_reason.map((item) => <option key={item} value={item}>{humanLabel(item)}</option>)}
      </select></label>}
      {!["begin", "retry"].includes(decision) && <label className="block text-sm font-semibold">Review comment<Textarea name="comment" maxLength={2000} minLength={decision === "approve" ? undefined : 5} required={decision !== "approve"} rows={3} className={inputClass} /></label>}
      {decision === "merge" && <p className="text-xs leading-5 text-muted-foreground">Merge adds the submitted name as an alias. The existing classifications and motion remain the canonical version, with submission history preserved.</p>}
      <button className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">{pending ? "Saving…" : "Record decision"}</button>
    </fieldset>
    {disabled && <p className="text-sm text-amber-800 dark:text-amber-200">Another reviewer is assigned to this submission.</p>}
    {state.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{state.error}</p>}
    {state.message && <p role="status" className="text-sm text-primary">{state.message}{state.href && <> <Link href={state.href} className="font-semibold underline">View exercise</Link></>}</p>}
  </form>;
}
