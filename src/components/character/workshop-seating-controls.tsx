"use client";

import type { JointAngles, StudioObject } from "@/lib/motion/workshop";
import { seatFeetAreFree } from "@/lib/motion/seated-pose";
import { WorkshopNumberField } from "./workshop-number-field";
import { useWorkshopLanguage } from "./workshop-language";

export function WorkshopSeatingControls({ object, torso, onOffset, onTorso, onFeet, onReset }: {
  object: StudioObject; torso: JointAngles;
  onOffset: (changes: Pick<StudioObject, "seatOffsetX" | "seatOffsetZ">) => void;
  onTorso: (angles: JointAngles) => void; onFeet: (supported: boolean) => void; onReset: () => void;
}) {
  const { t } = useWorkshopLanguage();
  const centimeters = object.scale * 100;
  return <section aria-label={t("Seated position")} className="space-y-4 rounded-lg border border-border p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-base font-semibold">{t("Seated position")}</h3>
      <button type="button" onClick={onReset} className="min-h-11 rounded-lg border border-border px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{t("Reset seat")}</button>
    </div>
    <WorkshopNumberField label="Seat forward/back centimeters" min={-.12 * centimeters} max={.12 * centimeters} step={.5} maximumFractionDigits={1}
      value={(object.seatOffsetZ ?? 0) * centimeters} onChange={value => onOffset({ seatOffsetZ: value / centimeters })} />
    <WorkshopNumberField label="Seat left/right centimeters" min={-.1 * centimeters} max={.1 * centimeters} step={.5} maximumFractionDigits={1}
      value={(object.seatOffsetX ?? 0) * centimeters} onChange={value => onOffset({ seatOffsetX: value / centimeters })} />
    <WorkshopNumberField label="Torso forward/back lean degrees" min={-35} max={35} value={torso.x} onChange={x => onTorso({ ...torso, x })} />
    <WorkshopNumberField label="Torso turn degrees" min={-45} max={45} value={torso.y} onChange={y => onTorso({ ...torso, y })} />
    <WorkshopNumberField label="Torso side lean degrees" min={-30} max={30} value={torso.z} onChange={z => onTorso({ ...torso, z })} />
    {object.slug === "leg-press" ? <p className="text-sm text-muted-foreground">{t("Feet stay attached to the sled. Change sled travel to move the legs.")}</p>
      : <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={!seatFeetAreFree(object)} onChange={event => onFeet(event.target.checked)} />{t("Automatic foot support")}</label>}
    <p className="text-sm text-muted-foreground">{t("The pelvis stays supported. Adjust legs in Pose. Reset seat restores this pose's seat position and torso only.")}</p>
  </section>;
}
