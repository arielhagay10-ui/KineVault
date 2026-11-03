"use client";

import { Check, Pause, Play } from "@/components/ui/icons";
import { useId } from "react";
import type { WorkshopScene } from "@/lib/motion/workshop";
import { workshopMomentName } from "@/lib/motion/workshop-history";
import { useWorkshopLanguage } from "./workshop-language";
import type { MotionPlaybackClock } from "@/lib/motion/playback";
import { usePlaybackDisplayTime } from "./use-motion-playback";

/** Whether a pose matches its last capture, was edited after it, or was never captured. */
export type WorkshopPoseState = "captured" | "changed" | "new";

const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-base font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40";
const seconds = (milliseconds: number) => `${(milliseconds / 1000).toFixed(2)}s`;
const stateText: Record<WorkshopPoseState, string> = { captured: "captured", changed: "changed since capture", new: "not captured yet" };

export function WorkshopPlaybackControls({ scene, timeMs: editTime, playback, playing, speed, selectedFrame, disabled, demonstrationCaption, onPlayingChange, onSpeedChange, onTimeChange, onFrameChange, poseStates, firstPoseRecorded, onSavePose }: {
  scene: WorkshopScene; timeMs: number; playing: boolean; speed: number; selectedFrame: number;
  playback?: MotionPlaybackClock;
  disabled: boolean; demonstrationCaption: string | null; onPlayingChange: (playing: boolean) => void;
  onSpeedChange: (speed: number) => void; onTimeChange: (timeMs: number) => void; onFrameChange: (index: number) => void;
  poseStates: readonly WorkshopPoseState[]; firstPoseRecorded: boolean; onSavePose: () => void;
}) {
  const { t, formatNumber } = useWorkshopLanguage();
  const captureHintId = useId();
  const timeMs = usePlaybackDisplayTime(playback, editTime);
  const previewFrame = scene.keyframes.findIndex(frame => frame.timeMs === Math.round(timeMs));
  const saved = previewFrame === selectedFrame && poseStates[selectedFrame] === "captured";
  const needsStart = !firstPoseRecorded && previewFrame > 0;
  const poseName = (index: number) => {
    const { timeMs: time } = scene.keyframes[index];
    const name = workshopMomentName(time, scene.durationMs, index);
    return name.startsWith("Pose ") ? seconds(time) : t(name);
  };
  const status = playing ? t("Previewing movement") : previewFrame < 0 ? t("Between poses")
    : `${poseName(previewFrame)} · ${t(stateText[poseStates[previewFrame] ?? "new"])}`;
  return <section aria-label={t("Playback controls")} className="shrink-0 space-y-1 border-t border-border bg-card px-3 pt-2 pb-1">
    <div className="flex flex-wrap items-center gap-2">
      <button data-tutorial-target="playback" type="button" disabled={disabled} onClick={() => onPlayingChange(!playing)} className={buttonClass}>{playing ? <Pause size={16} /> : <Play size={16} />}<span className="sr-only min-[360px]:not-sr-only">{t(playing ? "Pause" : "Play")}</span></button>
      <select aria-label={t("Preview speed")} value={speed} onChange={event => onSpeedChange(Number(event.target.value))} className="min-h-11 max-w-20 rounded-lg border border-border bg-card p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{[.25, .5, 1].map(value => <option key={value} value={value}>{formatNumber(value)}×</option>)}</select>
      <p className="hidden tabular-nums text-sm text-muted-foreground sm:block" dir="ltr"><span className="font-semibold text-foreground">{seconds(timeMs)}</span> / {seconds(scene.durationMs)}</p>
      <p role={playing ? undefined : "status"} className={`sr-only min-w-0 truncate text-sm sm:not-sr-only ${saved ? "font-semibold text-primary" : "text-muted-foreground"}`}>{status}</p>
      <div data-tutorial-target="record-pose" data-pose-save-state={saved ? "saved" : "unsaved"} className="ms-auto">
        <button type="button" disabled={disabled || playing || saved || previewFrame < 0 || needsStart} onClick={onSavePose}
          aria-describedby={needsStart ? captureHintId : undefined}
          title={t(previewFrame < 0 ? "Choose a pose marker below to capture it." : needsStart ? "Capture the start before the finish." : "Capture records a pose. Save exercise stores it privately in your account.")}
          className={`${buttonClass} ${saved ? "" : "border-primary/60 text-primary"}`}>{saved && <Check size={14} aria-hidden="true" />}{t(previewFrame === 0 ? "Capture start" : "Capture pose")}</button>
      </div>
    </div>
    {needsStart && <p id={captureHintId} className="text-sm text-muted-foreground">{t("Capture the start before the finish.")}</p>}
    <div className="px-4">
      <input aria-label={t("Preview time")} aria-valuetext={`${seconds(timeMs)} · ${status}`} type="range" min={0} max={scene.durationMs} step={1} value={Math.round(timeMs)} disabled={disabled} onChange={event => onTimeChange(Number(event.target.value))} className="block min-h-6 w-full accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" />
      {/* Markers sit on the native thumb's travel: 8px in from each end of the track. */}
      <div role="group" aria-label={t("Poses")} className="relative h-11">
        {scene.keyframes.map((frame, index) => {
          const state = poseStates[index] ?? "new";
          const current = index === previewFrame;
          return <button key={frame.timeMs} type="button" data-pose-index={index} aria-pressed={current} disabled={disabled}
            aria-label={t("{pose} pose · {state}", { pose: poseName(index), state: t(stateText[state]) })} title={t("{pose} pose · {state}", { pose: poseName(index), state: t(stateText[state]) })}
            onClick={() => onFrameChange(index)} style={{ insetInlineStart: `calc(8px + ${frame.timeMs / scene.durationMs} * (100% - 16px))` }}
            className="group absolute top-0 flex min-h-11 min-w-11 flex-col items-center gap-1 rounded-md pt-1 ltr:-translate-x-1/2 rtl:translate-x-1/2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40">
            <span aria-hidden="true" className={`size-3 rotate-45 rounded-[2px] border-2 ${state === "captured" ? "border-primary bg-primary" : state === "changed" ? "border-primary bg-primary/30" : "border-muted-foreground bg-card"} ${current ? "outline-2 outline-offset-2 outline-ring" : ""}`} />
            <span className={`whitespace-nowrap text-xs tabular-nums ${current ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{poseName(index)}</span>
          </button>;
        })}
      </div>
    </div>
    {demonstrationCaption && <p className="text-sm"><strong>{t("Demonstration caption:")}</strong> {t(demonstrationCaption)}</p>}
  </section>;
}
