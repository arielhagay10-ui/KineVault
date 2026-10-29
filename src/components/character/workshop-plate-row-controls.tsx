"use client";

import type { StudioObject } from "@/lib/motion/workshop";
import { plateRow, rowLeverPosition } from "@/lib/motion/plate-row";
import { WorkshopNumberField } from "./workshop-number-field";
import { useWorkshopLanguage } from "./workshop-language";
import type { MachineReachReport } from "@/lib/motion/studio-machines";

export function WorkshopPlateRowControls({ object, onChange, onTravel, reach }: {
  object: StudioObject; onChange: (changes: Partial<StudioObject>) => void;
  onTravel: (side: "left" | "right", position: number) => void;
  reach?: MachineReachReport;
}) {
  const { t } = useWorkshopLanguage();
  return <section aria-label={t("Plate-loaded row setup")} className="space-y-4 rounded-lg border p-3">
    <h3 className="text-base font-semibold">{t("Plate-loaded row setup")}</h3>
    <WorkshopNumberField label="Seat height centimeters" min={plateRow.seat.min * object.scale * 100} max={plateRow.seat.max * object.scale * 100} step={object.scale} maximumFractionDigits={1}
      value={(object.rowSeatHeight ?? plateRow.seat.standard) * object.scale * 100} onChange={height => onChange({ rowSeatHeight: height / (100 * object.scale) })} />
    <label className="block space-y-2 font-semibold">{t("Row grip")}
      <select aria-label={t("Row grip")} value={object.rowGrip ?? "neutral"} onChange={event => onChange({ rowGrip: event.target.value as "neutral" | "wide", gripOffsets: undefined })} className="min-h-11 w-full rounded-lg border bg-background px-3 py-2 text-base">
        <option value="neutral">{t("Neutral grip · elbows close")}</option>
        <option value="wide">{t("Upper-back grip · elbows wide")}</option>
      </select>
    </label>
    {(["left", "right"] as const).map(side => <WorkshopNumberField key={side} label={side === "left" ? "Left lever pull percent" : "Right lever pull percent"} min={0} max={100} step={1}
      value={Math.round(rowLeverPosition(object, side) * 100)} onChange={value => onTravel(side, value / 100)} />)}
    <p className="text-sm text-muted-foreground">{t("0% reaches forward; 100% pulls back. Each handle moves independently. Hold one handle for a one-arm row. Joint controls remain available in Pose.")}</p>
    <p className="text-sm text-muted-foreground">{t("Choose Start, Finish or Return below, then adjust the levers. Changes apply to that pose.")}</p>
    {reach?.objectId === object.id && reach.warnings.length > 0 && <div role="status" className="rounded-lg border border-amber-500/50 p-3 text-sm">
      {reach.warnings.map(warning => <p key={`${warning.side}-${warning.kind}`}>{t(warning.message)} {t("Adjust the seat, grip or lever pull until the hand reaches comfortably.")}</p>)}
    </div>}
  </section>;
}
