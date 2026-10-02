"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createQuickScene, generateMachineRepetition } from "@/lib/motion/quick-create";
import { isStudioMachine, machineContactDescriptions, machineTravelLabels, rowHandleHeight, setPecDeckMode, type MachineReachReport } from "@/lib/motion/studio-machines";
import { sampleStudioObject, studioAssetNames } from "@/lib/motion/studio";
import type { WorkshopScene } from "@/lib/motion/workshop";
import { WorkshopNumberField } from "./workshop-number-field";
import { WorkshopGripControls } from "./workshop-grip-controls";
import { translateWorkshopTree } from "./workshop-language";

const button = "inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-base font-semibold disabled:opacity-40";
const steps = ["Choose equipment", "Start and finish", "Preview", "Name and save"];
const hebrew: Record<string, string> = {
  "Choose equipment": "בחירת ציוד", "Start and finish": "התחלה וסיום", "Preview": "תצוגה מקדימה", "Name and save": "שם ושמירה",
  "Back": "חזרה", "Next": "הבא", "Add equipment": "הוספת ציוד", "Create repetition": "יצירת חזרה",
  "Exercise name": "שם התרגיל", "Save privately": "שמירה פרטית", "Saving…": "שומר…", "Add optional details": "הוספת פרטים אופציונליים",
  "Arms long": "ידיים ישרות", "Handle near torso": "ידית קרובה לגוף", "Arms open": "ידיים פתוחות", "Hands together": "ידיים יחד",
  "View start": "הצגת התחלה", "View finish": "הצגת סיום", "Reset this adjustment": "איפוס התאמה זו",
  "Small range": "טווח קטן", "Full range": "טווח מלא", "Adjust fit": "התאמת גודל", "Smaller": "קטן יותר", "Standard": "רגיל", "Larger": "גדול יותר",
  "Cable row": "חתירה בכבל", "Pec deck": "פרפר", "Reverse pec deck": "פרפר הפוך", "Start from an example": "התחלה מדוגמה",
  "Supports and contacts": "תמיכות ומגעים", "Regular": "רגיל", "Reverse": "הפוך", "Continue creating": "המשך עריכה", "Private": "פרטי",
};
export function WorkshopQuickCreate({ scene, step, onStep, onChange, onExample, onAdd, onPreviewTime, onMouseEdit, name, onName, onSave, onDetails, saving, savedId, currentConfirmed, confirmedName, language, onAdvanced, reachWarning, machineReach }: {
  scene: WorkshopScene; step: number; onStep: (step: number) => void; onChange: (scene: WorkshopScene) => void;
  onExample: (scene: WorkshopScene) => void; onAdd: () => void; onPreviewTime: (timeMs: number) => void;
  onMouseEdit: (timeMs: number) => void;
  name: string; onName: (name: string) => void; onSave: () => void; saving: boolean; savedId: string | null;
  language: "en" | "he"; onAdvanced: () => void; reachWarning: boolean;
  currentConfirmed: boolean; confirmedName: string; onDetails: () => void;
  machineReach?: MachineReachReport;
}) {
  const t = (text: string) => language === "he" ? hebrew[text] ?? text : text;
  const machine = scene.studio?.objects.find(item => item.machineUse && isStudioMachine(item.slug));
  const start = machine ? sampleStudioObject(machine, 0).machinePosition ?? 0 : 0;
  const finish = machine ? sampleStudioObject(machine, scene.durationMs / 2).machinePosition ?? 1 : 1;
  const startHeight = machine ? sampleStudioObject(machine, 0).machineHandleHeight ?? rowHandleHeight.standard : rowHandleHeight.standard;
  const finishHeight = machine ? sampleStudioObject(machine, scene.durationMs / 2).machineHandleHeight ?? rowHandleHeight.standard : rowHandleHeight.standard;
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [rangeError, setRangeError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  useEffect(() => { if (previousStep.current !== step) heading.current?.focus(); previousStep.current = step; }, [step]);
  const travel = machine && isStudioMachine(machine.slug) ? machine.machineMode === "reverse" ? "Arm opening" : machineTravelLabels[machine.slug] : "Movement";
  const endpointNames = machine?.slug === "cable-row-machine" ? ["Arms long", "Handle near torso"] : machine?.slug === "pec-deck" ? machine.machineMode === "reverse" ? ["Hands together", "Arms open"] : ["Arms open", "Hands together"] : ["Start", "Finish"];
  const changeRange = (a: number, b: number) => {
    if (!machine) return;
    try { onChange(generateMachineRepetition(scene, machine.id, a, b)); setRangeError(null); }
    catch (error) { setRangeError(error instanceof Error ? error.message : "Check start and finish, then try again."); }
  };
  const changeHeight = (height: number, endpoint: number) => {
    if (!machine) return;
    try {
      onChange(generateMachineRepetition(scene, machine.id, start, finish, { start: endpoint === 0 ? height : startHeight, finish: endpoint === 1 ? height : finishHeight }));
      onPreviewTime(endpoint === 0 ? 0 : scene.durationMs / 2); setRangeError(null);
    } catch (error) { setRangeError(error instanceof Error ? error.message : "Check start and finish, then try again."); }
  };
  const fit = (scale: number) => {
    if (!scene.studio) return;
    onChange({ ...scene, studio: { ...scene.studio, body: { ...scene.studio.body, scale }, objects: scene.studio.objects.map(item => item.machineUse ? { ...item, scale, frames: item.frames?.map(frame => ({ ...frame, scale })) } : item) } });
  };
  return translateWorkshopTree(<section aria-label="Quick create" className="min-w-0 space-y-5 p-4 sm:p-6">
    <ol aria-label="Creation progress" className="grid grid-cols-2 gap-2">
      {steps.map((label, index) => <li key={label}><button type="button" aria-current={step === index ? "step" : undefined} onClick={() => onStep(index)} className={`${button} w-full justify-start gap-2 text-start ${step === index ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}><span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border">{new Intl.NumberFormat(language).format(index + 1)}</span>{t(label)}</button></li>)}
    </ol>
    <h2 ref={heading} className="text-xl font-semibold" tabIndex={-1}>{t(steps[step])}</h2>
    {step === 0 && <>
      <p className="text-base text-muted-foreground">Choose an example to see a complete movement, or add equipment to your current scene.</p>
      <div className="grid gap-3 sm:grid-cols-3">{[{ slug: "cable-row-machine", label: "Cable row", reverse: false, caption: "Pull to the torso; elbows stay beside the body." }, { slug: "pec-deck", label: "Pec deck", reverse: false, caption: "Close both arms in front of the chest." }, { slug: "pec-deck", label: "Reverse pec deck", reverse: true, caption: "Open both arms with the chest supported." }].map(example => <button type="button" key={example.label} onClick={() => {
        const recipe = createQuickScene(example.slug);
        const id = recipe.studio!.objects[0].id;
        onExample(example.reverse ? setPecDeckMode(recipe, id, "reverse") : recipe); onStep(1);
      }} className={`${button} flex-col items-start gap-3 p-4 text-start`}>
        <svg viewBox="0 0 180 80" className="h-20 w-full text-primary" role="img" aria-label={`${example.label} start to finish`}><path d="M20 65V12h45M145 65V12h-45" fill="none" stroke="currentColor" strokeWidth="5" /><circle cx="90" cy="19" r="9" fill="currentColor" /><path d={example.slug === "pec-deck" ? "M90 30v33M90 35l-35 10M90 35l35 10M90 63l-20 12M90 63l20 12" : "M90 30v28l30 14M90 35l-40 6M90 58l-32 14"} fill="none" stroke="currentColor" strokeWidth="5" /><path d="M65 48h50m-8-5 8 5-8 5" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
        <span>{t(example.label)}</span><span className="text-sm font-normal text-muted-foreground">{example.caption}</span>
      </button>)}</div>
      {!!scene.studio?.objects.length && <p className="rounded-lg border p-3 text-sm">Examples replace the current scene in one Undo step. Your chosen muscle highlight is kept.</p>}
      <button type="button" onClick={onAdd} className={button}>{t("Add equipment")}</button>
      <p className="text-sm text-muted-foreground">Personal templates are available in <Link href="/my-exercises" className="underline">My exercises</Link>.</p>
    </>}
    {step === 1 && <>
      {rangeError && <div role="alert" className="space-y-2 rounded-lg border border-red-500 p-3"><p>{rangeError}</p><p>{rangeError.includes("24") ? "In Advanced, select this machine and choose Stop animation and edit placement, then create the repetition again. One Undo restores its previous travel." : "Check that both endpoint percentages are between 0 and 100, then try again."}</p><button type="button" onClick={onAdvanced} className={button}>Open Advanced editing</button></div>}
      {machine ? <>
        <p className="text-base">{studioAssetNames[machine.slug]} · {travel}. <span>Adjust travel first; the machine frame and supports stay in place.</span></p>
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-4"><p className="mb-3">Move the handle with your mouse to set the start or finish. The return updates automatically.</p><div className="flex flex-wrap gap-2"><button type="button" onClick={() => onMouseEdit(0)} className={button}>Drag start</button><button type="button" onClick={() => onMouseEdit(scene.durationMs / 2)} className={button}>Drag finish</button></div></div>
        {machine.slug === "pec-deck" && <fieldset><legend className="mb-2 font-semibold">Pec deck mode</legend><div className="flex flex-wrap gap-2">{(["regular", "reverse"] as const).map(mode => <button key={mode} type="button" aria-pressed={(machine.machineMode ?? "regular") === mode} onClick={() => onChange(setPecDeckMode(scene, machine.id, mode))} className={button}>{t(mode === "regular" ? "Regular" : "Reverse")}</button>)}</div></fieldset>}
        <WorkshopGripControls object={machine} reach={machineReach} onChange={choices => onChange({ ...scene, studio: { ...scene.studio!, objects: scene.studio!.objects.map(item => item.id === machine.id ? { ...item, ...choices } : item) } })} onPreviewPose={pose => onPreviewTime(pose === "start" ? 0 : scene.durationMs / 2)} onRepairRange={() => changeRange(.15, .75)} />
        <div className="grid gap-4 sm:grid-cols-2">{[start, finish].map((value, index) => <section key={index} className="space-y-3 rounded-xl border p-4">
          <svg viewBox="0 0 180 70" className="h-16 w-full text-primary" role="img" aria-label={endpointNames[index]}><circle cx="90" cy="15" r="8" fill="currentColor" /><path d={`M90 25v35M90 32l-${index === 0 ? 40 : 15} 15M90 32l${index === 0 ? 40 : 15} 15`} fill="none" stroke="currentColor" strokeWidth="4" /></svg>
          <h3 className="font-semibold">{t(endpointNames[index])}</h3>
          <WorkshopNumberField label={`${index === 0 ? "Start" : "Finish"} ${travel} percent`} value={Math.round(value * 100)} onChange={percent => changeRange(index === 0 ? percent / 100 : start, index === 1 ? percent / 100 : finish)} min={0} max={100} step={5} />
          {machine.slug === "cable-row-machine" && <WorkshopNumberField label={index === 0 ? "Start handle height meters" : "Finish handle height meters"} value={Math.round((index === 0 ? startHeight : finishHeight) * machine.scale * 100) / 100} onChange={height => changeHeight(height / machine.scale, index)} min={rowHandleHeight.min * machine.scale} max={rowHandleHeight.max * machine.scale} step={.05 * machine.scale} />}
          <button type="button" onClick={() => onPreviewTime(index === 0 ? 0 : scene.durationMs / 2)} className={`${button} w-full`}>{t(index === 0 ? "View start" : "View finish")}</button>
        </section>)}</div>
        {machine.slug === "cable-row-machine" && <p className="text-sm text-muted-foreground">Set different start and finish heights to pull upward or downward. Heights are above the machine base. The pulley stays fixed; the cable angles toward your hands. Lower the height or shorten the range if a hand cannot reach.</p>}
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => changeRange(.15, .75)} className={button}>{t("Small range")}</button><button type="button" onClick={() => changeRange(0, 1)} className={button}>{t("Full range")}</button><button type="button" onClick={() => changeRange(0, 1)} className={button}>{t("Reset this adjustment")}</button><button type="button" onClick={() => changeRange(start, finish)} className={`${button} bg-primary text-primary-foreground`}>{t("Create repetition")}</button></div>
        <p className="text-sm text-muted-foreground">Creates a smooth Start → Finish → Return. Body poses, other objects and selected muscles are kept.</p>
      </> : <div className="space-y-3 rounded-xl border p-4"><p>Use Pose hands and feet beside the preview for free limbs. Select a machine for linked contacts, or use Advanced editing for joint angles.</p><button type="button" onClick={onAdd} className={button}>{t("Add equipment")}</button><button type="button" onClick={onAdvanced} className={button}>Pose body in Advanced</button></div>}
      <details className="rounded-xl border p-4"><summary className="min-h-11 cursor-pointer font-semibold">{t("Adjust fit")}</summary><p className="mb-3 text-sm text-muted-foreground">Scales the figure and engaged machine together to keep their supports aligned. Undo restores the previous fit.</p><div className="flex flex-wrap gap-2">{[["Smaller", .9], ["Standard", 1], ["Larger", 1.1]].map(([label, size]) => <button key={label} type="button" onClick={() => fit(Number(size))} className={button}>{t(String(label))}</button>)}</div></details>
      <section aria-label="Supports and contacts" className="space-y-2 rounded-xl border bg-muted/30 p-4"><h3 className="font-semibold">{t("Supports and contacts")}</h3><p className="text-sm">{machine && isStudioMachine(machine.slug) ? machineContactDescriptions[machine.slug] : "No machine engaged. Check body and floor contact in the preview."}</p><div className="flex flex-wrap gap-2">{["Seat", "Back / chest", "Both feet", "Both hands"].map((item, index) => <span key={item} className="rounded-md border bg-card px-3 py-2 text-sm">{item} · {machine ? index === 0 && machine.slug === "smith-machine" || index === 1 && ["cable-row-machine", "lat-pulldown-machine"].includes(machine.slug) ? "not used" : "linked" : "check"}</span>)}</div><p className="text-sm text-muted-foreground">Inspect start and finish from both sides. Linked supports still need a visual check.</p></section>
      {reachWarning && <div role="alert" className="rounded-lg border border-red-500 p-3"><p>A hand cannot reach its handle. Use a smaller range or reset fit; inspect the wrist from the opposite side.</p><button type="button" onClick={() => changeRange(.2, .7)} className={`${button} mt-2`}>Repair: smaller range</button></div>}
    </>}
    {step === 2 && <>
      <p className="text-base text-muted-foreground">Play a full repetition, or use Start and Finish for a static inspection. Check both hands, feet and the return.</p>
      <fieldset className="space-y-2 rounded-xl border p-4"><legend className="px-1 font-semibold">Before saving</legend>{["Supports touch the intended body areas", "Both hands and feet stay in contact", "Start and finish look correct", "Return is smooth and matches the start"].map(item => <label key={item} className="flex min-h-11 items-center gap-3 text-base"><input type="checkbox" checked={checked[item] ?? false} onChange={event => setChecked({ ...checked, [item]: event.target.checked })} className="h-5 w-5" />{item}</label>)}</fieldset>
      <p className="text-sm text-muted-foreground">The checklist helps your review; it does not lock saving. Highlight muscles only when you choose them.</p>
    </>}
    {step === 3 && <>
      <label className="block text-base font-semibold">{t("Exercise name")}<input value={name} maxLength={160} onChange={event => onName(event.target.value)} autoComplete="off" className="mt-2 min-h-12 w-full rounded-lg border bg-background p-3 font-normal" placeholder="For example, seated cable row" /></label>
      <p className="text-sm text-muted-foreground">This stays private. Muscles, classifications and instructions can be added later.</p>
      <button type="button" onClick={onSave} disabled={saving || name.trim().length < 2} className={`${button} bg-primary text-primary-foreground`}>{t(saving ? "Saving…" : "Save privately")}</button>
      {savedId && currentConfirmed && <article aria-label="Saved private exercise" className="space-y-3 rounded-xl border bg-muted/30 p-4"><h3 className="text-lg font-semibold"><span data-workshop-translate="false">{confirmedName || "Your exercise"}</span> <span className="ms-2 rounded border px-2 py-1 text-sm font-normal">{t("Private")}</span></h3><p className="text-sm">Your playable preview is above. Keep editing or add optional details.</p><button type="button" disabled={saving} onClick={onDetails} className={button}>{t("Add optional details")}</button><Link href="/my-exercises" className={`${button} ms-2`}>My exercises</Link></article>}
    </>}
    <nav aria-label="Creation steps" className="flex flex-wrap justify-between gap-3 border-t pt-4"><button type="button" disabled={step === 0} onClick={() => onStep(step - 1)} className={button}>{t("Back")}</button>{step < 3 && <button type="button" onClick={() => onStep(step + 1)} className={`${button} bg-primary text-primary-foreground`}>{t("Next")}</button>}</nav>
  </section>, language);
}
