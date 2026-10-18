"use client";

import { useRef, useState, type ReactNode } from "react";
import { useWorkshopLanguage } from "./workshop-language";
import { SlidersHorizontal } from "@/components/ui/icons";

export const workshopTools = [
  ["equipment", "Equipment"], ["placement", "Position"], ["contact", "Contacts"], ["pose", "Pose"],
  ["timeline", "Timeline"], ["view", "View"], ["setups", "Setups"], ["settings", "Settings"],
] as const;
export type WorkshopTool = typeof workshopTools[number][0];

export function WorkshopToolNavigation({ selected, onSelect }: { selected: WorkshopTool | null; onSelect: (tool: WorkshopTool) => void }) {
  const { t, language } = useWorkshopLanguage();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const secondary = useRef<HTMLDetailsElement>(null);
  const tab = ([tool, name]: typeof workshopTools[number], index: number) => <button key={tool} ref={element => { buttons.current[index] = element; }} id={`workshop-tool-${tool}`} type="button" role="tab"
      aria-controls={`workshop-panel-${tool}`} aria-selected={selected === tool} tabIndex={selected === tool || !selected && index === 0 ? 0 : -1}
      onClick={() => {
        onSelect(tool);
        if (index >= 5 && secondary.current) {
          secondary.current.open = false;
          requestAnimationFrame(() => document.getElementById(`workshop-panel-${tool}`)?.focus({ preventScroll: true }));
        }
      }} onKeyDown={event => {
        const direction = language === "he" ? -1 : 1;
        const next = event.key === "Home" ? 0 : event.key === "End" ? workshopTools.length - 1
          : event.key === "ArrowRight" ? (index + direction + workshopTools.length) % workshopTools.length
          : event.key === "ArrowLeft" ? (index - direction + workshopTools.length) % workshopTools.length : null;
        if (next === null) return;
        event.preventDefault();
        if (next >= 5 && secondary.current) secondary.current.open = true;
        onSelect(workshopTools[next][0]); buttons.current[next]?.focus({ preventScroll: true });
      }} className="min-h-11 rounded-md px-2 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring aria-selected:bg-accent aria-selected:text-accent-foreground">{t(name)}</button>;
  return <div role="group" aria-label={t("Workshop tools")} className="relative grid grid-cols-3 gap-1 border-b bg-background p-2">
    <div role="tablist" aria-label={t("Workshop tools")} className="contents">{workshopTools.slice(0, 5).map((item, index) => tab(item, index))}</div>
    <details ref={secondary} className="relative min-w-0 self-start" onKeyDown={event => { if (event.key === "Escape" && secondary.current) { secondary.current.open = false; secondary.current.querySelector("summary")?.focus(); } }}>
      <summary aria-label={t("More tools")} className={`flex min-h-11 cursor-pointer list-none items-center justify-center gap-1.5 rounded-md px-2 py-2 text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden ${selected && ["view", "setups", "settings"].includes(selected) ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}><SlidersHorizontal size={14} />{t(selected && ["view", "setups", "settings"].includes(selected) ? workshopTools.find(item => item[0] === selected)![1] : "Tools")}</summary>
      <div role="tablist" aria-label={t("More tools")} className="absolute end-0 top-full z-30 flex min-w-44 flex-col rounded-lg border bg-card p-1 shadow-lg">{workshopTools.slice(5).map((item, index) => tab(item, index + 5))}</div>
    </details>
  </div>;
}

export function WorkshopToolPanel({ tool, selected, children, eager = false }: { tool: WorkshopTool; selected: WorkshopTool; children: ReactNode; eager?: boolean }) {
  const [visited, setVisited] = useState(eager || tool === selected);
  if (tool === selected && !visited) setVisited(true);
  return <section id={`workshop-panel-${tool}`} role="tabpanel" aria-labelledby={`workshop-tool-${tool}`} hidden={tool !== selected}
    data-workshop-panel={tool} className="scroll-mt-28 space-y-4 focus-visible:outline-2 focus-visible:outline-ring" tabIndex={0}>{visited ? children : null}</section>;
}
