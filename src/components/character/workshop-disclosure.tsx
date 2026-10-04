"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { useWorkshopLanguage } from "./workshop-language";

export function WorkshopDisclosure({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useWorkshopLanguage();
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div className="space-y-3">
    <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}
      className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-start font-semibold">
      {t(title)}<ChevronDown size={16} className={open ? "rotate-180" : ""} />
    </button>
    <div id={id} hidden={!open} className="space-y-4">{children}</div>
  </div>;
}
