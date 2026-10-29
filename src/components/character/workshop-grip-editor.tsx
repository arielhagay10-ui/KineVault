"use client";

import type { GripSide } from "@/lib/motion/grip-edit";
import type { ScenePoint, StudioObject } from "@/lib/motion/workshop";
import { WorkshopNumberField } from "./workshop-number-field";
import { useWorkshopLanguage } from "./workshop-language";

export function WorkshopGripEditor({ object, side, picking, disabled, onEdit, onPick, onChange }: {
  object: StudioObject; side: GripSide; picking: boolean; disabled: boolean;
  onEdit: (side: GripSide) => void; onPick: () => void; onChange: (side: GripSide, point: ScenePoint | null) => void;
}) {
  const { t } = useWorkshopLanguage();
  const point = object.gripOffsets?.[side] ?? { x: 0, y: 0, z: 0 };
  const buttonClass = "min-h-11 rounded-lg border border-border px-3 py-2 text-base font-semibold disabled:opacity-40 aria-pressed:border-primary aria-pressed:bg-primary/10";
  return <fieldset disabled={disabled} className="mt-4 space-y-3 rounded-xl border border-border p-3">
    <legend className="px-1 font-semibold">{t("Grip edit")}</legend>
    <p className="text-sm text-muted-foreground">{t("Choose where each hand touches this item. Changes apply throughout the movement.")}</p>
    {!object.machineUse && ![side, "both"].includes(object.attachment) && <p className="text-xs text-muted-foreground">{t("Attach this hand or use the machine to preview this grip.")}</p>}
    <div className="grid grid-cols-2 gap-2">{(["left", "right"] as const).map(hand => <button type="button" key={hand} aria-pressed={side === hand} onClick={() => onEdit(hand)} className={buttonClass}>
      {t("Edit {side} grip", { side: hand })}<span className="block text-xs font-normal">{object.gripOffsets?.[hand] ? t("Custom") : t("Automatic")}</span>
    </button>)}</div>
    <button type="button" aria-pressed={picking} onClick={onPick} className={`${buttonClass} w-full`}>{picking ? t("Cancel point selection") : t("Choose point on equipment")}</button>
    {picking && <p role="status" className="text-sm font-medium text-primary">{t("Click the equipment or its attachment in the preview to place this grip.")}</p>}
    <p className="text-xs text-muted-foreground">{t(object.slug === "row-machine" || object.slug === "shoulder-press-machine" ? "Fine adjustment follows the moving handle's X, Y and Z axes." : "Fine adjustment · centimeters from the automatic grip, along the item's own X, Y and Z axes.")}</p>
    <div className="space-y-3">{(["x", "y", "z"] as const).map(axis => <WorkshopNumberField key={`${object.id}-${side}-${axis}`} label={t("Grip {axis} centimeters", { axis: axis.toUpperCase() })}
      value={Number((point[axis] * 100).toFixed(3))} min={-200} max={200} step={.5} onChange={value => onChange(side, { ...point, [axis]: value / 100 })} />)}</div>
    <button type="button" disabled={!object.gripOffsets?.[side]} onClick={() => onChange(side, null)} className={buttonClass}>{t("Reset {side} grip to automatic", { side })}</button>
  </fieldset>;
}
