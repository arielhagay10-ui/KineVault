"use client";

import { WorkshopGuidance } from "./workshop-guidance";

import type { ScenePresentation } from "@/lib/motion/workshop";
import type { WorkshopCameraAction } from "@/lib/motion/workshop-camera";
import { useWorkshopLanguage } from "./workshop-language";

export type WorkshopInteractionMode = "camera" | "edit";

export function WorkshopPreviewFallback({ state, onRetry }: { state: "loading" | "unsupported" | "error"; onRetry: () => void }) {
  const { t } = useWorkshopLanguage();
  return <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-base">
    <p role={state === "error" ? "alert" : "status"}>{t(state === "loading" ? "Loading body and equipment…" : state === "unsupported" ? "3D preview needs WebGL." : "Could not load the 3D preview.")}</p>
    <p className="text-sm">{t(state === "loading" ? "You can keep editing below while the preview loads." : state === "unsupported" ? "Enable browser graphics acceleration or try another browser. The text summary and editing controls remain available." : "Check your connection, then retry. The text summary and editing controls remain available.")}</p>
    <button type="button" className="min-h-11 rounded-lg border bg-card px-4 py-2" onClick={onRetry}>{t("Retry preview")}</button>
  </div>;
}

export function WorkshopCameraControls({ view, mode, editable, ready, selectionLabel, faded, fullscreen, onViewChange, onModeChange, onAction, onFadeChange, onFullscreen, viewsOnly = false, hideViews = false, hideInteraction = false, hideCommonActions = false }: {
  view: ScenePresentation["view"]; mode: WorkshopInteractionMode; editable: boolean; ready: boolean;
  selectionLabel: string | null; faded: boolean; fullscreen: boolean;
  onViewChange: (view: ScenePresentation["view"]) => void;
  onModeChange: (mode: WorkshopInteractionMode) => void;
  onAction: (action: WorkshopCameraAction) => void; onFadeChange: (value: boolean) => void; onFullscreen: () => void;
  viewsOnly?: boolean; hideViews?: boolean; hideInteraction?: boolean; hideCommonActions?: boolean;
}) {
  const { t } = useWorkshopLanguage();
  const button = "min-h-11 rounded-lg border border-border bg-card px-3 py-2 text-base disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  const selected = "border-primary bg-primary text-primary-foreground";
  return <div role="group" className="mt-3 space-y-3" aria-label={t("Preview controls")}>
    {editable && !viewsOnly && !hideInteraction && <div>
      <div className="flex flex-wrap gap-2" aria-label={t("Interaction mode")}>
        {(["camera", "edit"] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} onClick={() => onModeChange(value)} className={`${button} ${mode === value ? selected : ""}`}>{t(value === "camera" ? "Camera" : "Edit")}</button>)}
      </div>
      <WorkshopGuidance className="mt-2 text-sm text-muted-foreground">{t(mode === "camera" ? "Drag to look around. Camera controls do not change your exercise." : "Drag equipment to move it. Round grab buttons move machine handles. Use Camera to look around.")}</WorkshopGuidance>
    </div>}
    {!hideViews && <div role="group" className="flex flex-wrap gap-2" aria-label={t("Model view")}>
      {([["front", "Front"], ["three_quarter", "Three-quarter"], ["side", "Side"], ["back", "Back view"]] as const).map(([angle, label]) => <button key={angle} type="button" disabled={!ready} aria-pressed={view === angle} onClick={() => onViewChange(angle)} className={`${button} ${view === angle ? selected : ""}`}>{t(label)}</button>)}
    </div>}
    {!viewsOnly && <><div role="group" className="flex flex-wrap gap-2" aria-label={t("Camera actions")}>
      {([["zoom-in", "Zoom in"], ["zoom-out", "Zoom out"], ["fit", "Fit scene"], ["reset", "Reset view"], ["opposite", "Opposite side"]] as const).filter(([action]) => !hideCommonActions || !["zoom-in", "zoom-out", "fit"].includes(action)).map(([action, label]) => <button key={action} type="button" disabled={!ready} onClick={() => onAction(action)} className={button}>{t(label)}</button>)}
      {editable && <button type="button" disabled={!ready || !selectionLabel} onClick={() => onAction("focus")} className={button}>{t("Focus {selection}", { selection: selectionLabel ?? "selected" })}</button>}
      {!hideCommonActions && <button type="button" onClick={onFullscreen} className={button}>{t(fullscreen ? "Exit full screen" : "Full screen")}</button>}
    </div>
    <label className="flex min-h-11 items-center gap-3 text-base"><input type="checkbox" checked={faded} onChange={event => onFadeChange(event.target.checked)} disabled={!ready} className="h-5 w-5 accent-primary" />{t("Fade equipment to inspect contacts")}</label>
    {faded && <WorkshopGuidance className="text-sm text-muted-foreground">{t("Equipment is faded only in this preview. Uncheck to restore it.")}</WorkshopGuidance>}</>}
  </div>;
}
