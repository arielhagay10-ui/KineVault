"use client";

import { WorkshopGuidance } from "./workshop-guidance";

import { useEffect, useState } from "react";
import type { WorkshopScene } from "@/lib/motion/workshop";
import { applyWorkshopSetup, captureWorkshopSetup, readWorkshopSetups, workshopSetupKey, type WorkshopSetup } from "@/lib/motion/workshop-setups";
import { useWorkshopLanguage } from "./workshop-language";

export function WorkshopSetups({ ownerId, scene, onApply, expanded = false }: { ownerId: string; scene: WorkshopScene; onApply: (scene: WorkshopScene) => void; expanded?: boolean }) {
  const { t } = useWorkshopLanguage();
  const [setups, setSetups] = useState<WorkshopSetup[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const key = workshopSetupKey(ownerId);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try { setSetups(readWorkshopSetups(localStorage.getItem(key))); setReady(true); }
      catch { setMessage("Equipment setups are unavailable on this device."); }
    });
    return () => cancelAnimationFrame(frame);
  }, [key]);
  const persist = (next: WorkshopSetup[]) => {
    try { localStorage.setItem(key, JSON.stringify(next)); setSetups(next); setMessage("Equipment setups saved on this device."); return true; }
    catch { setMessage("Could not save equipment setups. Your scene is unchanged."); return false; }
  };
  return (<details open={expanded} className="rounded-lg border p-3">
    <summary className="cursor-pointer font-semibold">{t("Personal equipment setups")}</summary>
    <div className="mt-3 space-y-3">
      <WorkshopGuidance className="text-sm text-muted-foreground">{t("Save placement, contacts, pulley height and camera on this device. Applying replaces equipment and body placement, keeps your poses and duration, and can be undone. Check contacts before saving.")}</WorkshopGuidance>
      <form onSubmit={event => {
        event.preventDefault();
        try { if (persist([...setups, captureWorkshopSetup(scene, name, crypto.randomUUID())])) setName(""); }
        catch { setMessage("Enter a setup name of 1 to 60 characters and check the scene."); }
      }} className="space-y-2">
        <label className="block text-sm">{t("Setup name")}<input required maxLength={60} value={name} onChange={event => setName(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border bg-background p-2" /></label>
        <button type="submit" disabled={!ready || setups.length >= 12} className="min-h-11 rounded-lg border px-3">{t("Save equipment setup")}</button>
      </form>
      {setups.length >= 12 && <p className="text-sm">{t("Remove a setup before saving another. Limit: 12.")}</p>}
      <ul className="space-y-2">{setups.map(setup => <li key={setup.id} className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => { onApply(applyWorkshopSetup(scene, setup)); setMessage(`Applied ${setup.name}. Undo restores the previous setup.`); }} className="min-h-11 flex-1 rounded-lg border px-3 text-start" data-workshop-translate="false">{setup.name}</button>
        <button type="button" aria-label={t(`Remove setup ${setup.name}`)} onClick={() => persist(setups.filter(item => item.id !== setup.id))} className="min-h-11 rounded-lg border px-3">{t("Remove")}</button>
      </li>)}</ul>
      {message && <p role="status" className="text-sm">{t(message)}</p>}
    </div>
  </details>);
}
