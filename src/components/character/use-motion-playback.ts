"use client";

import { useCallback, useEffect, useState } from "react";
import { MotionPlaybackClock } from "@/lib/motion/playback";

export function useMotionPlayback(durationMs: number, speed = 1, displayUpdates = true) {
  const [clock] = useState(() => { const value = new MotionPlaybackClock(); value.configure(durationMs, speed); return value; });
  const [timeMs, setDisplayTime] = useState(0);
  const [playing, setPlayingState] = useState(false);
  useEffect(() => { clock.configure(durationMs, speed); }, [clock, durationMs, speed]);
  const setTimeMs = useCallback((time: number) => { clock.seek(time); setDisplayTime(clock.timeMs); }, [clock]);
  const setPlaying = useCallback((value: boolean) => {
    clock.setPlaying(value); setPlayingState(value); setDisplayTime(clock.timeMs);
  }, [clock]);
  useEffect(() => {
    if (!playing) return;
    let request = 0, lastDisplay = -Infinity;
    const tick = (now: number) => {
      clock.tick(now);
      // Only the display clock and scrubber need React updates.
      if (displayUpdates && now - lastDisplay >= 100) { setDisplayTime(clock.timeMs); lastDisplay = now; }
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [clock, playing, displayUpdates]);
  return { clock, timeMs, playing, setTimeMs, setPlaying };
}

/** Subscribe only the small controls that display the running clock. */
export function usePlaybackDisplayTime(clock: MotionPlaybackClock | undefined, fallback: number, enabled = true) {
  const [display, setDisplay] = useState<{ clock: MotionPlaybackClock; timeMs: number } | null>(null);
  useEffect(() => {
    if (!clock || !enabled) return;
    let lastDisplay = -Infinity;
    return clock.subscribe(() => {
      const now = performance.now();
      if (!clock.playing || now - lastDisplay >= 100) {
        lastDisplay = now;
        setDisplay({ clock, timeMs: clock.timeMs });
      }
    });
  }, [clock, enabled]);
  return enabled && clock?.playing && display?.clock === clock ? display.timeMs : fallback;
}
