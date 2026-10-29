"use client";

import { useState, type ReactNode } from "react";
import { SlidersHorizontal } from "@/components/ui/icons";

export function MobileFilters({ children, count, initialOpen = false }: { children: ReactNode; count: number; initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return <>
    <button type="button" aria-expanded={open} aria-controls="explore-filters" onClick={() => setOpen(!open)}
      className="col-start-2 row-start-2 flex min-h-12 w-full items-center justify-center gap-2 self-end rounded-lg border border-input bg-card px-3 py-3 text-sm font-medium text-primary lg:hidden">
      <span className="flex items-center gap-2"><SlidersHorizontal size={16} aria-hidden />{open ? "Hide filters" : "Show filters"}</span>
      {count > 0 && <span className="text-xs text-muted-foreground">{count} active</span>}
    </button>
    <aside id="explore-filters" aria-label="Exercise filters" className={`col-span-2 min-w-0 ${open ? "block" : "hidden"} lg:sticky lg:top-6 lg:col-span-1 lg:col-start-1 lg:row-start-3 lg:block lg:self-start`}>{children}</aside>
  </>;
}
