"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { submitPrivateExercise } from "@/app/my-exercises/[id]/submit/actions";

export type DuplicateCandidate = {
  exercise_id: string;
  slug: string;
  name: string;
  score: number;
  exact_name: boolean;
  alias_match: boolean;
  same_family: boolean;
  shared_equipment: number;
  shared_muscles: number;
  shared_joint_actions: number;
  shared_patterns: number;
};

type Suggestion = { taxonomyName: "exercise_families" | "muscles" | "joint_actions" | "equipment" | "joints" | "equipment_categories" | "attachments" | "movement_patterns"; suggestedName: string; explanation: string };

export function SubmissionForm({ privateId, revisionOfId, candidates, motionReady, missingRequired, duplicatesReady }: {
  privateId: string; revisionOfId: string | null;
  candidates: DuplicateCandidate[]; motionReady: boolean;
  missingRequired: string[]; duplicatesReady: boolean;
}) {
  const [choice, setChoice] = useState("new");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [state, action, pending] = useActionState(submitPrivateExercise, { error: null });
  const [disposition, relatedExerciseId] = choice.split(":");
  const ready = motionReady && duplicatesReady && missingRequired.every((required) =>
    suggestions.some((suggestion) => suggestion.taxonomyName === required && suggestion.suggestedName.trim().length >= 2));
  const updateSuggestion = (index: number, change: Partial<Suggestion>) =>
    setSuggestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...change } : item));

  return <form action={action} className="space-y-6">
    <input type="hidden" name="privateId" value={privateId} />
    <input type="hidden" name="revisionOfId" value={revisionOfId ?? ""} />
    <input type="hidden" name="disposition" value={disposition} />
    <input type="hidden" name="relatedExerciseId" value={relatedExerciseId ?? ""} />
    <input type="hidden" name="suggestions" value={JSON.stringify(suggestions)} />
    <section className="rounded-2xl border border-[#dce5de] bg-white p-6">
      <h2 className="text-xl font-semibold">Missing a taxonomy value?</h2>
      <p className="mt-2 text-sm leading-6 text-[#647568]">Suggest a new family, muscle, joint action, or other classification. A reviewer will map or create the value before publication.</p>
      {suggestions.map((suggestion, index) => <div key={index} className="mt-4 rounded-xl border border-[#e0e9e0] bg-[#fafcf9] p-4">
        <div className="flex items-center justify-between"><p className="text-sm font-semibold">Suggestion {index + 1}</p><button type="button" onClick={() => setSuggestions((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-xs font-semibold text-red-700">Remove</button></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold">Classification
            <select value={suggestion.taxonomyName} onChange={(event) => updateSuggestion(index, { taxonomyName: event.target.value as Suggestion["taxonomyName"] })} className="mt-1 w-full rounded-lg border border-[#cfdbd2] bg-white p-2.5 text-sm">
              <option value="exercise_families">Exercise family</option><option value="muscles">Muscle</option><option value="joint_actions">Joint action</option><option value="joints">Joint</option><option value="equipment">Equipment</option><option value="equipment_categories">Equipment category</option><option value="attachments">Attachment</option><option value="movement_patterns">Movement pattern</option>
            </select>
          </label>
          <label className="text-xs font-semibold">Suggested name
            <input value={suggestion.suggestedName} onChange={(event) => updateSuggestion(index, { suggestedName: event.target.value })} maxLength={120} placeholder="Name the missing value" className="mt-1 w-full rounded-lg border border-[#cfdbd2] bg-white p-2.5 text-sm" />
          </label>
        </div>
        <label className="mt-3 block text-xs font-semibold">Why is it needed?
          <textarea value={suggestion.explanation} onChange={(event) => updateSuggestion(index, { explanation: event.target.value })} maxLength={1000} rows={2} className="mt-1 w-full rounded-lg border border-[#cfdbd2] bg-white p-2.5 text-sm" />
        </label>
      </div>)}
      <button type="button" disabled={suggestions.length >= 8} onClick={() => setSuggestions((current) => [...current, { taxonomyName: "exercise_families", suggestedName: "", explanation: "" }])} className="mt-4 rounded-lg border border-[#b7ceb9] px-4 py-2 text-sm font-semibold text-[#28664e] disabled:opacity-50">Add suggestion</button>
    </section>
    <section className="rounded-2xl border border-[#dce5de] bg-white p-6">
      <h2 className="text-xl font-semibold">Compare with the public library</h2>
      <p className="mt-2 text-sm leading-6 text-[#647568]">Similar names and biomechanics are review hints. A close match can still be a distinct variation.</p>
      <div className="mt-5 space-y-3">
        {candidates.map((candidate) => <div key={candidate.exercise_id} className="rounded-xl border border-[#e0e9e0] bg-[#fafcf9] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={`/exercises/${candidate.slug}`} target="_blank" className="font-semibold text-[#25684f] underline">{candidate.name} ↗</Link>
            <span className="rounded-full bg-[#e4efe7] px-2.5 py-1 text-xs font-semibold text-[#2e6950]">{candidate.score}% match estimate</span>
          </div>
          <p className="mt-2 text-xs text-[#6a7c6f]">{[
            candidate.exact_name && "same name", candidate.alias_match && "alias match",
            candidate.same_family && "same family", candidate.shared_equipment > 0 && "shared equipment",
            candidate.shared_joint_actions > 0 && "shared joint actions",
            candidate.shared_muscles > 0 && "shared muscles",
          ].filter(Boolean).join(" · ") || "similar wording"}</p>
          <div className="mt-3 flex flex-wrap gap-5 text-sm">
            <label className="inline-flex items-center gap-2"><input type="radio" name="duplicateChoice" value={`variation:${candidate.exercise_id}`} checked={choice === `variation:${candidate.exercise_id}`} onChange={() => setChoice(`variation:${candidate.exercise_id}`)} className="accent-[#26775b]" /> My exercise is a variation</label>
            <label className="inline-flex items-center gap-2"><input type="radio" name="duplicateChoice" value={`possible_duplicate:${candidate.exercise_id}`} checked={choice === `possible_duplicate:${candidate.exercise_id}`} onChange={() => setChoice(`possible_duplicate:${candidate.exercise_id}`)} className="accent-[#26775b]" /> This may be the same exercise</label>
          </div>
        </div>)}
        {candidates.length === 0 && <p className="rounded-xl bg-[#f2f7f2] p-4 text-sm text-[#526b5b]">No close public matches found. Reviewers will still check for duplicates.</p>}
      </div>
      <label className="mt-5 flex items-start gap-3 rounded-xl border border-[#dce5de] p-4 text-sm">
        <input type="radio" name="duplicateChoice" value="new" checked={choice === "new"} onChange={() => setChoice("new")} className="mt-0.5 accent-[#26775b]" />
        <span><strong>This is a new public exercise</strong><span className="mt-1 block text-[#65786a]">The exercise is meaningfully distinct from the matches above.</span></span>
      </label>
    </section>
    <section className="rounded-2xl border border-[#dce5de] bg-white p-6">
      <h2 className="text-xl font-semibold">Publication and reuse</h2>
      <p className="mt-2 text-sm leading-6 text-[#647568]">Submitting freezes a copy for review. Your private draft stays editable. Reviewers can correct metadata and request a clearer demonstration.</p>
      <label className="mt-5 flex items-start gap-3 text-sm leading-6">
        <input type="checkbox" name="allowMotionReuse" className="mt-1 accent-[#26775b]" />
        <span>Allow others to copy and remix my approved motion inside KineVault, with attribution.</span>
      </label>
    </section>
    {state.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</p>}
    <div className="flex flex-wrap items-center gap-4">
      <button type="submit" disabled={pending || !ready} className="rounded-xl bg-[#174a3e] px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Submitting…" : revisionOfId ? "Send revised exercise" : "Submit for review"}</button>
      {!ready && <p className="text-sm text-[#8a6e3c]">Complete the motion demo and required classifications or suggest the missing values.</p>}
    </div>
  </form>;
}
