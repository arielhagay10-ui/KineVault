"use client";

import { useEffect } from "react";
import { recordExerciseView } from "@/app/exercises/community-actions";

export function ExerciseViewTracker({ exerciseId }: { exerciseId: string }) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let remaining = 3000;
    let startedAt = 0;
    let recorded = false;
    const pause = () => {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
        remaining = Math.max(0, remaining - (performance.now() - startedAt));
      }
    };
    const resume = () => {
      pause();
      if (recorded || document.visibilityState !== "visible") return;
      startedAt = performance.now();
      timer = setTimeout(() => {
        timer = undefined;
        recorded = true;
        void recordExerciseView(exerciseId).catch(() => {});
      }, remaining);
    };
    resume();
    document.addEventListener("visibilitychange", resume);
    return () => { pause(); document.removeEventListener("visibilitychange", resume); };
  }, [exerciseId]);
  return null;
}
