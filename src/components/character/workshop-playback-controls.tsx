"use client";

import { Check, Pause, Play } from "@/components/ui/icons";
import { useId } from "react";
import type { WorkshopScene } from "@/lib/motion/workshop";
import { workshopMomentName } from "@/lib/motion/workshop-history";
import { useWorkshopLanguage } from "./workshop-language";
import type { MotionPlaybackClock } from "@/lib/motion/playback";
import { usePlaybackDisplayTime } from "./use-motion-playback";

const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-base font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40";
const label = (milliseconds: number) => `${(milliseconds / 1000).toFixed(2)}s`;

export function WorkshopPlaybackControls({ scene, timeMs: editTime, playback, playing, speed, selectedFrame, disabled, demonstrationCaption, onPlayingChange, onSpeedChange, onTimeChange, onFrameChange, poseSaved, firstPoseRecorded, onSavePose }: {
  scene: WorkshopScene; timeMs: number; playing: boolean; speed: number; selectedFrame: number;
  playback?: MotionPlaybackClock;
  disabled: boolean; demonstrationCaption: string | null; onPlayingChange: (playing: boolean) => void;
  onSpeedChange: (speed: number) => void; onTimeChange: (timeMs: number) => void; onFrameChange: (index: number) => void;
  poseSaved: boolean; firstPoseRecorded: boolean; onSavePose: () => void;
}) {
  const { t, formatNumber } = useWorkshopLanguage();
  const captureHintId = useId();
  const timeMs = usePlaybackDisplayTime(playback, editTime);
  const previewFrame = scene.keyframes.findIndex(frame => frame.timeMs === Math.round(timeMs));
  const saved = previewFrame === selectedFrame && poseSaved;
  const needsStart = !firstPoseRecorded && previewFrame > 0;
  return <section aria-label={t("Playback controls")} className="shrink-0 space-y-2 border-t border-border bg-card px-3 py-2 sm:py-3">
    <div className="flex flex-wrap items-center gap-2">
      <button data-tutorial-target="playback" type="button" disabled={disabled} onClick={() => onPlayingChange(!playing)} className={buttonClass}>{playing ? <Pause size={16} /> : <Play size={16} />}{t(playing ? "Pause" : "Play")}</button>
      <select aria-label={t("Preview speed")} value={speed} onChange={event => onSpeedChange(Number(event.target.value))} className="min-h-11 max-w-20 rounded-lg border border-border bg-card p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{[.25, .5, 1].map(value => <option key={value} value={value}>{formatNumber(value)}×</option>)}</select>
      <div data-tutorial-target="record-pose" className="ms-auto flex min-w-0 max-w-full flex-wrap items-center rounded-lg border border-border data-[pose-save-state=saved]:border-primary/40" data-pose-save-state={saved ? "saved" : "unsaved"}>
        <select aria-label={t("Editing pose")} value={previewFrame} disabled={disabled} onChange={event => onFrameChange(Number(event.target.value))} className="min-h-11 min-w-0 max-w-64 flex-1 rounded-s-lg bg-card px-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring">
          {previewFrame < 0 && <option value={-1} disabled>{t(playing ? "Previewing movement" : "New pose")}</option>}
          {scene.keyframes.map((frame, index) => <option key={frame.timeMs} value={index}>{t(workshopMomentName(frame.timeMs, scene.durationMs, index))}{![0, scene.durationMs / 2, scene.durationMs].includes(frame.timeMs) ? ` · ${label(frame.timeMs)}` : ""}{index === previewFrame ? ` · ${t(saved ? "Pose captured" : "Pose not captured")}` : ""}</option>)}
        </select>
        <button type="button" disabled={disabled || playing || saved || previewFrame < 0 || needsStart} onClick={onSavePose} aria-describedby={needsStart ? captureHintId : undefined} title={t(needsStart ? "Capture the start before the finish." : "Capture records a pose. Save exercise stores it privately in your account.")} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 border-s border-border px-3 py-2 text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring disabled:opacity-40">{saved && <Check size={14} aria-hidden="true" />}{t(previewFrame === 0 ? "Capture start" : "Capture pose")}</button>
      </div>
    </div>
    {needsStart && <p id={captureHintId} className="text-sm text-muted-foreground">{t("Capture the start before the finish.")}</p>}
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span role={playing ? undefined : "status"} className={`sr-only sm:not-sr-only ${saved ? "font-semibold text-primary" : ""}`}>{t(playing ? "Previewing movement" : saved ? "Pose captured" : "Pose not captured")}</span>
      <span className="flex flex-wrap gap-x-3 tabular-nums"><span>{t("Preview time")} {label(timeMs)}</span><span>{t("Editing pose")} {label(scene.keyframes[selectedFrame].timeMs)}</span></span>
    </div>
    <label className="flex items-center gap-3 text-xs"><input aria-label={t("Preview time")} type="range" min={0} max={scene.durationMs} step={1} value={Math.round(timeMs)} disabled={disabled} onChange={event => onTimeChange(Number(event.target.value))} className="min-h-9 min-w-0 w-full accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" /><span className="shrink-0 tabular-nums text-muted-foreground">{label(scene.durationMs)}</span></label>

    {demonstrationCaption && <p className="text-sm"><strong>{t("Demonstration caption:")}</strong> {t(demonstrationCaption)}</p>}
  </section>;
}
