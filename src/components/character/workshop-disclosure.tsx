"use client";

import { ChevronDown } from "@/components/ui/icons";
import { useState, type ReactNode } from "react";
import { useWorkshopLanguage } from "./workshop-language";

export function WorkshopDisclosure({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useWorkshopLanguage();
  const [open, setOpen] = useState(false);
  return <details name="workshop-dropdown" onToggle={event => setOpen(event.currentTarget.open)} className="group space-y-3">
    <summary role="button" aria-expanded={open} className="flex min-h-11 w-full cursor-pointer list-none items-center justify-between gap-2 rounded-lg border px-3 py-2 text-start font-semibold [&::-webkit-details-marker]:hidden">
      {t(title)}<ChevronDown size={16} className="group-open:rotate-180" />
    </summary>
    <div className="space-y-4">{children}</div>
  </details>;
}
