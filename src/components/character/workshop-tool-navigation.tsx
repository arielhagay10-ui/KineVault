"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useWorkshopLanguage } from "./workshop-language";

export const workshopTools = [
  ["equipment", "Item settings"], ["placement", "Position"], ["contact", "Contacts"], ["pose", "Pose"],
  ["timeline", "Timeline"], ["view", "View"],
] as const;
export type WorkshopTool = typeof workshopTools[number][0];
const primaryTools = workshopTools.slice(0, 6);

export function WorkshopToolNavigation({ selected, onSelect }: { selected: WorkshopTool | null; onSelect: (tool: WorkshopTool) => void }) {
  const { t, language } = useWorkshopLanguage();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  // Phones show the tabs as one scrolling strip; keep the active tab in view when selection changes it.
  useEffect(() => {
    const index = primaryTools.findIndex(([tool]) => tool === selected);
    buttons.current[index]?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [selected]);
  const tab = ([tool, name]: typeof workshopTools[number], index: number) => <button key={tool} ref={element => { buttons.current[index] = element; }} id={`workshop-tool-${tool}`} type="button" role="tab"
      aria-controls={`workshop-panel-${tool}`} aria-selected={selected === tool} tabIndex={selected === tool || !primaryTools.some(item => item[0] === selected) && index === 0 ? 0 : -1}
      onClick={() => onSelect(tool)} onKeyDown={event => {
        const direction = language === "he" ? -1 : 1;
        const next = event.key === "Home" ? 0 : event.key === "End" ? primaryTools.length - 1
          : event.key === "ArrowRight" ? (index + direction + primaryTools.length) % primaryTools.length
          : event.key === "ArrowLeft" ? (index - direction + primaryTools.length) % primaryTools.length : null;
        if (next === null) return;
        event.preventDefault();
        onSelect(primaryTools[next][0]); buttons.current[next]?.focus({ preventScroll: true });
      }} className="min-h-11 shrink-0 rounded-md px-3 py-2 text-sm font-semibold whitespace-nowrap text-muted-foreground md:shrink md:px-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring aria-selected:bg-accent aria-selected:text-accent-foreground">{t(name)}</button>;
  return <div role="group" aria-label={t("Workshop tools")} className="relative flex gap-1 overflow-x-auto border-b bg-background p-2 md:grid md:grid-cols-3 md:overflow-visible">
    <div role="tablist" aria-label={t("Workshop tools")} className="contents">{primaryTools.map((item, index) => tab(item, index))}</div>
  </div>;
}

export function WorkshopToolPanel({ tool, selected, children, eager = false }: { tool: WorkshopTool; selected: WorkshopTool; children: ReactNode; eager?: boolean }) {
  const [visited, setVisited] = useState(eager || tool === selected);
  if (tool === selected && !visited) setVisited(true);
  return <section id={`workshop-panel-${tool}`} role="tabpanel" aria-labelledby={`workshop-tool-${tool}`} hidden={tool !== selected}
    data-workshop-panel={tool} className="scroll-mt-28 space-y-4 focus-visible:outline-2 focus-visible:outline-ring" tabIndex={0}>{visited ? children : null}</section>;
}
