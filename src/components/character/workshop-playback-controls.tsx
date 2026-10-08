"use client";

import { Pause, Play } from "@/components/ui/icons";
import type { WorkshopScene } from "@/lib/motion/workshop";
import { workshopMomentName } from "@/lib/motion/workshop-history";
import { useWorkshopLanguage } from "./workshop-language";

const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-base font-semibold disabled:opacity-40";
const label = (milliseconds: number) => `${(milliseconds / 1000).toFixed(2)}s`;

export function WorkshopPlaybackControls({ scene, timeMs, playing, speed, selectedFrame, disabled, demonstrationCaption, onPlayingChange, onSpeedChange, onTimeChange, onFrameChange }: {
  scene: WorkshopScene; timeMs: number; playing: boolean; speed: number; selectedFrame: number;
  disabled: boolean; demonstrationCaption: string | null; onPlayingChange: (playing: boolean) => void;
  onSpeedChange: (speed: number) => void; onTimeChange: (timeMs: number) => void; onFrameChange: (index: number) => void;
}) {
  const { t, formatNumber } = useWorkshopLanguage();
  return <section aria-label={t("Playback controls")} className="shrink-0 space-y-1 border-t bg-card px-2 py-2">
    <div className="flex flex-wrap items-center gap-2">
      <button data-tutorial-target="playback" type="button" disabled={disabled} onClick={() => onPlayingChange(!playing)} className={buttonClass}>{playing ? <Pause size={16} /> : <Play size={16} />}{t(playing ? "Pause" : "Play")}</button>
      <select aria-label={t("Preview speed")} value={speed} onChange={event => onSpeedChange(Number(event.target.value))} className="min-h-11 max-w-20 rounded-lg border bg-card p-2">{[.25, .5, 1].map(value => <option key={value} value={value}>{formatNumber(value)}×</option>)}</select>
      <button type="button" aria-label={t("View start")} onClick={() => onTimeChange(0)} className={buttonClass}>{t("Start")}</button>
      <button type="button" aria-label={t("View finish")} onClick={() => onTimeChange(scene.durationMs / 2)} className={buttonClass}>{t("Finish")}</button>
      <span className="ms-auto text-sm tabular-nums">{label(timeMs)}</span>
      <label className="flex items-center gap-2 text-sm">{t("Editing pose")}<select aria-label={t("Editing pose")} value={selectedFrame} disabled={disabled} onChange={event => onFrameChange(Number(event.target.value))} className="min-h-11 rounded-lg border bg-card px-2">{scene.keyframes.map((frame, index) => <option key={frame.timeMs} value={index}>{t(workshopMomentName(frame.timeMs, scene.durationMs, index))} · {label(frame.timeMs)}</option>)}</select></label>
    </div>
    <label className="flex items-center gap-2 text-xs"><span className="sr-only">{t("Preview time")} {label(timeMs)} · {t("Editing pose")} {label(scene.keyframes[selectedFrame].timeMs)}</span><input aria-label={t("Preview time")} type="range" min={0} max={scene.durationMs} step={1} value={Math.round(timeMs)} disabled={disabled} onChange={event => onTimeChange(Number(event.target.value))} className="w-full accent-primary" /><span className="shrink-0 tabular-nums">{label(scene.durationMs)}</span></label>
    {demonstrationCaption && <p className="text-sm"><strong>{t("Demonstration caption:")}</strong> {t(demonstrationCaption)}</p>}
  </section>;
}
