"use client";

import { useActionState } from "react";
import Link from "next/link";
import { savePrivateExercise } from "@/app/my-exercises/actions";
import type { PrivateExerciseInput } from "@/lib/private-exercises/schema";
import type { Option, PrivateExerciseOptions } from "@/lib/private-exercises/options";

const resistanceProfiles = [
  ["unknown", "Unknown / not reviewed"],
  ["ascending", "Ascending"],
  ["descending", "Descending"],
  ["bell_shaped", "Bell shaped"],
  ["relatively_constant", "Relatively constant"],
  ["variable_complex", "Variable / complex"],
] as const;

export function PrivateExerciseForm({ initial, options }: {
  initial: PrivateExerciseInput;
  options: PrivateExerciseOptions;
}) {
  const [state, action, pending] = useActionState(savePrivateExercise, { error: null });

  return (
    <form action={action} className="space-y-6">
      {initial.privateId && <input type="hidden" name="privateId" value={initial.privateId} />}
      <section className="rounded-2xl border border-[#dce5de] bg-white p-6">
        <h2 className="text-xl font-semibold">Exercise basics</h2>
        <label htmlFor="name" className="mt-5 block text-sm font-semibold">Name</label>
        <input id="name" name="name" required minLength={2} maxLength={160}
          defaultValue={initial.name} placeholder="For example, Cable Lateral Raise"
          className="mt-2 w-full rounded-xl border border-[#cfdbd2] px-4 py-3 outline-none focus:border-[#398d64] focus:ring-2 focus:ring-[#d5ebdb]" />
        <label htmlFor="shortDescription" className="mt-5 block text-sm font-semibold">Short description</label>
        <textarea id="shortDescription" name="shortDescription" rows={3} maxLength={500}
          defaultValue={initial.shortDescription} placeholder="Describe what makes this variation distinct."
          className="mt-2 w-full rounded-xl border border-[#cfdbd2] px-4 py-3 outline-none focus:border-[#398d64] focus:ring-2 focus:ring-[#d5ebdb]" />
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="familySlug" className="block text-sm font-semibold">Exercise family</label>
            <select id="familySlug" name="familySlug" defaultValue={initial.familySlug ?? ""}
              className="mt-2 w-full rounded-xl border border-[#cfdbd2] bg-white px-4 py-3">
              <option value="">Choose later</option>
              {options.families.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="bodyPositionSlug" className="block text-sm font-semibold">Body position</label>
            <select id="bodyPositionSlug" name="bodyPositionSlug" defaultValue={initial.bodyPositionSlug ?? ""}
              className="mt-2 w-full rounded-xl border border-[#cfdbd2] bg-white px-4 py-3">
              <option value="">Choose later</option>
              {options.bodyPositions.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#dce5de] bg-white p-6">
        <h2 className="text-xl font-semibold">Anatomy</h2>
        <p className="mt-2 text-sm text-[#65786a]">Choose only what you can classify confidently. A muscle can have one role.</p>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <CheckboxGroup title="Primary muscles" name="primaryMuscle" options={options.muscles} selected={initial.primaryMuscles} />
          <CheckboxGroup title="Secondary muscles" name="secondaryMuscle" options={options.muscles} selected={initial.secondaryMuscles} />
          <CheckboxGroup title="Stabilizers" name="stabilizerMuscle" options={options.muscles} selected={initial.stabilizerMuscles} />
          <CheckboxGroup title="Joints" name="joint" options={options.joints} selected={initial.joints} />
          <CheckboxGroup title="Joint actions" name="jointAction" options={options.jointActions} selected={initial.jointActions} />
        </div>
      </section>

      <section className="rounded-2xl border border-[#dce5de] bg-white p-6">
        <h2 className="text-xl font-semibold">Equipment and resistance</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <CheckboxGroup title="Equipment" name="equipment" options={options.equipment} selected={initial.equipment} />
          <div>
            <label htmlFor="resistanceProfile" className="block text-sm font-semibold">External resistance profile</label>
            <select id="resistanceProfile" name="resistanceProfile" defaultValue={initial.resistanceProfile}
              className="mt-2 w-full rounded-xl border border-[#cfdbd2] bg-white px-4 py-3">
              {resistanceProfiles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <p className="mt-2 text-xs leading-5 text-[#738477]">Choose Unknown when equipment geometry or setup makes the profile uncertain.</p>
          </div>
        </div>
      </section>

      {state.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending}
          className="rounded-xl bg-[#174a3e] px-6 py-3 text-sm font-semibold text-white hover:bg-[#246a53] disabled:opacity-60">
          {pending ? "Saving…" : "Save privately"}
        </button>
        <Link href="/my-exercises" className="text-sm font-medium text-[#526b5b] hover:underline">Back to my exercises</Link>
      </div>
    </form>
  );
}

function CheckboxGroup({ title, name, options, selected }: {
  title: string; name: string; options: Option[]; selected: readonly string[];
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold">{title}</legend>
      <div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-xl border border-[#dce5de] bg-[#fafcf9] p-3">
        {options.map((option) => (
          <label key={option.slug} className="flex cursor-pointer items-start gap-2 text-sm text-[#455d4c]">
            <input type="checkbox" name={name} value={option.slug} defaultChecked={selected.includes(option.slug)}
              className="mt-0.5 accent-[#26775b]" />
            <span>{option.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
