"use client";

import type { StudioDragPlane } from "@/lib/motion/workshop-mouse";
import { Hand, Move3D, Orbit, Rotate3D, SlidersHorizontal, UserRound } from "@/components/ui/icons";
import { useWorkshopLanguage } from "./workshop-language";

export type WorkshopManipulationTool = "camera" | "select" | "move" | "rotate" | "limbs" | "free";

export function WorkshopManipulationControls({
  active, onTool, plane, onPlane, selectedName, disabled, rotating, canMove = true,
  sensitivity, onSensitivity, snap, onSnap,
}: {
  active: WorkshopManipulationTool;
  onTool: (tool: WorkshopManipulationTool) => void;
  plane: StudioDragPlane;
  onPlane: (plane: StudioDragPlane) => void;
  selectedName: string | null;
  disabled: boolean;
  rotating: boolean;
  canMove?: boolean;
  sensitivity: number;
  onSensitivity: (value: number) => void;
  snap: boolean;
  onSnap: (value: boolean) => void;
}) {
  const { t } = useWorkshopLanguage();
  const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40";
  const tools = [
    ["camera", "Camera", Orbit], ["select", "Select", Hand], ["move", "Move", Move3D],
    ["rotate", "Rotate", Rotate3D], ["limbs", "Hands & feet", UserRound],
  ] as const;
  return <div data-tutorial-target="manipulation" className="shrink-0 space-y-2 border-b border-border pb-2">
    <div role="toolbar" aria-label={t("Movement tools")} className="flex flex-wrap items-center gap-1">
      {tools.map(([tool, label, Icon]) => <button key={tool} type="button"
        aria-label={t(tool === "limbs" ? "Pose hands and feet" : label)}
        title={t(label)}
        aria-pressed={active === tool} disabled={disabled || tool === "move" && !canMove} onClick={() => onTool(tool)}
        className={`${button} ${active === tool ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
        <Icon size={17} aria-hidden="true" className="sm:hidden xl:block" /><span className="hidden sm:inline">{t(label)}</span>
      </button>)}
      <details name="workshop-dropdown" className="relative ms-auto">
        <summary aria-label={t("Drag options")} title={t("Drag options")} className={`${button} cursor-pointer list-none text-muted-foreground hover:bg-muted`}><SlidersHorizontal size={17} className="sm:hidden" /><span className="sr-only sm:not-sr-only">{t("Drag options")}</span></summary>
        <div className="absolute end-0 top-full z-30 mt-1 w-64 space-y-2 rounded-xl border border-border bg-card p-3 shadow-lg">
          <button type="button" aria-label={t("Move with mouse")} aria-pressed={active === "free"}
            disabled={disabled} onClick={() => onTool("free")}
            className={`${button} w-full justify-start ${active === "free" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{t("Free drag")}</button>
          <p className="text-sm leading-5 text-muted-foreground">{t("Free drag moves the selected item across the chosen plane. Use arrows for one direction at a time.")}</p>
          <label className="flex flex-wrap items-center justify-between gap-2 pt-2 text-sm font-medium">{t("Sensitivity")}
            <output>{Math.round(sensitivity * 100)}%</output>
            <input aria-label={t("Movement sensitivity")} type="range" min={10} max={100} step={5} value={Math.round(sensitivity * 100)}
              disabled={disabled} onChange={event => onSensitivity(Number(event.target.value) / 100)} className="w-full accent-primary" />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={snap} disabled={disabled} onChange={event => onSnap(event.target.checked)} />{t("Snap to grid")}</label>
        </div>
      </details>
    </div>
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-1 text-sm">
      <p className="min-w-0 flex-1 truncate text-muted-foreground">{selectedName ? <><span className="sr-only">{t("Selected:")}</span> <span className="font-semibold text-foreground" data-workshop-translate="false">{selectedName}</span></> : t("Select a joint, the figure or equipment to begin.")}</p>
      {selectedName && !rotating && active !== "camera" && active !== "select" && <label className="flex items-center gap-2 font-medium"><span className="sr-only sm:not-sr-only">{t("Direction")}</span>
        <select aria-label={t("Movement plane")} value={plane} disabled={disabled} onChange={event => onPlane(event.target.value as StudioDragPlane)}
          className="min-h-11 max-w-36 rounded-lg border border-border bg-background px-2 text-sm">
          <optgroup label={t("Planes")}>
            <option value="view">{t("Across the view")}</option><option value="front">{t("Front plane")}</option>
            <option value="side">{t("Side plane")}</option><option value="floor">{t("Along the floor")}</option>
          </optgroup>
          <optgroup label={t("One direction")}>
            <option value="x">{t("Left / right")}</option><option value="y">{t("Up / down")}</option><option value="z">{t("Forward / backward")}</option>
          </optgroup>
        </select>
      </label>}
    </div>
    {active === "camera" && <p className="px-1 text-sm text-muted-foreground">{t("Drag to look around. Choose Select to edit the scene.")}</p>}
  </div>;
}

export function WorkshopFineAdjustment({ plane, disabled, canNudge, rotating, axes = ["x", "y", "z"], step, onStep, onNudge }: {
  plane: StudioDragPlane; disabled: boolean; canNudge: boolean; rotating: boolean;
  axes?: ("x" | "y" | "z")[]; step: number; onStep: (step: number) => void;
  onNudge: (axis: "x" | "y" | "z", direction: number) => void;
}) {
  const { t } = useWorkshopLanguage();
  const button = "inline-flex min-h-11 items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40";
  const positions = { x: ["Move left", "Move right"], y: ["Move down", "Move up"], z: ["Move backward", "Move forward"] };
  const rotations = { x: ["Bend less", "Bend more"], y: ["Turn less", "Turn more"], z: ["Tilt less", "Tilt more"] };
  const labels = rotating ? rotations : positions;
  return <details className="px-1">
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-muted-foreground">{t("Fine adjustment")}</summary>
      <div className="flex flex-wrap items-center gap-2 pb-1" role="group" aria-label={t("Fine adjustment")}>
        <label className="flex items-center gap-2 text-sm">{t("Step")}
          <select aria-label={t(rotating ? "Nudge angle" : "Nudge distance")} value={step} disabled={disabled} onChange={event => onStep(Number(event.target.value))}
            className="min-h-11 rounded-lg border border-border bg-background px-2">
            {(rotating ? [1, 5, 15] : [0.01, 0.05, 0.1]).map(value => <option key={value} value={value}>{rotating ? `${value}°` : `${value * 100} ${t("cm")}`}</option>)}
          </select>
        </label>
        {axes.map(axis => <div key={axis} className="flex gap-1">
          {([-1, 1] as const).map((direction, index) => <button type="button" key={direction} aria-label={t(labels[axis][index])}
            disabled={disabled || !canNudge || !rotating && (plane === "front" && axis === "z" || plane === "side" && axis === "x" || plane === "floor" && axis === "y" || ["x", "y", "z"].includes(plane) && axis !== plane)} onClick={() => onNudge(axis, direction)} className={`${button} border border-border hover:bg-muted`}>
            {t(labels[axis][index])}
          </button>)}
        </div>)}
      </div>
    </details>;
}
