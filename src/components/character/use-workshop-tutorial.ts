"use client";

import { useEffect, useRef, useState } from "react";
import { readWorkshopTutorial, tutorialStorageKey, type WorkshopTutorialState } from "@/lib/motion/workshop-tutorial";

const sessionProgress = new Map<string, string>();
export function useWorkshopTutorial(ownerId: string, eligible: boolean) {
  const key = tutorialStorageKey(ownerId);
  const [state, setState] = useState<WorkshopTutorialState>(() => readWorkshopTutorial(sessionProgress.get(key) ?? null, eligible || sessionProgress.has(key)));
  const revision = useRef(0);
  useEffect(() => {
    const initialRevision = revision.current;
    const frame = requestAnimationFrame(() => {
      // A manual action takes precedence over delayed initial progress loading.
      if (revision.current !== initialRevision) return;
      let raw = sessionProgress.get(key) ?? null;
      try { raw = localStorage.getItem(key) ?? raw; } catch { /* Session progress still works. */ }
      // A first-save route update must preserve this browser's active tour.
      const next = readWorkshopTutorial(raw, eligible || sessionProgress.has(key));
      sessionProgress.set(key, JSON.stringify(next));
      setState(next);
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
