"use client";

import { useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";

export function MobileFilters({ children, count }: { children: ReactNode; count: number }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" aria-expanded={open} aria-controls="explore-filters" onClick={() => setOpen(!open)}
      className="mb-4 flex w-full items-center justify-between rounded-xl border bg-card px-4 py-3 font-semibold lg:hidden">
      <span className="flex items-center gap-2"><SlidersHorizontal size={18} />{open ? "Hide filters" : "Show filters"}</span>
      {count > 0 && <span className="text-xs text-muted-foreground">{count} active</span>}
    </button>
    <div id="explore-filters" className={`${open ? "block" : "hidden"} lg:block`}>{children}</div>
  </>;
}
