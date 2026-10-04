"use client";

import { useCallback, useEffect, useState } from "react";
import { MotionPlaybackClock } from "@/lib/motion/playback";

export function useMotionPlayback(durationMs: number, speed = 1) {
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
      if (now - lastDisplay >= 100) { setDisplayTime(clock.timeMs); lastDisplay = now; }
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [clock, playing]);
  return { clock, timeMs, playing, setTimeMs, setPlaying };
}
