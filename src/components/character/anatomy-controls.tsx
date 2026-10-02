"use client";

import { useId, useState } from "react";
import { muscleGroups, type MuscleOption } from "@/lib/motion/anatomy";
import { searchAnatomy } from "@/lib/motion/workshop-anatomy-search";
import { useWorkshopLanguage } from "./workshop-language";

export function AnatomyControls({ muscles, target, isolate, count, onTargetChange, onIsolateChange, unavailable = false }: {
  muscles: MuscleOption[]; target: string; isolate: boolean; count: number;
  onTargetChange: (target: string) => void; onIsolateChange: (isolate: boolean) => void;
  unavailable?: boolean;
}) {
  const id = useId();
  const { language, t } = useWorkshopLanguage();
  const [search, setSearch] = useState("");
  const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = searchAnatomy(muscles, search);
  const localizedGroups = language === "he" && tokens.length ? muscleGroups.filter(group => tokens.every(token => t(group.label).includes(token))) : [];
  const groups = muscleGroups.filter(group => results.groups.includes(group) || localizedGroups.includes(group));
  const individual = muscles.filter(item => results.individual.includes(item) || localizedGroups.some(group => group.pattern.test(item.id.toLowerCase())));
  const selected = muscles.find(item => item.id === target);
  const selectedGroup = muscleGroups.find(item => `group:${item.id}` === target);
  const selectedVisible = groups.some(item => `group:${item.id}` === target) || individual.some(item => item.id === target);
  const label = selected?.label ?? selectedGroup?.label ?? (target === "none" ? undefined : target);
  const fieldClass = "mt-1 min-h-11 w-full min-w-0 rounded-lg border border-border bg-card px-3 py-2 text-base font-normal";
  return <div className="mt-4 space-y-2" aria-label={t("Muscle exploration")}>
    <div className="flex flex-wrap items-end gap-3">
      <label htmlFor={`${id}-search`} className="min-w-0 flex-1 basis-40 text-base font-semibold">{t("Find a body area or muscle")}
        <input id={`${id}-search`} type="search" value={search} onChange={event => setSearch(event.target.value)}
          placeholder={t("Shoulders, upper arm, butt…")} disabled={unavailable || !muscles.length} className={fieldClass} />
      </label>
      <div className="min-w-0 flex-1 basis-64 text-base font-semibold"><label htmlFor={`${id}-highlight`}>{t("Highlight")}</label>
        <select id={`${id}-highlight`} value={target} onChange={event => onTargetChange(event.target.value)} disabled={unavailable || !muscles.length} className={fieldClass}>
          <option value="none">{t("None")}</option>
          {!selectedVisible && label && <option value={target}>{t("{label} (selected)", { label: t(label) })}</option>}
          {!!groups.length && <optgroup label={t("Muscle groups (both sides)")}>{groups.map(item => <option key={item.id} value={`group:${item.id}`}>{t(item.label)}</option>)}</optgroup>}
          {!!individual.length && <optgroup label={t("Individual muscles and structures")}>{individual.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</optgroup>}
        </select>
      </div>
      <label className="flex min-h-11 items-center gap-3 py-2 text-base"><input type="checkbox" checked={isolate} onChange={event => onIsolateChange(event.target.checked)} disabled={unavailable || !muscles.length} className="h-5 w-5 accent-primary" />{t("Show selected only")}</label>
    </div>
    <p className="text-sm text-muted-foreground">{tokens.length ? t("{groups} groups · {individual} individual structures found", { groups: groups.length, individual: individual.length }) : t("{count} muscle structures · separate sides and heads", { count: muscles.length })}</p>
    {!!tokens.length && !groups.length && !individual.length && <p className="text-sm">{t("No matches. Try a body area such as shoulders, upper arm or butt, or a formal name such as gluteus. Your selected highlight stays selected.")}</p>}
    <p role="status" className="text-sm">{unavailable ? t("Anatomy preview unavailable. {selection} Retry the preview to explore anatomy.", { selection: target === "none" ? t("No muscle highlight selected.") : t("Selected highlight: {label}.", { label: t(label ?? target) }) }) : !muscles.length ? t("Loading anatomy model…") : target === "none" ? t("No muscles highlighted") : t("{label} · {count} {structure} {state}", { label: t(label ?? target), count, structure: count === 1 ? "structure" : "structures", state: isolate ? "isolated" : "highlighted" })}</p>
  </div>;
}
