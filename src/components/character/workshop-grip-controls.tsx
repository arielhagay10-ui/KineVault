"use client";

import { WorkshopGuidance } from "./workshop-guidance";

import type { StudioObject } from "@/lib/motion/workshop";
import { machineGripChoices, type MachineGripChoices, type MachineReachReport } from "@/lib/motion/studio-machines";
import { useWorkshopLanguage } from "./workshop-language";

export type WorkshopGripControlsProps = {
  object: StudioObject;
  onChange: (choices: MachineGripChoices) => void;
  onPreviewPose?: (pose: "start" | "finish") => void;
  onRepairRange?: () => void;
  reach?: MachineReachReport;
  disabled?: boolean;
};

function PalmPicture({ outward }: { outward: boolean }) {
  return <svg viewBox="0 0 120 64" className="h-16 w-28 max-w-full" aria-hidden="true">
    {[0, 1].map(side => <g key={side} transform={`translate(${side === 0 ? 14 : 106} 10) scale(${side === 0 ? 1 : -1} 1)`}>
      <path d="M8 43V23L6 14Q6 9 10 11L13 23V5Q13 0 17 3V20L19 3Q20 -1 23 3V21L26 7Q28 3 30 8L28 25L32 16Q36 12 37 17L34 34Q32 42 27 46H12Z" fill="currentColor" opacity=".16" stroke="currentColor" strokeWidth="2" />
      <path d="M14 29Q21 25 28 30M17 34L25 34" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </g>)}
    <path d={outward ? "M53 32H38M38 32L43 27M38 32L43 37M67 32H82M82 32L77 27M82 32L77 37" : "M38 32H53M53 32L48 27M53 32L48 37M82 32H67M67 32L72 27M67 32L72 37"} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>;
}

export function WorkshopGripControls({ object, onChange, onPreviewPose, onRepairRange, reach, disabled }: WorkshopGripControlsProps) {
  const { t } = useWorkshopLanguage();
  if (!["cable-row-machine", "pec-deck"].includes(object.slug)) return null;
  const choices = machineGripChoices(object);
  const warnings = reach?.objectId === object.id ? reach.warnings : [];
  const buttonClass = "min-h-11 rounded-md border px-3 py-2 text-base disabled:opacity-50 aria-pressed:border-primary aria-pressed:bg-primary/10";
  return (<div className="space-y-4">
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="text-base font-medium">{t("Which way do your palms face?")}</legend>
      <div className="grid grid-cols-2 gap-2">
        {(["inward", "outward"] as const).map(machinePalm => <button key={machinePalm} type="button" aria-pressed={choices.machinePalm === machinePalm} onClick={() => onChange({ machinePalm })} className={`${buttonClass} flex flex-col items-center`}>
          <PalmPicture outward={machinePalm === "outward"} />
          {machinePalm === "inward" ? t("Palms toward each other") : t("Palms outward")}
        </button>)}
      </div>
    </fieldset>
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="text-base font-medium">{t("Where do your elbows move?")}</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(["beside-body", "shoulder-height"] as const).map(machineElbowPath => <button key={machineElbowPath} type="button" aria-pressed={choices.machineElbowPath === machineElbowPath} onClick={() => onChange({ machineElbowPath })} className={buttonClass}>
          {machineElbowPath === "beside-body" ? t("Keep elbows beside the body") : t("Arms at shoulder height")}
        </button>)}
      </div>
    </fieldset>
    <WorkshopGuidance className="text-sm text-muted-foreground">{t("Both hands use these choices. Check the palms and wrists at the start and finish.")}</WorkshopGuidance>
    {onPreviewPose && <div className="flex flex-wrap gap-2">
      <button type="button" disabled={disabled} onClick={() => onPreviewPose("start")} className={buttonClass}>{t("Check both hands at start")}</button>
      <button type="button" disabled={disabled} onClick={() => onPreviewPose("finish")} className={buttonClass}>{t("Check both hands at finish")}</button>
    </div>}
    {warnings.length > 0 && <div role="status" className="space-y-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
      {warnings.map(warning => <p key={`${warning.side}-${warning.kind}`}><strong>{t(warning.message)}</strong> {t(warning.repair)}</p>)}
      <div className="flex flex-wrap gap-2">
        {onRepairRange && <button type="button" disabled={disabled} onClick={onRepairRange} className={buttonClass}>{t("Adjust start and finish")}</button>}
        <button type="button" disabled={disabled} onClick={() => onChange({ machinePalm: object.machineMode === "reverse" ? "outward" : "inward", machineElbowPath: object.slug === "cable-row-machine" ? "beside-body" : "shoulder-height" })} className={buttonClass}>{t("Use standard palm and elbow choices")}</button>
      </div>
    </div>}
  </div>);
}
