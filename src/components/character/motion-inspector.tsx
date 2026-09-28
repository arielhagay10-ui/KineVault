"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { WorkshopScene } from "@/lib/motion/workshop";

const SharedMotion = dynamic(() => import("./shared-motion").then((module) => module.SharedMotion), {
  ssr: false, loading: () => <p className="mt-4 text-sm text-muted-foreground">Loading motion study…</p>,
});

export function MotionInspector({ scene }: { scene: WorkshopScene }) {
  const [open, setOpen] = useState(false);
  return <section className="mt-6">
    <button type="button" aria-expanded={open} aria-controls="motion-inspection" onClick={() => setOpen(!open)}
      className="rounded-xl border bg-card px-4 py-3 text-sm font-semibold">{open ? "Close motion study" : "Inspect motion in 3D"}</button>
    {open && <div id="motion-inspection"><SharedMotion scene={scene} /></div>}
  </section>;
}
