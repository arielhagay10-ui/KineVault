"use client";


import { Textarea } from "@/components/ui/textarea";
import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { savePrivateExercise } from "@/app/my-exercises/actions";
import type { PrivateExerciseInput } from "@/lib/private-exercises/schema";
import type { ReviewOptions } from "@/lib/moderation/content";
import type { ReviewPatch } from "@/lib/moderation/schema";
import type { WorkshopScene } from "@/lib/motion/workshop";
import { suggestSceneDetails } from "@/lib/private-exercises/details";
import { AdvancedPrivateFields } from "./advanced-fields";
import { SelectedPrivateOptions } from "./selected-options";
import { useMetadataGuard } from "./use-metadata-guard";
import { FormError, focusInvalidField, submitPreservingValues, useFormErrorFocus } from "@/components/ui/form-feedback";
import { readMetadataRecovery, matchesSavedMetadata, type MetadataRecovery } from "@/lib/private-exercises/metadata-recovery";

const resistanceProfiles = [
  ["unknown", "Unknown / not reviewed"], ["ascending", "Ascending"], ["descending", "Descending"],
  ["bell_shaped", "Bell shaped"], ["relatively_constant", "Relatively constant"], ["variable_complex", "Variable / complex"],
] as const;

type FormProps = {
  ownerId: string;
  initial: PrivateExerciseInput; options: ReviewOptions; metadata?: ReviewPatch; scene?: WorkshopScene | null;
};

export function PrivateExerciseForm(props: FormProps) {
  const recoveryKey = `kv-metadata:${props.ownerId}:${props.initial.privateId}`;
  const [savedMetadata] = useState(props.metadata);
  const [draftId] = useState(props.initial.privateId);
  const [loaded, setLoaded] = useState(false);
  const [recovery, setRecovery] = useState<MetadataRecovery | null>(null);
  const [restored, setRestored] = useState<MetadataRecovery | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const copy = readMetadataRecovery(sessionStorage.getItem(recoveryKey), draftId);
        if (copy && !matchesSavedMetadata(copy.metadata, savedMetadata)) setRecovery(copy);
        else sessionStorage.removeItem(recoveryKey);
      } catch { /* Navigation guards remain available. */ }
      setLoaded(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [recoveryKey, draftId, savedMetadata]);
  if (!loaded) return <p role="status" className="text-sm text-muted-foreground">Loading exercise details…</p>;
  if (recovery) return <section className="rounded-2xl border border-border bg-card p-6">
    <h2 className="text-xl font-semibold">Restore unsaved exercise details?</h2>
    <p className="mt-2 text-sm text-muted-foreground">Edits from this account and tab were kept on this device.</p>
    <div className="mt-5 flex flex-wrap gap-3">
      <button type="button" onClick={() => { setRestored(recovery); setRecovery(null); }} className="min-h-11 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Restore details</button>
      <button type="button" onClick={() => { try { sessionStorage.removeItem(recoveryKey); } catch { /* Continue editing. */ } setRecovery(null); }} className="min-h-11 rounded-xl border border-border px-5 py-3 font-semibold">Discard recovered details</button>
    </div>
  </section>;
  return <PrivateExerciseFields {...props} initial={restored?.initial ?? props.initial} metadata={restored?.metadata ?? props.metadata} recoveryKey={recoveryKey} restoredBaseline={restored?.baseline} />;
}

function PrivateExerciseFields({ initial, options, metadata, scene, recoveryKey, restoredBaseline }: FormProps & { recoveryKey: string; restoredBaseline?: string }) {
  const [state, action, pending] = useActionState(savePrivateExercise, { error: null });
  const { form, refresh } = useMetadataGuard(recoveryKey, restoredBaseline);
  useFormErrorFocus(form, state.error, state.field);
  const [equipment, setEquipment] = useState([...initial.equipment]);
  const [anatomy, setAnatomy] = useState({ primary: initial.primaryMuscles, secondary: initial.secondaryMuscles,
    stabilizer: initial.stabilizerMuscles, joints: initial.joints, actions: initial.jointActions });
  const [bodyPosition, setBodyPosition] = useState(initial.bodyPositionSlug ?? "");
  const suggestion = scene ? suggestSceneDetails(scene, options.equipment, options.bodyPositions) : null;
  const suggestedEquipment = suggestion?.equipment.filter(slug => !equipment.includes(slug)) ?? [];
  const suggestedPosition = suggestion?.bodyPosition && suggestion.bodyPosition !== bodyPosition ? suggestion.bodyPosition : null;
  const input = "mt-2 min-h-11 w-full rounded-xl border border-border bg-card px-4 py-3 text-base";

  return <form ref={form} action={action} onSubmit={event => submitPreservingValues(event, action)} onChange={refresh} onInvalid={(event) => {
    event.preventDefault();
    if (form.current) focusInvalidField(form.current);
  }} aria-busy={pending} className="space-y-6">
    {initial.privateId && <input type="hidden" name="privateId" value={initial.privateId} />}
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-xl font-semibold">Exercise name</h2>
      <p className="mt-2 text-sm text-muted-foreground">Your scene and name are enough. Add optional details when you are ready.</p>
      <label htmlFor="name" className="mt-5 block text-base font-semibold">Name</label>
      <input id="name" name="name" required minLength={2} maxLength={160} defaultValue={initial.name}
        aria-invalid={state.field === "name" || undefined} aria-describedby={state.field === "name" ? "form-error" : undefined}
        placeholder="For example, Cable Lateral Raise" className={`${input} outline-none focus:border-primary focus:ring-2 focus:ring-ring`} />
    </section>

    <details className="rounded-2xl border border-border bg-card p-6">
      <summary className="min-h-11 cursor-pointer text-lg font-semibold">Description, equipment and classifications (optional)</summary>
      <label htmlFor="shortDescription" className="mt-5 block text-base font-semibold">Short description</label>
      <Textarea id="shortDescription" name="shortDescription" rows={3} maxLength={500} defaultValue={initial.shortDescription}
        placeholder="Describe what makes this variation distinct." className={input} />
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="familySlug" className="block text-base font-semibold">Exercise family</label>
          <select id="familySlug" name="familySlug" defaultValue={initial.familySlug ?? ""} className={input}>
            <option value="">Unknown / choose later</option>
            {options.families.map(item => <option key={item.slug} value={item.slug}>{item.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="bodyPositionSlug" className="block text-base font-semibold">Body position</label>
          <select id="bodyPositionSlug" name="bodyPositionSlug" value={bodyPosition} onChange={event => setBodyPosition(event.target.value)} className={input}>
            <option value="">Unknown / choose later</option>
            {options.bodyPositions.map(item => <option key={item.slug} value={item.slug}>{item.name}</option>)}
          </select>
        </div>
      </div>
      {!!(suggestedEquipment.length || suggestedPosition) && <section className="mt-5 rounded-xl border border-border bg-muted p-4">
        <h3 className="text-base font-semibold">Suggestions from your scene</h3>
        <p className="mt-1 text-sm text-muted-foreground">Confirm only the details that describe your exercise. Suggestions do not change anatomy.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestedEquipment.map(slug => <button key={slug} type="button" onClick={() => setEquipment([...equipment, slug])}
            className="min-h-11 rounded-lg border border-border bg-card px-3 text-base">Use {options.equipment.find(item => item.slug === slug)?.name}</button>)}
          {suggestedPosition && <button type="button" onClick={() => setBodyPosition(suggestedPosition)}
            className="min-h-11 rounded-lg border border-border bg-card px-3 text-base">Use {options.bodyPositions.find(item => item.slug === suggestedPosition)?.name}</button>}
        </div>
      </section>}
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <SelectedPrivateOptions title="Equipment" name="equipment" options={options.equipment} selected={equipment}
          onChange={setEquipment} roles={metadata?.equipment} rolePrefix="equipmentRole" />
        <div>
          <label htmlFor="resistanceProfile" className="block text-base font-semibold">External resistance profile</label>
          <select id="resistanceProfile" name="resistanceProfile" defaultValue={initial.resistanceProfile} className={input}>
            {resistanceProfiles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Keep Unknown when the setup makes the profile uncertain.</p>
        </div>
      </div>
    </details>

    <details className="rounded-2xl border border-border bg-card p-6">
      <summary className="min-h-11 cursor-pointer text-lg font-semibold"><span>Anatomy (optional)</span>
        <span className="mt-2 flex flex-wrap gap-2 text-sm font-normal">
          {(["primary", "secondary", "stabilizer"] as const).flatMap(role => anatomy[role].map(slug =>
            <span key={`${role}-${slug}`} className="rounded-lg border border-border bg-muted px-3 py-2">{options.muscles.find(item => item.slug === slug)?.name ?? slug} · {role}</span>))}
          {!Object.values(anatomy).some(values => values.length) && <span className="text-muted-foreground">Unknown / not reviewed</span>}
          {anatomy.joints.map(slug => <span key={`joint-${slug}`} className="rounded-lg border border-border bg-muted px-3 py-2">{options.joints.find(item => item.slug === slug)?.name ?? slug}</span>)}
          {anatomy.actions.map(slug => <span key={`action-${slug}`} className="rounded-lg border border-border bg-muted px-3 py-2">{options.jointActions.find(item => item.slug === slug)?.name ?? slug}</span>)}
        </span>
      </summary>
      <p className="mt-2 text-sm text-muted-foreground">Choose only what you can classify confidently. A muscle can have one role. Unselected anatomy stays unknown.</p>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <SelectedPrivateOptions title="Primary muscles" name="primaryMuscle" options={options.muscles} selected={anatomy.primary} onChange={primary => setAnatomy({ ...anatomy, primary })} />
        <SelectedPrivateOptions title="Secondary muscles" name="secondaryMuscle" options={options.muscles} selected={anatomy.secondary} onChange={secondary => setAnatomy({ ...anatomy, secondary })} />
        <SelectedPrivateOptions title="Stabilizers" name="stabilizerMuscle" options={options.muscles} selected={anatomy.stabilizer} onChange={stabilizer => setAnatomy({ ...anatomy, stabilizer })} />
        <SelectedPrivateOptions title="Joints" name="joint" options={options.joints} selected={anatomy.joints} onChange={joints => setAnatomy({ ...anatomy, joints })} roles={metadata?.joints} rolePrefix="jointRole" />
        <SelectedPrivateOptions title="Joint actions" name="jointAction" options={options.jointActions} selected={anatomy.actions} onChange={actions => setAnatomy({ ...anatomy, actions })} roles={metadata?.joint_actions} rolePrefix="actionRole" />
      </div>
    </details>
    <AdvancedPrivateFields initial={metadata} options={options} />
    <FormError>{state.error}</FormError>
    <div className="flex flex-wrap items-center gap-4">
      <button type="submit" disabled={pending} className="min-h-11 rounded-xl bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/85 active:translate-y-px disabled:opacity-60">
        {pending ? "Saving..." : "Save privately"}
      </button>
      <Link href="/my-exercises" className="min-h-11 py-3 text-base font-medium text-muted-foreground hover:underline">Back to my exercises</Link>
    </div>
  </form>;
}
