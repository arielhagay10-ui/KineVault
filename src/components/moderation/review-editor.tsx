"use client";

import { useActionState } from "react";
import { editSubmission } from "@/app/admin/submissions/actions";
import { reviseExercise } from "@/app/admin/exercises/actions";
import { Constants } from "@/lib/database.types";
import type { ReviewOptions } from "@/lib/moderation/content";
import { humanLabel, reviewFieldLabels, type ReviewPatch } from "@/lib/moderation/schema";
import type { Option } from "@/lib/private-exercises/options";

const inputClass = "mt-2 w-full rounded-xl border border-[#cfdbd2] bg-white px-3 py-2.5 text-sm focus:outline-2 focus:outline-[#398d64]";
const enums = Constants.public.Enums;
const instructionFields = ["setup_instructions", "execution_instructions", "form_cues", "common_mistakes", "safety_notes", "range_of_motion_notes"] as const;
const enumFields = {
  difficulty: enums.exercise_difficulty, exercise_type: enums.exercise_type, mechanic: enums.exercise_mechanic,
  force_type: enums.force_type, laterality: enums.laterality, resistance_profile: enums.resistance_profile,
  peak_resistance_position: enums.peak_resistance_position, classification_confidence: enums.classification_confidence,
} as const;

export function ReviewEditor({ submissionId, exerciseId, contentId, initial, options }: {
  submissionId?: string; exerciseId?: string; contentId?: string; initial: ReviewPatch; options: ReviewOptions;
}) {
  const [state, action, pending] = useActionState(exerciseId ? reviseExercise : editSubmission, { error: null });
  const taxonomyFields = {
    family: options.families, body_position: options.bodyPositions, grip: options.grips,
    stance: options.stances, plane: options.planes, resistance_source: options.resistanceSources,
  } as const;
  return <form action={action} className="space-y-6">
    <input type="hidden" name="submissionId" value={submissionId} />
    {exerciseId && <><input type="hidden" name="exerciseId" value={exerciseId} /><input type="hidden" name="contentId" value={contentId} /></>}
    <label className="block text-sm font-semibold">Name<input name="name" required minLength={2} maxLength={160} defaultValue={initial.name} className={inputClass} /></label>
    <label className="block text-sm font-semibold">Description<textarea name="description" maxLength={500} rows={3} defaultValue={initial.description ?? ""} className={inputClass} /></label>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(taxonomyFields).map(([field, choices]) => <label key={field} className="block text-sm font-semibold">
        {reviewFieldLabels[field as keyof typeof taxonomyFields]}
        <select name={field} defaultValue={initial[field as keyof typeof taxonomyFields] ?? ""} className={inputClass}>
          <option value="">Not classified</option>{choices.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
        </select>
      </label>)}
      {Object.entries(enumFields).map(([field, choices]) => <label key={field} className="block text-sm font-semibold">
        {reviewFieldLabels[field as keyof typeof enumFields]}
        <select name={field} defaultValue={initial[field as keyof typeof enumFields] ?? ""} className={inputClass}>
          {field !== "resistance_profile" && field !== "peak_resistance_position" && <option value="">Not classified</option>}
          {choices.map((value) => <option key={value} value={value}>{humanLabel(value)}</option>)}
        </select>
      </label>)}
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <RoleGroup field="muscles" choices={options.muscles} roles={enums.muscle_role} selected={initial.muscles} />
      <RoleGroup field="joints" choices={options.joints} roles={enums.joint_role} selected={initial.joints} />
      <RoleGroup field="joint_actions" choices={options.jointActions} roles={enums.joint_role} selected={initial.joint_actions} />
      <RoleGroup field="equipment" choices={options.equipment} roles={enums.equipment_role} selected={initial.equipment} />
      <ChoiceGroup field="attachments" choices={options.attachments} selected={initial.attachments} />
      <ChoiceGroup field="movement_patterns" choices={options.movementPatterns} selected={initial.movement_patterns} />
    </div>
    <label className="block text-sm font-semibold">Reviewer notes<textarea name="reviewer_notes" rows={3} maxLength={2000} defaultValue={initial.reviewer_notes ?? ""} className={inputClass} />
      <span className="mt-2 block text-xs font-normal leading-5 text-[#617568]">Explain setup dependencies, uncertainty, and the reasoning behind resistance classifications. Approved notes appear on the exercise page.</span>
    </label>
    <details className="rounded-xl border border-[#dce5de] p-4">
      <summary className="cursor-pointer text-sm font-semibold">Instructions and safety</summary>
      <div className="mt-4 grid gap-4 md:grid-cols-2">{instructionFields.map((field) => <label key={field} className="block text-sm font-semibold">
        {reviewFieldLabels[field]}<textarea name={field} rows={3} maxLength={4000} defaultValue={initial[field] ?? ""} className={inputClass} />
      </label>)}</div>
    </details>
    <label className="block text-sm font-semibold">Reason for corrections<textarea name="comment" required minLength={5} maxLength={2000} rows={2} className={inputClass} placeholder="Explain what changed and why." /></label>
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    {state.message && <p role="status" className="text-sm text-[#28785f]">{state.message}</p>}
    <button disabled={pending} className="rounded-xl bg-[#174a3e] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Saving…" : "Save corrections"}</button>
  </form>;
}

function RoleGroup({ field, choices, roles, selected }: {
  field: "muscles" | "joints" | "joint_actions" | "equipment";
  choices: Option[]; roles: readonly string[]; selected: { slug: string; role: string }[];
}) {
  const bySlug = new Map(selected.map((item) => [item.slug, item.role]));
  return <fieldset className="rounded-xl border border-[#dce5de] p-4">
    <legend className="px-1 text-sm font-semibold">{reviewFieldLabels[field]}</legend>
    <div className="max-h-64 space-y-2 overflow-y-auto">{choices.map((item) => <label key={item.slug} className="flex items-center justify-between gap-3 text-sm">
      <span>{item.name}</span><select name={`${field}.${item.slug}`} defaultValue={bySlug.get(item.slug) ?? ""}
        className="w-36 shrink-0 rounded-lg border border-[#cfdbd2] bg-white px-2 py-2">
        <option value="">Not involved</option>{roles.map((role) => <option key={role} value={role}>{humanLabel(role)}</option>)}
      </select>
    </label>)}</div>
  </fieldset>;
}

function ChoiceGroup({ field, choices, selected }: {
  field: "attachments" | "movement_patterns"; choices: Option[]; selected: string[];
}) {
  return <fieldset className="rounded-xl border border-[#dce5de] p-4"><legend className="px-1 text-sm font-semibold">{reviewFieldLabels[field]}</legend>
    <div className="max-h-64 space-y-2 overflow-y-auto">{choices.map((item) => <label key={item.slug} className="flex items-center gap-3 text-sm">
      <input type="checkbox" name={field} value={item.slug} defaultChecked={selected.includes(item.slug)} className="h-4 w-4 accent-[#28785f]" />{item.name}
    </label>)}</div>
  </fieldset>;
}
