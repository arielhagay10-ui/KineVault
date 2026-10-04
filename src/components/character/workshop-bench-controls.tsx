"use client";

import type { BenchFacing, StudioObject } from "@/lib/motion/workshop";
import { WorkshopNumberField } from "./workshop-number-field";
import { WorkshopGuidance } from "./workshop-guidance";
import { useWorkshopLanguage } from "./workshop-language";

export function WorkshopBenchControls({ bench, facing, onPosition, onAngle }: {
  bench: StudioObject; facing?: BenchFacing;
  onPosition: (facing?: BenchFacing) => void; onAngle: (angle: number) => void;
}) {
  const { t } = useWorkshopLanguage();
  const sitting = !!facing && ["front", "left", "right"].includes(facing);
  const button = "min-h-11 rounded-lg border border-border px-3 py-2 text-start text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary";
  return <section aria-label={t("Bench body position")} className="space-y-4 border-b border-border pb-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold">{t("Body position on bench")}</h2>{facing && <button type="button" className={button} onClick={() => onPosition()}>{t("Leave bench")}</button>}</div>
    <div className="grid grid-cols-2 gap-2">{([ ["front", "Sit"], ["supine", "Lie face up"], ["prone", "Lie face down"], ["back", "Chest supported"] ] as const).map(([position, label]) => <button key={position} type="button" aria-pressed={position === "front" ? sitting : facing === position} onClick={() => onPosition(position)} className={button}>{t(label)}</button>)}</div>
    {sitting && <label className="block space-y-2 text-sm font-semibold">{t("Sitting direction")}<select aria-label={t("Sitting direction")} value={facing} onChange={event => onPosition(event.target.value as BenchFacing)} className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 font-normal">
      <option value="front">{t("Face away from bench")}</option><option value="left">{t("Face left")}</option><option value="right">{t("Face right")}</option>
    </select></label>}
    <WorkshopNumberField label="Bench pad angle degrees" min={0} max={85} value={bench.benchAngle ?? 45} onChange={onAngle} />
    <div className="flex flex-wrap gap-2">{[["Flat", 0], ["Incline", 45], ["Upright", 85]].map(([label, angle]) => <button key={label} type="button" aria-pressed={(bench.benchAngle ?? 45) === angle} onClick={() => onAngle(Number(angle))} className={button}>{t(String(label))}</button>)}</div>
    <WorkshopGuidance className="text-sm text-muted-foreground">The figure follows the bench. Leave bench to pose freely.</WorkshopGuidance>
  </section>;
}
