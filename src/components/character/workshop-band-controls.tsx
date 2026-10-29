"use client";

import { defaultBand } from "@/lib/motion/studio-band";
import { bandAnchorTargets, type BandAnchor, type StudioObject } from "@/lib/motion/workshop";
import { WorkshopNumberField } from "./workshop-number-field";
import { useWorkshopLanguage } from "./workshop-language";

const targetLabels: Record<BandAnchor["target"], string> = {
  fixed: "Fixed point", equipment: "Equipment", "left-hand": "Left hand", "right-hand": "Right hand",
  "left-foot": "Left foot", "right-foot": "Right foot", pelvis: "Pelvis",
};

export function WorkshopBandControls({ object, objects, onChange, disabled }: {
  object: StudioObject; objects: StudioObject[]; onChange: (band: NonNullable<StudioObject["band"]>) => void; disabled: boolean;
}) {
  const { t } = useWorkshopLanguage();
  const band = object.band ?? defaultBand();
  const equipment = objects.filter(item => item.id !== object.id && item.slug !== "resistance-band");
  const inputClass = "mt-1 min-h-11 w-full min-w-0 rounded-lg border border-border bg-background p-2 text-base font-normal";
  return <fieldset disabled={disabled} className="space-y-4">
    <legend className="mb-2 text-base font-semibold">{t("Band anchors")}</legend>
    <p className="text-sm text-muted-foreground">{t("Anchor either end to a hand, foot, hips or equipment. Pose the figure freely; the band follows without pulling the body.")}</p>
    {(["start", "end"] as const).map(end => {
      const anchor = band[end], label = end === "start" ? "Band start" : "Band end";
      const change = (next: BandAnchor) => onChange({ ...band, [end]: next });
      return <fieldset key={end} className="space-y-2 rounded-lg border p-3">
        <legend className="px-1 text-sm font-semibold">{t(label)}</legend>
        <label className="block text-sm">{t("Attach to")}<select aria-label={t(`${label} attachment`)} value={anchor.target} className={inputClass} onChange={event => {
          const target = event.target.value as BandAnchor["target"];
          const point = target.endsWith("hand") ? { x: target.startsWith("left") ? .03 : -.03, y: -.15, z: .13 }
            : target.endsWith("foot") ? { x: 0, y: -.08, z: .15 } : { x: 0, y: 0, z: 0 };
          change({ target, point, ...(target === "equipment" ? { objectId: equipment[0].id } : {}) });
        }}>{bandAnchorTargets.map(target => <option key={target} value={target} disabled={target === "equipment" && !equipment.length}>{t(targetLabels[target])}</option>)}</select></label>
        {anchor.target === "equipment" && <label className="block text-sm">{t("Equipment")}<select aria-label={t(`${label} equipment`)} value={anchor.objectId ?? ""} className={inputClass} onChange={event => change({ ...anchor, objectId: event.target.value })}>{equipment.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        <p className="text-xs text-muted-foreground">{t("Coordinates are relative to the selected anchor. Fixed points move with the band item.")}</p>
        <div className="space-y-3">{(["x", "y", "z"] as const).map(axis => <WorkshopNumberField key={axis} label={t(`${label} ${axis.toUpperCase()} meters`)} min={-10} max={10} step={.025} value={anchor.point[axis]} onChange={value => change({ ...anchor, point: { ...anchor.point, [axis]: value } })} />)}</div>
      </fieldset>;
    })}
    <WorkshopNumberField label={t("Band resting span meters")} min={.2} max={6} step={.05} value={band.length} onChange={length => onChange({ ...band, length })} />
    <p className="text-xs text-muted-foreground">{t("Extra length adds slack. Stretching thins the loop. This is a visual band, without force simulation.")}</p>
  </fieldset>;
}
