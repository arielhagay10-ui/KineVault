"use client";
import { useState } from "react";
import type { JointSlug } from "@/lib/motion/workshop";
import { useWorkshopLanguage } from "./workshop-language";
const button = "min-h-11 rounded-lg border px-3 py-2 text-base";
export function WorkshopJointPicker({ selected, onSelect }: { selected: JointSlug | null; onSelect: (joint: JointSlug) => void }) {
  const { t } = useWorkshopLanguage();
  const [group, setGroup] = useState<"Arms" | "Legs" | "Torso">("Arms");
  const [side, setSide] = useState<"left" | "right">("left");
  const joints = group === "Arms" ? ["shoulder", "elbow", "wrist"] : group === "Legs" ? ["hip", "knee", "ankle"] : [];
  return <section className="space-y-3"><h2 className="font-semibold">{t("Choose a body joint")}</h2><div className="flex flex-wrap gap-2" aria-label={t("Body area")}>{(["Arms", "Legs", "Torso"] as const).map(area => <button type="button" key={area} aria-pressed={group === area} onClick={() => setGroup(area)} className={`${button} ${group === area ? "bg-primary/10 text-primary" : ""}`}>{t(area)}</button>)}</div>{group !== "Torso" && <div className="flex flex-wrap gap-2" aria-label={t("Body side")}>{(["left", "right"] as const).map(value => <button type="button" key={value} aria-pressed={side === value} onClick={() => setSide(value)} className={`${button} ${side === value ? "bg-primary/10 text-primary" : ""}`}>{t(value === "left" ? "Left" : "Right")}</button>)}</div>}<div className="flex flex-wrap gap-2">{(group === "Torso" ? ["torso"] : joints.map(joint => `${side}-${joint}`)).map(slug => <button type="button" key={slug} aria-pressed={selected === slug} onClick={() => onSelect(slug as JointSlug)} className={`${button} ${selected === slug ? "bg-primary/10 text-primary" : ""}`}>{t(slug.replaceAll("-", " "))}</button>)}</div></section>;
}
