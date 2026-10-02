"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { WorkshopScene } from "@/lib/motion/workshop";

const MotionCanvas = dynamic(() => import("@/components/character/motion-canvas").then(module => module.MotionCanvas), {
  ssr: false, loading: () => <p role="status" className="p-4 text-sm">Loading preview. You can continue editing while it loads.</p>,
});

export function PrivateDraftPreview({ scene, name }: { scene: WorkshopScene; name: string }) {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [timeMs, setTimeMs] = useState(0);
  useEffect(() => {
    if (!playing || !open) return;
    let request = 0;
    const started = performance.now() - timeMs;
    const tick = (now: number) => {
      setTimeMs((now - started) % scene.durationMs);
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
    // Capture the authored preview position only when playback begins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, open, scene.durationMs]);
  return <div className="mt-4">
    <button type="button" aria-expanded={open} onClick={() => { setOpen(!open); setPlaying(false); }}
      className="min-h-11 rounded-xl border border-border px-4 py-3 text-base font-semibold">
      {open ? "Close preview" : "Preview saved motion"}
    </button>
    {open && <div className="mt-3 min-w-0 rounded-xl border border-border p-3">
      <p className="mb-2 text-sm text-muted-foreground">{name}. Saved motion, {(scene.durationMs / 1000).toFixed(1)} seconds. Playback starts when you choose Play.</p>
      <MotionCanvas scene={scene} timeMs={timeMs} className="h-64" />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setPlaying(!playing)} className="min-h-11 rounded-lg bg-primary px-4 text-base font-semibold text-primary-foreground">
          {playing ? "Pause" : "Play"}
        </button>
        <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-sm">Preview time
          <input type="range" aria-label={`Preview time for ${name}`} min={0} max={scene.durationMs} value={Math.round(timeMs)}
            onChange={event => { setPlaying(false); setTimeMs(Number(event.target.value)); }} className="min-h-11 min-w-0 flex-1 accent-primary" />
        </label>
      </div>
    </div>}
  </div>;
}
