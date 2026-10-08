"use client";

import { useId } from "react";
import { TriangleAlert } from "@/components/ui/icons";
import { useWorkshopLanguage } from "./workshop-language";

export type WorkshopPoseFeedbackKind = "limit" | "contact";

export function WorkshopPoseFeedback({ kind, dragging }: { kind: WorkshopPoseFeedbackKind | null; dragging: boolean }) {
  const { t } = useWorkshopLanguage();
  const descriptionId = useId();
  const label = kind === "limit" ? t("Pose limit") : t("Check foot contact");
  const message = kind === "limit"
    ? t("This target is beyond the limb's reach or joint limits. The closest pose within joint limits is shown.")
    : t("Foot contact changed. Check the sole and floor from Side view before saving.");

  return <div className="pointer-events-none absolute bottom-2 start-2 z-30 max-w-[calc(100%-1rem)]">
    <span role="status" className="sr-only">{kind && !dragging ? message : ""}</span>
    {kind && <div className="group relative w-fit">
      <button type="button" aria-label={label} aria-describedby={descriptionId} disabled={dragging}
        className={`${dragging ? "pointer-events-none" : "pointer-events-auto"} flex min-h-11 items-center gap-2 rounded-lg border border-amber-500 bg-card/95 px-3 py-2 text-xs font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-ring`}>
        <TriangleAlert aria-hidden="true" size={18} className="text-amber-600 dark:text-amber-400" />{label}
      </button>
      <span id={descriptionId} role="tooltip"
        className={`absolute bottom-full start-0 mb-2 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card p-3 text-sm text-foreground shadow-sm ${dragging ? "invisible" : "invisible group-hover:visible group-focus-within:visible"}`}>
        {message}
      </span>
    </div>}
  </div>;
}
