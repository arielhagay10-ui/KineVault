"use client";

import { SharedMotion } from "./shared-motion";
import { defaultScene } from "@/lib/motion/workshop";

export function CharacterPreview() {
  return <div className="min-w-0"><SharedMotion scene={defaultScene} /><p className="mt-3 text-xs text-muted-foreground">Z-Anatomy pose study · motion controls illustrate the demo, not measured joint angles.</p></div>;
}
