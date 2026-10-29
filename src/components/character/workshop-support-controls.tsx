"use client";

import { supportRegions, type SupportContact, type SupportRegion } from "@/lib/motion/workshop";
import { clampSupportPoint } from "@/lib/motion/support-surfaces";
import { WorkshopNumberField } from "./workshop-number-field";
import { useWorkshopLanguage } from "./workshop-language";

export type WorkshopSupportControlsProps = {
  region: SupportRegion; contact?: SupportContact; picking: boolean; adjusting?: boolean;
  repositioning?: boolean; error?: string;
  onRegionChange: (region: SupportRegion) => void; onPick: () => void; onAdjust: () => void;
  onChange: (contact: SupportContact) => void; onRelease: () => void;
  onReposition: () => void; onConfirmReposition?: () => void; onCancel: () => void;
};

export function WorkshopSupportControls(props: WorkshopSupportControlsProps) {
  const { t } = useWorkshopLanguage();
  const { region, contact, picking, adjusting, repositioning, error } = props;
  const button = "min-h-11 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
  const label = (value: string) => t(value === "back" ? "Back of torso" : value.replaceAll("-", " ").replace(/^./, letter => letter.toUpperCase()));
  const move = (axis: "x" | "y" | "z", value: number) => {
    if (contact) props.onChange({ ...contact, point: clampSupportPoint(contact, { ...contact.point, [axis]: value }) });
  };
  return <section aria-label={t("Body support")} className="space-y-3">
    <label className="block space-y-2 text-sm font-semibold">{t("Body part")}
      <select aria-label={t("Body part")} value={region} disabled={repositioning} onChange={event => props.onRegionChange(event.target.value as SupportRegion)} className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 capitalize">
        {supportRegions.map(value => <option key={value} value={value}>{label(value)}</option>)}
      </select>
    </label>
    {repositioning ? <><p role="status" className="text-sm text-muted-foreground">{t("Previewing body position. Use it or cancel to keep the previous position.")}</p><div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={props.onConfirmReposition}>{t("Use position")}</button><button type="button" className={button} onClick={props.onCancel}>{t("Cancel")}</button></div></>
      : <><div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={props.onPick}>{t(contact ? "Change support…" : "Support on…")}</button>
        {contact && <><button type="button" aria-pressed={!!adjusting} className={button} onClick={props.onAdjust}>{t("Adjust position")}</button><button type="button" className={button} onClick={props.onReposition}>{t("Reposition body")}</button><button type="button" className={button} onClick={props.onRelease}>{t("Release")}</button></>}
        {(picking || adjusting) && <button type="button" className={button} onClick={props.onCancel}>{t("Done")}</button>}
      </div>
      <p role="status" className="text-sm text-muted-foreground">{t(picking ? "Select a highlighted surface. Hover to preview; Escape cancels." : adjusting ? "Drag the support marker along its surface. Arrow keys move it by 1 cm; Escape cancels a drag." : contact ? "This support stays anchored throughout the movement." : "Choose a surface to anchor this body part.")}</p>
      {picking && /-(hand|forearm|elbow)$/.test(region) && <p className="text-sm text-muted-foreground">{t("For self-bracing, click the torso, hip, or leg.")}</p>}
      {contact && <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-sm font-semibold">{t("Fine adjustment")}</summary><div className="mt-3 space-y-3">
        {(["x", "y", "z"] as const).filter(axis => contact.surface === "floor" ? axis !== "y" : ["seat", "pad"].includes(contact.surface) ? axis !== "z" : true).map(axis => <WorkshopNumberField key={axis} label={`Support ${axis.toUpperCase()} meters`} value={contact.point[axis]} step={.01} maximumFractionDigits={3} onChange={value => move(axis, value)} />)}
        <WorkshopNumberField label="Contact orientation degrees" value={contact.turn} min={-180} max={180} step={1} onChange={turn => props.onChange({ ...contact, turn })} />
      </div></details>}</>}
    {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
  </section>;
}
