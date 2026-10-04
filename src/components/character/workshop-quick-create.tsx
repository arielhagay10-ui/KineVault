"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createQuickScene, generateMachineRepetition } from "@/lib/motion/quick-create";
import { isStudioMachine, machineContactDescriptions, machineTravelLabels, rowHandleHeight, setPecDeckMode, type MachineReachReport } from "@/lib/motion/studio-machines";
import { sampleStudioObject, studioAssetNames } from "@/lib/motion/studio";
import type { WorkshopScene } from "@/lib/motion/workshop";
import { WorkshopNumberField } from "./workshop-number-field";
import { WorkshopGripControls } from "./workshop-grip-controls";
import { useWorkshopLanguage } from "./workshop-language";
import { WorkshopGuidance, useWorkshopGuidance } from "./workshop-guidance";

const button = "inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-base font-semibold disabled:opacity-40";
const steps = ["Choose equipment", "Start and finish", "Preview", "Name and save"];
export function WorkshopQuickCreate({ scene, step, onStep, onChange, onExample, onAdd, onPreviewTime, onMouseEdit, onFreeCable, onPoseMoment, onMatchReturn, name, onName, onSave, onDetails, saving, savedId, currentConfirmed, confirmedName, language, onAdvanced, reachWarning, machineReach, showExampleInstructions = false, showAddEquipment = true, showSaveAction = true }: {
  scene: WorkshopScene; step: number; onStep: (step: number) => void; onChange: (scene: WorkshopScene) => void;
  onExample: (scene: WorkshopScene) => void; onAdd: () => void; onPreviewTime: (timeMs: number) => void;
  onMouseEdit: (timeMs: number) => void;
  onFreeCable: () => void; onPoseMoment: (timeMs: number) => void; onMatchReturn: () => void;
  name: string; onName: (name: string) => void; onSave: () => void; saving: boolean; savedId: string | null;
  language: "en" | "he"; onAdvanced: () => void; reachWarning: boolean;
  currentConfirmed: boolean; confirmedName: string; onDetails: () => void;
  machineReach?: MachineReachReport;
  showExampleInstructions?: boolean;
  showAddEquipment?: boolean; showSaveAction?: boolean;
}) {
  const { t } = useWorkshopLanguage();
  const guidance = useWorkshopGuidance();
  const machine = scene.studio?.objects.find(item => item.machineUse && isStudioMachine(item.slug));
  const row = scene.studio?.objects.find(item => item.slug === "cable-row-machine");
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
  const endpointNames = !showExampleInstructions ? ["Start", "Finish"] : machine?.slug === "cable-row-machine" ? ["Arms long", "Handle near torso"] : machine?.slug === "pec-deck" ? machine.machineMode === "reverse" ? ["Hands together", "Arms open"] : ["Arms open", "Hands together"] : ["Start", "Finish"];
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
  return (<section data-tutorial-target="quick" aria-label={t("Quick create")} className="min-w-0 space-y-5 p-4 sm:p-6">
    <ol aria-label={t("Creation progress")} className="grid grid-cols-2 gap-2">
      {steps.map((label, index) => <li key={label}><button type="button" aria-current={step === index ? "step" : undefined} onClick={() => onStep(index)} className={`${button} w-full justify-start gap-2 text-start ${step === index ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}><span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border">{new Intl.NumberFormat(language).format(index + 1)}</span>{t(label)}</button></li>)}
    </ol>
    <h2 ref={heading} className="text-xl font-semibold" tabIndex={-1}>{t(steps[step])}</h2>
    {step === 0 && <>
      <div className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
        <h3 className="font-semibold">{t("Create your own movement")}</h3>
        <p className="text-sm text-muted-foreground">{t("Add equipment, pose the start and finish, then preview and save. Equipment does not choose your exercise.")}</p>
        <button type="button" onClick={onFreeCable} className={`${button} bg-primary text-primary-foreground`}>{t("Free cable movement")}</button>
        <p className="text-sm">{t("For deadlifts, pulls or any cable movement. Move hands, feet, hips and torso freely.")}</p>
      </div>
      <WorkshopGuidance className="text-base text-muted-foreground">{t("Choose an example to see a complete movement, or add equipment to your current scene.")}</WorkshopGuidance>
      <div className="grid gap-3 sm:grid-cols-3">{[{ slug: "cable-row-machine", label: "Cable row", reverse: false, caption: "Pull to the torso; elbows stay beside the body." }, { slug: "pec-deck", label: "Pec deck", reverse: false, caption: "Close both arms in front of the chest." }, { slug: "pec-deck", label: "Reverse pec deck", reverse: true, caption: "Open both arms with the chest supported." }].map(example => <button type="button" key={example.label} onClick={() => {
        const recipe = createQuickScene(example.slug);
        const id = recipe.studio!.objects[0].id;
        onExample(example.reverse ? setPecDeckMode(recipe, id, "reverse") : recipe); onStep(1);
      }} className={`${button} flex-col items-start gap-3 p-4 text-start`}>
        <svg viewBox="0 0 180 80" className="h-20 w-full text-primary" role="img" aria-label={t(`${example.label} start to finish`)}><path d="M20 65V12h45M145 65V12h-45" fill="none" stroke="currentColor" strokeWidth="5" /><circle cx="90" cy="19" r="9" fill="currentColor" /><path d={example.slug === "pec-deck" ? "M90 30v33M90 35l-35 10M90 35l35 10M90 63l-20 12M90 63l20 12" : "M90 30v28l30 14M90 35l-40 6M90 58l-32 14"} fill="none" stroke="currentColor" strokeWidth="5" /><path d="M65 48h50m-8-5 8 5-8 5" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
        <span>{t(example.label)}</span>{guidance && <span className="text-sm font-normal text-muted-foreground">{example.caption}</span>}
      </button>)}</div>
      {!!scene.studio?.objects.length && <WorkshopGuidance className="rounded-lg border p-3 text-sm">{t("Examples replace the current scene in one Undo step. Your chosen muscle highlight is kept.")}</WorkshopGuidance>}
      {showAddEquipment && <button type="button" onClick={onAdd} className={button}>{t("Add equipment")}</button>}
      <WorkshopGuidance className="text-sm text-muted-foreground">{t("Personal templates are available in")}<Link href="/my-exercises" className="underline">{t("My exercises")}</Link>.</WorkshopGuidance>
    </>}
    {step === 1 && <>
      {row && <section className="space-y-3 rounded-xl border p-4">
        <h3 className="font-semibold">{t("Choose how to use the cable")}</h3>
        <p className="text-sm">{t("Seated row links the seat, feet and handle. Free cable movement lets you pose the whole body.")}</p>
        <button type="button" onClick={onFreeCable} className={button}>{t("Free cable movement")}</button>
        {!row.machineUse && <button type="button" onClick={() => onChange({ ...scene, equipment: null, motionStyle: "free", studio: { ...scene.studio!, seating: undefined,
          objects: scene.studio!.objects.map(item => ({ ...item, machineUse: item.id === row.id ? true : item.machineUse === undefined ? undefined : false, attachment: "none", elbowLocks: undefined })) } })} className={button}>{t("Use seated row")}</button>}
      </section>}
      {rangeError && <div role="alert" className="space-y-2 rounded-lg border border-red-500 p-3"><p>{rangeError}</p><p>{rangeError.includes("24") ? t("In Advanced, select this machine and choose Stop animation and edit placement, then create the repetition again. One Undo restores its previous travel.") : t("Check that both endpoint percentages are between 0 and 100, then try again.")}</p><button type="button" onClick={onAdvanced} className={button}>{t("Open Advanced editing")}</button></div>}
      {machine ? <>
        <p className="text-base">{studioAssetNames[machine.slug]} · {travel}{guidance && <span>{t(". Adjust travel first; the machine frame and supports stay in place.")}</span>}</p>
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-4"><WorkshopGuidance className="mb-3">{t("Move the handle with your mouse to set the start or finish. The return updates automatically.")}</WorkshopGuidance><div className="flex flex-wrap gap-2"><button type="button" onClick={() => onMouseEdit(0)} className={button}>{t("Drag start")}</button><button type="button" onClick={() => onMouseEdit(scene.durationMs / 2)} className={button}>{t("Drag finish")}</button></div></div>
        {machine.slug === "pec-deck" && <fieldset><legend className="mb-2 font-semibold">{t("Pec deck mode")}</legend><div className="flex flex-wrap gap-2">{(["regular", "reverse"] as const).map(mode => <button key={mode} type="button" aria-pressed={(machine.machineMode ?? "regular") === mode} onClick={() => onChange(setPecDeckMode(scene, machine.id, mode))} className={button}>{t(mode === "regular" ? "Regular" : "Reverse")}</button>)}</div></fieldset>}
        <WorkshopGripControls object={machine} reach={machineReach} onChange={choices => onChange({ ...scene, studio: { ...scene.studio!, objects: scene.studio!.objects.map(item => item.id === machine.id ? { ...item, ...choices } : item) } })} onPreviewPose={pose => onPreviewTime(pose === "start" ? 0 : scene.durationMs / 2)} onRepairRange={() => changeRange(.15, .75)} />
        <div className="grid gap-4 sm:grid-cols-2">{[start, finish].map((value, index) => <section key={index} className="space-y-3 rounded-xl border p-4">
          <svg viewBox="0 0 180 70" className="h-16 w-full text-primary" role="img" aria-label={endpointNames[index]}><circle cx="90" cy="15" r="8" fill="currentColor" /><path d={`M90 25v35M90 32l-${index === 0 ? 40 : 15} 15M90 32l${index === 0 ? 40 : 15} 15`} fill="none" stroke="currentColor" strokeWidth="4" /></svg>
          <h3 className="font-semibold">{t(endpointNames[index])}</h3>
          <WorkshopNumberField label={t(`${index === 0 ? "Start" : "Finish"} ${travel} percent`)} value={Math.round(value * 100)} onChange={percent => changeRange(index === 0 ? percent / 100 : start, index === 1 ? percent / 100 : finish)} min={0} max={100} step={5} />
          {machine.slug === "cable-row-machine" && <WorkshopNumberField label={index === 0 ? t("Start handle height meters") : t("Finish handle height meters")} value={Math.round((index === 0 ? startHeight : finishHeight) * machine.scale * 100) / 100} onChange={height => changeHeight(height / machine.scale, index)} min={rowHandleHeight.min * machine.scale} max={rowHandleHeight.max * machine.scale} step={.05 * machine.scale} />}
          <button type="button" onClick={() => onPreviewTime(index === 0 ? 0 : scene.durationMs / 2)} className={`${button} w-full`}>{t(index === 0 ? "View start" : "View finish")}</button>
        </section>)}</div>
        {machine.slug === "cable-row-machine" && <WorkshopGuidance className="text-sm text-muted-foreground">{t("Set different start and finish heights to pull upward or downward. Heights are above the machine base. The pulley stays fixed; the cable angles toward your hands. Lower the height or shorten the range if a hand cannot reach.")}</WorkshopGuidance>}
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => changeRange(.15, .75)} className={button}>{t("Small range")}</button><button type="button" onClick={() => changeRange(0, 1)} className={button}>{t("Full range")}</button><button type="button" onClick={() => changeRange(0, 1)} className={button}>{t("Reset this adjustment")}</button><button type="button" onClick={() => changeRange(start, finish)} className={`${button} bg-primary text-primary-foreground`}>{t("Create repetition")}</button></div>
        <WorkshopGuidance className="text-sm text-muted-foreground">{t("Creates a smooth Start → Finish → Return. Body poses, other objects and selected muscles are kept.")}</WorkshopGuidance>
      </> : <div className="space-y-3 rounded-xl border p-4">
        <h3 className="font-semibold">{t("Build movement with poses")}</h3>
        <p className="text-sm">{t("Choose Edit start or Edit finish, then drag hands and feet. Use joint controls for hips, knees and torso. Each change updates that pose immediately.")}</p>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => onPoseMoment(0)} className={button}>{t("Edit start")}</button><button type="button" onClick={() => onPoseMoment(scene.durationMs / 2)} className={button}>{t("Edit finish")}</button></div>
        <button type="button" onClick={onAdvanced} className={button}>{t("Pose body in Advanced")}</button>
        <button type="button" onClick={onMatchReturn} className={button}>{t("Match return to start")}</button>
        <p className="text-sm text-muted-foreground">{t("Play interpolates between your poses. Match return to start makes a complete loop. Add extra moments in Timeline.")}</p>
        {showAddEquipment && <button type="button" onClick={onAdd} className={button}>{t("Add equipment")}</button>}
      </div>}
      <details className="rounded-xl border p-4"><summary className="min-h-11 cursor-pointer font-semibold">{t("Adjust fit")}</summary><WorkshopGuidance className="mb-3 text-sm text-muted-foreground">{t("Scales the figure and engaged machine together to keep their supports aligned. Undo restores the previous fit.")}</WorkshopGuidance><div className="flex flex-wrap gap-2">{[["Smaller", .9], ["Standard", 1], ["Larger", 1.1]].map(([label, size]) => <button key={label} type="button" onClick={() => fit(Number(size))} className={button}>{t(String(label))}</button>)}</div></details>
      <section aria-label={t("Supports and contacts")} className="space-y-2 rounded-xl border bg-muted/30 p-4"><h3 className="font-semibold">{t("Supports and contacts")}</h3>{showExampleInstructions && machine && isStudioMachine(machine.slug) && <p className="text-sm">{machineContactDescriptions[machine.slug]}</p>}<div className="flex flex-wrap gap-2">{["Seat", "Back / chest", "Both feet", "Both hands"].map((item, index) => <span key={item} className="rounded-md border bg-card px-3 py-2 text-sm">{item} · {machine ? index === 0 && machine.slug === "smith-machine" || index === 1 && ["cable-row-machine", "lat-pulldown-machine"].includes(machine.slug) ? t("not used") : t("linked") : t("check")}</span>)}</div><WorkshopGuidance className="text-sm text-muted-foreground">{t("Inspect start and finish from both sides. Linked supports still need a visual check.")}</WorkshopGuidance></section>
      {reachWarning && <div role="alert" className="rounded-lg border border-red-500 p-3"><p>{t("A hand cannot reach its handle. Use a smaller range or reset fit; inspect the wrist from the opposite side.")}</p><button type="button" onClick={() => changeRange(.2, .7)} className={`${button} mt-2`}>{t("Repair: smaller range")}</button></div>}
    </>}
    {step === 2 && <>
      <WorkshopGuidance className="text-base text-muted-foreground">{t("Play a full repetition, or use Start and Finish for a static inspection. Check both hands, feet and the return.")}</WorkshopGuidance>
      {guidance && <fieldset className="space-y-2 rounded-xl border p-4"><legend className="px-1 font-semibold">{t("Before saving")}</legend>{["Supports touch the intended body areas", "Both hands and feet stay in contact", "Start and finish look correct", "Return is smooth and matches the start"].map(item => <label key={item} className="flex min-h-11 items-center gap-3 text-base"><input type="checkbox" checked={checked[item] ?? false} onChange={event => setChecked({ ...checked, [item]: event.target.checked })} className="h-5 w-5" />{item}</label>)}</fieldset>}
      <WorkshopGuidance className="text-sm text-muted-foreground">{t("The checklist helps your review; it does not lock saving. Highlight muscles only when you choose them.")}</WorkshopGuidance>
    </>}
    {step === 3 && <>
      <label className="block text-base font-semibold">{t("Exercise name")}<input value={name} maxLength={160} onChange={event => onName(event.target.value)} autoComplete="off" className="mt-2 min-h-12 w-full rounded-lg border bg-background p-3 font-normal" placeholder={t("For example, seated cable row")} /></label>
      <WorkshopGuidance className="text-sm text-muted-foreground">{t("This stays private. Muscles, classifications and instructions can be added later.")}</WorkshopGuidance>
      {showSaveAction && <button type="button" onClick={onSave} disabled={saving || name.trim().length < 2} className={`${button} bg-primary text-primary-foreground`}>{t(saving ? "Saving…" : "Save privately")}</button>}
      {savedId && currentConfirmed && <article aria-label={t("Saved private exercise")} className="space-y-3 rounded-xl border bg-muted/30 p-4"><h3 className="text-lg font-semibold"><span data-workshop-translate="false">{confirmedName || "Your exercise"}</span> <span className="ms-2 rounded border px-2 py-1 text-sm font-normal">{t("Private")}</span></h3><WorkshopGuidance className="text-sm">{t("Your playable preview is above. Keep editing or add optional details.")}</WorkshopGuidance><button type="button" disabled={saving} onClick={onDetails} className={button}>{t("Add optional details")}</button><Link href="/my-exercises" className={`${button} ms-2`}>{t("My exercises")}</Link></article>}
    </>}
    <nav aria-label={t("Creation steps")} className="flex flex-wrap justify-between gap-3 border-t pt-4"><button type="button" disabled={step === 0} onClick={() => onStep(step - 1)} className={button}>{t("Back")}</button>{step < 3 && <button type="button" onClick={() => onStep(step + 1)} className={`${button} bg-primary text-primary-foreground`}>{t("Next")}</button>}</nav>
  </section>);
}
