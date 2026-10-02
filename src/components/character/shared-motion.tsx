"use client";

import { useEffect, useState } from "react";
import type { WorkshopScene } from "@/lib/motion/workshop";
import { MotionCanvas } from "./motion-canvas";

export function SharedMotion({ scene }: { scene: WorkshopScene }) {
  const [timeMs, setTimeMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    let request = 0;
    const start = performance.now() - timeMs;
    const tick = (now: number) => {
      setTimeMs((now - start) % scene.durationMs);
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
    // The current time is captured when playback begins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, scene.durationMs]);
  return <section className="mt-9 rounded-2xl border border-border bg-card p-4 sm:p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Motion study</h2><span className="text-xs text-muted-foreground">Drag to change angle</span></div>
    <MotionCanvas scene={scene} timeMs={timeMs} className="h-[400px] sm:h-[500px]" />
    <div className="mt-4 flex items-center gap-4">
      <button type="button" onClick={() => setPlaying(!playing)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{playing ? "Pause" : "Play"}</button>
      <input type="range" aria-label="Scrub motion" min={0} max={scene.durationMs} value={Math.round(timeMs)}
        onChange={(event) => { setPlaying(false); setTimeMs(Number(event.target.value)); }} className="w-full accent-primary" />
    </div>
    {!!scene.annotations?.length && <ol className="mt-4 space-y-2">{scene.annotations.map((item, index) => <li key={index}
      className={`rounded-lg border p-3 text-sm ${timeMs >= item.startMs && timeMs < item.endMs ? "border-primary bg-accent" : "border-border"}`}>
      <button type="button" className="font-semibold" onClick={() => { setPlaying(false); setTimeMs(item.startMs); }}>{item.label}</button>
      <span className="ml-2 text-xs text-muted-foreground">{(item.startMs / 1000).toFixed(2)}–{(item.endMs / 1000).toFixed(2)}s</span>
      {item.note && <p className="mt-1 text-muted-foreground">{item.note}</p>}
    </li>)}</ol>}
  </section>;
}
