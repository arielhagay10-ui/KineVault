"use client";

import { useState } from "react";
import type { Option } from "@/lib/private-exercises/options";
import { suggestWorkingMuscles, type MuscleRole } from "@/lib/private-exercises/muscle-suggestions";

export function MuscleSuggestions({ actions, actionOptions, muscles, selectedMuscles, resistanceSource, grip, bodyPosition, onAdd }: {
  actions: string[]; actionOptions: Option[]; muscles: Option[]; selectedMuscles: string[];
  resistanceSource: string; grip: string; bodyPosition: string;
  onAdd: (slug: string, role: MuscleRole) => boolean;
}) {
  const [resistedActions, setResistedActions] = useState<string[]>([]);
  const [roles, setRoles] = useState<Record<string, MuscleRole | "">>({});
  const [message, setMessage] = useState<string | null>(null);
  const result = suggestWorkingMuscles({ actions, resistedActions, resistanceSource, grip: grip || null,
    bodyPosition: bodyPosition || null, availableMuscles: muscles.map(item => item.slug) });
  const name = (slug: string) => muscles.find(item => item.slug === slug)?.name ?? slug;
  const actionName = (slug: string) => actionOptions.find(item => item.slug === slug)?.name ?? slug.replaceAll("-", " ");
  const remaining = result.muscles.filter(item => !selectedMuscles.includes(item.slug));
  return <section aria-labelledby="muscle-suggestions-title" className="mt-6 border-t border-border pt-6">
    <h3 id="muscle-suggestions-title" className="text-lg font-semibold">Suggest working muscles</h3>
    <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">Confirm the actions that work against resistance, then choose a role for each suggested muscle.</p>
    {!!actions.length && <fieldset className="mt-4">
      <legend className="text-base font-semibold">Which actions work against resistance?</legend>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">For a curl, choose elbow flexion even when lowering under control. If both directions are separately resisted, review those muscles manually.</p>
      <div className="mt-2 grid gap-x-5 sm:grid-cols-2">{actions.map(action => <label key={action} className="flex min-h-11 items-center gap-3 text-sm capitalize">
        <input type="checkbox" checked={resistedActions.includes(action)} className="size-5 shrink-0 accent-primary"
          onChange={event => {
            const checked = event.target.checked;
            setMessage(null);
            setResistedActions(current => checked ? [...current, action] : current.filter(item => item !== action));
          }} />
        {actionName(action)}
      </label>)}</div>
    </fieldset>}
    <div aria-live="polite" className="mt-4 space-y-3">
      {result.status === "partial" && <p className="text-sm font-semibold">Partial suggestions. Some involvement remains unknown.</p>}
      {!!result.unknownActions.length && <p className="text-sm text-muted-foreground">Needs manual review: {result.unknownActions.map(actionName).join(", ")}.</p>}
      {result.notes.map(note => <p key={note} className="max-w-prose text-sm leading-6 text-muted-foreground">{note}</p>)}
      {!!result.muscles.length && !remaining.length && <p className="text-sm">All suggested muscles are already selected. Your roles were kept.</p>}
    </div>
    {!!remaining.length && <ul className="mt-4 divide-y divide-border border-y border-border">{remaining.map(item => <li key={item.slug} className="py-4">
      <h4 className="font-semibold">{name(item.slug)}</h4>
      <ul className="mt-2 space-y-2 text-sm leading-6 text-muted-foreground">{item.reasons.map(reason => <li key={reason.action}>
        <span className="capitalize">{actionName(reason.action)}</span>: {reason.description}{" "}
        <a href={reason.source} target="_blank" rel="noreferrer" className="underline underline-offset-4">Anatomy reference<span className="sr-only"> for {name(item.slug)}, opens a new tab</span></a>
      </li>)}</ul>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="min-w-0 text-sm font-medium">Role for {name(item.slug)}
          <select value={roles[item.slug] ?? ""} onChange={event => {
            const value = event.target.value as MuscleRole | "";
            setRoles(current => ({ ...current, [item.slug]: value }));
          }}
            className="mt-1 block min-h-11 max-w-full rounded-lg border border-border bg-card px-3 text-base">
            <option value="">Choose a role</option><option value="primary">Primary</option>
            <option value="secondary">Secondary</option><option value="stabilizer">Stabilizer</option>
          </select>
        </label>
        <button type="button" disabled={!roles[item.slug]} onClick={() => {
          const role = roles[item.slug];
          if (role) setMessage(onAdd(item.slug, role)
            ? `${name(item.slug)} added. Save privately to keep this classification.`
            : "This muscle is already selected or that role has 20 entries. Review the current selections first.");
        }} className="min-h-11 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50">Add {name(item.slug)}</button>
      </div>
    </li>)}</ul>}
    <p role="status" className="mt-3 text-sm text-primary">{message ?? ""}</p>
    <p className="mt-3 max-w-prose text-sm leading-6 text-muted-foreground">Suggestions are unverified and may be incomplete. They do not estimate activation percentages.</p>
  </section>;
}
