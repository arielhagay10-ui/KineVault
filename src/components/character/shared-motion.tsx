"use client";

import { useEffect, useState } from "react";
import type { WorkshopScene } from "@/lib/motion/workshop";
import { MotionCanvas } from "./motion-canvas";

export function SharedMotion({ scene }: { scene: WorkshopScene }) {
  const [timeMs, setTimeMs] = useState(0);
  const [playing, setPlaying] = useState(true);
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
  return <section className="mt-9 rounded-2xl border border-[#dce5de] bg-white p-4 sm:p-5">
    <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Motion study</h2><span className="text-xs text-[#748578]">Drag to change angle</span></div>
    <MotionCanvas scene={scene} timeMs={timeMs} className="h-[400px] sm:h-[500px]" />
    <div className="mt-4 flex items-center gap-4">
      <button type="button" onClick={() => setPlaying(!playing)} className="rounded-lg bg-[#174a3e] px-4 py-2 text-sm font-semibold text-white">{playing ? "Pause" : "Play"}</button>
      <input type="range" aria-label="Scrub motion" min={0} max={scene.durationMs} value={Math.round(timeMs)}
        onChange={(event) => { setPlaying(false); setTimeMs(Number(event.target.value)); }} className="w-full accent-[#26775b]" />
    </div>
  </section>;
}
