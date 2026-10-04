"use client";

import { useEffect, useRef, useState } from "react";
import { readWorkshopTutorial, tutorialStorageKey, type WorkshopTutorialState } from "@/lib/motion/workshop-tutorial";

const sessionProgress = new Map<string, string>();
export function useWorkshopTutorial(ownerId: string, eligible: boolean) {
  const [state, setState] = useState<WorkshopTutorialState>({ open: false, step: 0 });
  const revision = useRef(0);
  const key = tutorialStorageKey(ownerId);
  useEffect(() => {
    const initialRevision = revision.current;
    const frame = requestAnimationFrame(() => {
      // A manual action takes precedence over delayed initial progress loading.
      if (revision.current !== initialRevision) return;
      let raw = sessionProgress.get(key) ?? null;
      try { raw = localStorage.getItem(key) ?? raw; } catch { /* Session progress still works. */ }
      setState(readWorkshopTutorial(raw, eligible));
    });
    return () => cancelAnimationFrame(frame);
  }, [key, eligible]);
  const update = (next: WorkshopTutorialState) => {
    revision.current++;
    setState(next);
    const raw = JSON.stringify(next);
    sessionProgress.set(key, raw);
    try { localStorage.setItem(key, raw); } catch { /* Saving the exercise remains available. */ }
  };
  return { ...state, update };
}
