"use client";

import { useRef, type ReactNode } from "react";
import { useWorkshopLanguage } from "./workshop-language";

export const workshopTools = [
  ["equipment", "Equipment"], ["placement", "Position"], ["contact", "Contacts"], ["pose", "Pose"],
  ["timeline", "Timeline"], ["view", "View"], ["setups", "Setups"], ["settings", "Settings"],
] as const;
export type WorkshopTool = typeof workshopTools[number][0];

export function WorkshopToolNavigation({ selected, onSelect }: { selected: WorkshopTool | null; onSelect: (tool: WorkshopTool) => void }) {
  const { t, language } = useWorkshopLanguage();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return <div role="tablist" aria-label={t("Workshop tools")} className="grid grid-cols-4 border-b bg-card px-2">
    {workshopTools.map(([tool, name], index) => <button key={tool} ref={element => { buttons.current[index] = element; }} id={`workshop-tool-${tool}`} type="button" role="tab"
      aria-controls={`workshop-panel-${tool}`} aria-selected={selected === tool} tabIndex={selected === tool || !selected && index === 0 ? 0 : -1}
      onClick={() => onSelect(tool)} onKeyDown={event => {
        const direction = language === "he" ? -1 : 1;
        const next = event.key === "Home" ? 0 : event.key === "End" ? workshopTools.length - 1
          : event.key === "ArrowRight" ? (index + direction + workshopTools.length) % workshopTools.length
          : event.key === "ArrowLeft" ? (index - direction + workshopTools.length) % workshopTools.length : null;
        if (next === null) return;
        event.preventDefault(); onSelect(workshopTools[next][0]); buttons.current[next]?.focus({ preventScroll: true });
      }} className="min-h-11 border-b-2 border-transparent px-1 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring aria-selected:border-primary aria-selected:text-primary">{t(name)}</button>)}
  </div>;
}

export function WorkshopToolPanel({ tool, selected, children }: { tool: WorkshopTool; selected: WorkshopTool; children: ReactNode }) {
  return <section id={`workshop-panel-${tool}`} role="tabpanel" aria-labelledby={`workshop-tool-${tool}`} hidden={tool !== selected}
    data-workshop-panel={tool} className="scroll-mt-28 space-y-4 focus-visible:outline-2 focus-visible:outline-ring" tabIndex={0}>{children}</section>;
}
