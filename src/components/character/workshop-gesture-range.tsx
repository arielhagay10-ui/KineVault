"use client";

import { useEffect, useLayoutEffect, useState, useSyncExternalStore, type InputHTMLAttributes } from "react";
import type { WorkshopGestureScene } from "@/lib/motion/workshop-gesture";
import { WorkshopRangePreview } from "@/lib/motion/workshop-range";

export function WorkshopGestureRange({ gesture, value, onChange, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "type"> & {
  gesture: WorkshopGestureScene; value: number;
}) {
  const [preview] = useState(() => new WorkshopRangePreview(value));
  const displayed = useSyncExternalStore(preview.subscribe, preview.getSnapshot, () => value);
  useLayoutEffect(() => preview.configure(value), [preview, value]);
  useEffect(() => gesture.subscribe(event => {
    if (event.kind === "finish") preview.reset();
  }), [gesture, preview]);
  return <input {...props} data-workshop-scene-range type="range" value={displayed} onChange={event => {
    preview.change(event.currentTarget.valueAsNumber);
    onChange?.(event);
  }} />;
}
