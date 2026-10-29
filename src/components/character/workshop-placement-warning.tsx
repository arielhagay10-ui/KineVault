"use client";

import { TriangleAlert } from "@/components/ui/icons";
import { equipmentLabel } from "@/lib/motion/equipment-label";
import type { StudioObject, SupportRegion } from "@/lib/motion/workshop";
import { supportRegionLabels, type SupportSolveReport } from "@/lib/motion/support-contacts";
import { useWorkshopLanguage } from "./workshop-language";

export function WorkshopPlacementWarning({ objects, overlapping, onInspect, supports = [], onSupportInspect }: {
  objects: StudioObject[];
  overlapping: StudioObject[];
  onInspect: (id: string) => void;
  supports?: SupportSolveReport[];
  onSupportInspect?: (region: SupportRegion) => void;
}) {
  const { t, formatNumber } = useWorkshopLanguage();
  const affected = supports.filter(report => !report.reachable || report.orientationLimited);
  const count = overlapping.length + affected.length;
  if (!count) return null;
  return <details data-workshop-placement-warning className="absolute start-2 top-2 z-20 max-w-[calc(100%-5rem)] rounded-lg border border-red-300 bg-card/95 text-sm text-foreground dark:border-red-800"
    onKeyDown={event => {
      if (event.key !== "Escape") return;
      event.preventDefault(); event.stopPropagation();
      event.currentTarget.open = false;
      event.currentTarget.querySelector("summary")?.focus();
    }}>
    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 font-semibold text-red-700 focus-visible:outline-2 focus-visible:outline-ring dark:text-red-300 [&::-webkit-details-marker]:hidden">
      <TriangleAlert size={18} aria-hidden="true" /><span>{t("Check placement")}</span>
      <span role="status" aria-label={t("{count} items to check", { count })}>{formatNumber(count)}</span>
    </summary>
    <div className="max-h-[min(16rem,30dvh)] max-w-80 space-y-3 overflow-y-auto border-t border-border p-3">
      {overlapping.length > 0 && <p>{t("Equipment may overlap the figure. Check from the front and side.")}</p>}
      <div className="flex flex-col items-start gap-2">{overlapping.map(item => <button key={item.id} type="button" onClick={event => {
        event.currentTarget.closest("details")?.removeAttribute("open"); onInspect(item.id);
      }} className="min-h-11 max-w-full rounded-lg border border-border px-3 py-2 text-start font-semibold [overflow-wrap:anywhere] focus-visible:outline-2 focus-visible:outline-ring">
        {t("Inspect placement · ")}<span data-workshop-translate="false">{equipmentLabel(objects, item)}</span>
      </button>)}</div>
      {overlapping.length > 0 && <p className="text-muted-foreground">{t("Move the item away, or attach it to a hand if it should be held.")}</p>}
      {affected.length > 0 && <>{affected.some(report => !report.reachable) && <p>{t("Some supports are beyond reach. Adjust the contact or reposition the body.")}</p>}{affected.some(report => report.orientationLimited) && <p>{t("Contact angle is limited. Adjust the contact orientation or nearby joints.")}</p>}<div className="flex flex-col items-start gap-2">{affected.map(report => onSupportInspect ? <button key={report.region} type="button" onClick={event => {
        event.currentTarget.closest("details")?.removeAttribute("open"); onSupportInspect(report.region);
      }} className="min-h-11 max-w-full rounded-lg border border-border px-3 py-2 text-start font-semibold [overflow-wrap:anywhere] focus-visible:outline-2 focus-visible:outline-ring">{t("Inspect support · ")}{t(supportRegionLabels[report.region])}</button> : <span key={report.region}>{t(supportRegionLabels[report.region])}</span>)}</div></>}
    </div>
  </details>;
}
