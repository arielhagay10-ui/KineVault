"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { popularWorkshopEquipment } from "@/lib/motion/quick-create";
import { studioAssetNames } from "@/lib/motion/studio";
import type { StudioObject, WorkshopScene } from "@/lib/motion/workshop";
import { WorkshopEquipmentPicture } from "./workshop-equipment-picture";
import { useWorkshopLanguage } from "./workshop-language";
import { WorkshopGuidance, useWorkshopGuidance } from "./workshop-guidance";

const button = "inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-base font-semibold disabled:opacity-40";
const steps = ["Choose equipment", "Start and finish", "Preview", "Name and save"];
export function WorkshopQuickCreate({ scene, step, onStep, onAddEquipment, onAdd, onPreviewTime, onPoseMoment, onMatchReturn, name, onName, onSave, onDetails, saving, savedId, currentConfirmed, confirmedName, language, onAdvanced, reachWarning, showAddEquipment = true, showSaveAction = true }: {
  scene: WorkshopScene; step: number; onStep: (step: number) => void;
  onAddEquipment: (slug: StudioObject["slug"]) => void; onAdd: () => void; onPreviewTime: (timeMs: number) => void;
  onPoseMoment: (timeMs: number) => void; onMatchReturn: () => void;
  name: string; onName: (name: string) => void; onSave: () => void; saving: boolean; savedId: string | null;
  language: "en" | "he"; onAdvanced: () => void; reachWarning: boolean;
  currentConfirmed: boolean; confirmedName: string; onDetails: () => void;
  showAddEquipment?: boolean; showSaveAction?: boolean;
}) {
  const { t } = useWorkshopLanguage();
  const guidance = useWorkshopGuidance();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  useEffect(() => { if (previousStep.current !== step) heading.current?.focus(); previousStep.current = step; }, [step]);
  return (<section data-tutorial-target="quick" aria-label={t("Quick create")} className="min-w-0 space-y-5 p-4 sm:p-6">
    <ol aria-label={t("Creation progress")} className="flex items-center gap-3">
      {steps.map((label, index) => <li key={label} className="flex-1"><button type="button" aria-label={t(label)} title={t(label)} aria-current={step === index ? "step" : undefined} onClick={() => onStep(index)} className={`${button} w-full px-2 ${step === index ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground"}`}><span aria-hidden="true">{new Intl.NumberFormat(language).format(index + 1)}</span></button></li>)}
    </ol>
    <h2 ref={heading} className="text-xl font-semibold" tabIndex={-1}>{t(steps[step])}</h2>
    {step === 0 && <>
      <p className="text-sm leading-6 text-muted-foreground">{t("Choose equipment, or continue without it for a bodyweight exercise.")}</p>
      <div data-tutorial-target="equipment" aria-label={t("Popular equipment")} className="grid grid-cols-2 gap-2">{popularWorkshopEquipment.map(slug => <button type="button" key={slug} aria-label={t(studioAssetNames[slug])} onClick={() => onAddEquipment(slug)} className={`${button} min-w-0 flex-col gap-2 px-2 py-3 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring`}>
        <WorkshopEquipmentPicture slug={slug} className="h-12 w-full" />
        <span>{t(studioAssetNames[slug])}</span>
      </button>)}</div>
        <button type="button" onClick={event => { event.currentTarget.focus(); onAdd(); }} className={`${button} w-full`}>{t("View all equipment")}</button>
    </>}
    {step === 1 && <>
      <div className="space-y-3 rounded-xl border p-4">
        <p className="text-sm leading-6">{t("Edit start, then edit finish. Each change updates that pose.")}</p>
        <div data-tutorial-target="pose" className="flex w-fit max-w-full flex-wrap gap-2"><button type="button" onClick={() => onPoseMoment(0)} className={button}>{t("Edit start")}</button><button type="button" onClick={() => onPoseMoment(scene.durationMs / 2)} className={button}>{t("Edit finish")}</button></div>
        <button type="button" onClick={onAdvanced} className={button}>{t("Pose body in Advanced")}</button>
        <button type="button" onClick={onMatchReturn} className={button}>{t("Match return to start")}</button>
      {showAddEquipment && <button type="button" onClick={event => { event.currentTarget.focus(); onAdd(); }} className={button}>{t("Add equipment")}</button>}
      </div>
      {reachWarning && <div role="alert" className="rounded-lg border border-red-500 p-3"><p>{t("A hand cannot reach its handle.")}</p></div>}
    </>}
    {step === 2 && <>
      <p className="text-sm leading-6 text-muted-foreground">{t("Play the movement. Check the start, finish, and return before saving.")}</p>
      <div className="flex gap-2"><button type="button" onClick={() => onPreviewTime(0)} className={button}>{t("View start")}</button><button type="button" onClick={() => onPreviewTime(scene.durationMs / 2)} className={button}>{t("View finish")}</button></div>
      <WorkshopGuidance className="text-base text-muted-foreground">{t("Play a full repetition, or use Start and Finish for a static inspection. Check both hands, feet and the return.")}</WorkshopGuidance>
      {guidance && <fieldset className="space-y-2 rounded-xl border p-4"><legend className="px-1 font-semibold">{t("Before saving")}</legend>{["Supports touch the intended body areas", "Both hands and feet stay in contact", "Start and finish look correct", "Return is smooth and matches the start"].map(item => <label key={item} className="flex min-h-11 items-center gap-3 text-base"><input type="checkbox" checked={checked[item] ?? false} onChange={event => setChecked({ ...checked, [item]: event.target.checked })} className="h-5 w-5" />{item}</label>)}</fieldset>}
      <WorkshopGuidance className="text-sm text-muted-foreground">{t("The checklist helps your review; it does not lock saving. Highlight muscles only when you choose them.")}</WorkshopGuidance>
    </>}
    {step === 3 && <>
      <div data-tutorial-target="save" className="space-y-3">
      <label className="block text-base font-semibold">{t("Exercise name")}<input value={name} maxLength={160} onChange={event => onName(event.target.value)} autoComplete="off" className="mt-2 min-h-12 w-full rounded-lg border bg-background p-3 font-normal" placeholder={t("For example, seated cable row")} /></label>
      <WorkshopGuidance className="text-sm text-muted-foreground">{t("This stays private. Muscles, classifications and instructions can be added later.")}</WorkshopGuidance>
      {showSaveAction && <button type="button" onClick={onSave} disabled={name.trim().length < 2} aria-busy={saving} className={`${button} bg-primary text-primary-foreground`}>{t("Save privately")}</button>}
      </div>
      {savedId && currentConfirmed && <article aria-label={t("Saved private exercise")} className="space-y-3 rounded-xl border bg-muted/30 p-4"><h3 className="text-lg font-semibold"><span data-workshop-translate="false">{confirmedName || "Your exercise"}</span> <span className="ms-2 rounded border px-2 py-1 text-sm font-normal">{t("Private")}</span></h3><WorkshopGuidance className="text-sm">{t("Your playable preview is above. Keep editing or add optional details.")}</WorkshopGuidance><button type="button" disabled={saving} onClick={onDetails} className={button}>{t("Add optional details")}</button><Link href="/my-exercises" className={`${button} ms-2`}>{t("My exercises")}</Link></article>}
    </>}
    <nav aria-label={t("Creation steps")} className="flex flex-wrap justify-between gap-3 border-t pt-4"><button type="button" disabled={step === 0} onClick={() => onStep(step - 1)} className={button}>{t("Back")}</button>{step < 3 && <button type="button" onClick={() => onStep(step + 1)} className={`${button} bg-primary text-primary-foreground`}>{t("Next")}</button>}</nav>
  </section>);
}
