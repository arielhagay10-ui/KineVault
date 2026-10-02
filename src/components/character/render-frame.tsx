"use client";

import { useEffect, useState } from "react";
import type { WorkshopScene } from "@/lib/motion/workshop";
import { MotionCanvas } from "./motion-canvas";

declare global {
  interface Window {
    kinevaultRenderFrame?: (timeMs: number) => void;
  }
}

export function RenderFrame({ scene }: { scene: WorkshopScene }) {
  const [timeMs, setTimeMs] = useState(0);
  useEffect(() => {
    window.kinevaultRenderFrame = setTimeMs;
    return () => { delete window.kinevaultRenderFrame; };
  }, []);
  return <div id="render-frame" className="h-[640px] w-[640px]">
    <MotionCanvas scene={scene} timeMs={timeMs} className="h-[640px] w-[640px] !rounded-none" showMuscleControls={false} />
  </div>;
}
