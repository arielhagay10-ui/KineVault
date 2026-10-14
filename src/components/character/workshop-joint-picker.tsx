"use client";
import { useState } from "react";
import type { JointSlug } from "@/lib/motion/workshop";
import { useWorkshopLanguage } from "./workshop-language";
const button = "min-h-11 rounded-lg border px-3 py-2 text-base";
const jointFamilies = [
  ["torso", "Torso"], ["shoulder", "Shoulder"], ["elbow", "Elbow"], ["wrist", "Wrist"],
  ["hip", "Hip"], ["knee", "Knee"], ["ankle", "Ankle"],
] as const;
type JointFamily = typeof jointFamilies[number][0];
type JointSide = "left" | "both" | "right";

export function WorkshopJointPicker({ selected, onSelect, compact = false, bothSides = true, onBothSidesChange }: {
  selected: JointSlug | null;
  onSelect: (joint: JointSlug) => void;
  compact?: boolean;
  bothSides?: boolean;
  onBothSidesChange?: (bothSides: boolean) => void;
}) {
  const { t } = useWorkshopLanguage();
  const [group, setGroup] = useState<"Arms" | "Legs" | "Torso">("Arms");
  const [side, setSide] = useState<"left" | "right">("left");
  const joints = group === "Arms" ? ["shoulder", "elbow", "wrist"] : group === "Legs" ? ["hip", "knee", "ankle"] : [];
  if (compact) {
    const family = selected?.replace(/^(left|right)-/, "") as JointFamily | undefined;
    const compactSide: JointSide = bothSides ? "both" : selected?.startsWith("right-") ? "right" : selected?.startsWith("left-") ? "left" : side;
    const choose = (nextFamily: JointFamily, nextSide: JointSide) => {
      if (nextSide !== "both") setSide(nextSide);
      onSelect(nextFamily === "torso" ? "torso" : `${nextSide === "right" ? "right" : "left"}-${nextFamily}` as JointSlug);
      onBothSidesChange?.(nextSide === "both");
    };
    return <div className="space-y-2">
      <label className="block space-y-2 text-sm font-semibold">{t("Body joint")}
        <select aria-label={t("Body joint")} value={family ?? ""} onChange={event => choose(event.target.value as JointFamily, compactSide)} className="min-h-11 w-full rounded-lg border bg-background px-3 text-base font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <option value="" disabled>{t("Choose a body joint")}</option>
          {jointFamilies.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
        </select>
      </label>
      {family && family !== "torso" && <div role="group" aria-label={t("Body side")} className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
        {(["left", "both", "right"] as const).map(value => <button type="button" key={value} aria-pressed={compactSide === value} onClick={() => choose(family, value)} className={`min-h-11 min-w-0 flex-1 rounded-md px-2 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${compactSide === value ? "bg-background text-primary" : "text-muted-foreground hover:bg-background/60"}`}>{t(value === "left" ? "Left" : value === "both" ? "Both" : "Right")}</button>)}
      </div>}
    </div>;
  }
  return <section className="space-y-3"><h2 className="font-semibold">{t("Choose a body joint")}</h2><div className="flex flex-wrap gap-2" aria-label={t("Body area")}>{(["Arms", "Legs", "Torso"] as const).map(area => <button type="button" key={area} aria-pressed={group === area} onClick={() => setGroup(area)} className={`${button} ${group === area ? "bg-primary/10 text-primary" : ""}`}>{t(area)}</button>)}</div>{group !== "Torso" && <div className="flex flex-wrap gap-2" aria-label={t("Body side")}>{(["left", "right"] as const).map(value => <button type="button" key={value} aria-pressed={side === value} onClick={() => setSide(value)} className={`${button} ${side === value ? "bg-primary/10 text-primary" : ""}`}>{t(value === "left" ? "Left" : "Right")}</button>)}</div>}<div className="flex flex-wrap gap-2">{(group === "Torso" ? ["torso"] : joints.map(joint => `${side}-${joint}`)).map(slug => <button type="button" key={slug} aria-pressed={selected === slug} onClick={() => onSelect(slug as JointSlug)} className={`${button} ${selected === slug ? "bg-primary/10 text-primary" : ""}`}>{t(slug.replaceAll("-", " "))}</button>)}</div></section>;
}
