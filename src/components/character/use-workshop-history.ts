"use client";

import { useCallback, useState } from "react";
import type { WorkshopScene } from "@/lib/motion/workshop";
import type { WorkshopHistoryEntry } from "@/lib/motion/workshop-history";

export function useWorkshopHistory() {
  const [past, setPast] = useState<WorkshopHistoryEntry[]>([]);
  const [future, setFuture] = useState<WorkshopHistoryEntry[]>([]);
  const record = useCallback((entry: WorkshopHistoryEntry) => {
    setPast(items => [...items.slice(-49), entry]); setFuture([]);
  }, []);
  const undo = (scene: WorkshopScene) => {
    const entry = past.at(-1);
    if (!entry) return null;
    setFuture(items => [{ scene, label: entry.label }, ...items]); setPast(items => items.slice(0, -1));
    return entry;
  };
  const redo = (scene: WorkshopScene) => {
    const entry = future[0];
    if (!entry) return null;
    setPast(items => [...items.slice(-49), { scene, label: entry.label }]); setFuture(items => items.slice(1));
    return entry;
  };
  return { past, future, record, undo, redo };
}
