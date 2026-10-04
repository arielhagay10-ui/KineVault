"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useState } from "react";

const Demo = dynamic(async () => {
  const [{ SharedMotion }, { defaultScene }] = await Promise.all([
    import("./shared-motion"), import("@/lib/motion/workshop"),
  ]);
  return function MotionDemo() { return <SharedMotion scene={defaultScene} />; };
}, { ssr: false, loading: () => <p className="p-6 text-sm text-muted-foreground">Loading motion study…</p> });

export function CharacterPreview() {
  const [open, setOpen] = useState(false);
  return <div className="min-w-0">
    {open ? <Demo /> : <div className="overflow-hidden rounded-[12px] border bg-card">
      <div className="relative bg-[#f7f8f8]">
        <Image src="/posters/home-anatomy.webp" alt="Anatomical figure performing a dumbbell lateral raise with the shoulder muscles highlighted"
          width={623} height={500} preload unoptimized className="h-auto w-full" />
        <p className="absolute left-5 top-5 rounded-full border border-black/10 bg-white/90 px-3 py-1.5 text-xs font-semibold text-neutral-700">Shoulder abduction</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <p className="text-sm font-medium">Study the movement from every angle.</p>
        <button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-[8px] border border-input bg-background px-4 py-3 text-sm font-semibold text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">Open interactive 3D preview</button>
      </div>
      <p className="border-t px-5 py-3 text-[0.6875rem] leading-5 text-muted-foreground">Z-Anatomy by Gauthier Kervyn and contributors · CC BY-SA 4.0. BodyParts3D © The Database Center for Life Science · CC BY-SA 2.1 Japan. Adapted geometry, materials and posing. <a href="/models/z-anatomy/ATTRIBUTION.md" className="underline">Credits and licenses</a></p>
    </div>}
    <p className="mt-3 text-xs text-muted-foreground">Z-Anatomy pose study · motion controls illustrate the demo, not measured joint angles.</p>
  </div>;
}
