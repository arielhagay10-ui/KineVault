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
        <Image src="/posters/home-mascot.png" alt="Blue mascot wearing glasses and holding a pencil and notebook"
          width={1254} height={1254} preload unoptimized className="h-auto w-full" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-[8px] border border-input bg-background px-4 py-3 text-sm font-semibold text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">Try the movement viewer</button>
      </div>
    </div>}
  </div>;
}
