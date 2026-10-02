"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Star, X } from "lucide-react";
import { equipmentGroup, equipmentPreferencesKey, readEquipmentPreferences, searchWorkshopEquipment, workshopEquipmentOptions, type EquipmentOption, type EquipmentPreferences } from "@/lib/motion/quick-create";
import { studioAssetSlugs } from "@/lib/motion/workshop";
import { WorkshopEquipmentPicture } from "./workshop-equipment-picture";
import { useWorkshopLanguage } from "./workshop-language";

export type WorkshopEquipmentPickerProps = { options: EquipmentOption[]; onSelect: (slug: string) => void; onClose: () => void; ownerKey: string };
const sessionPreferences = new Map<string, string>();
const preferencesEvent = "kinevault-workshop-equipment";
const subscribe = (notify: () => void) => {
  window.addEventListener("storage", notify); window.addEventListener(preferencesEvent, notify);
  return () => { window.removeEventListener("storage", notify); window.removeEventListener(preferencesEvent, notify); };
};
const serverSnapshot = () => null;

export function WorkshopEquipmentPicker({ options, onSelect, onClose, ownerKey }: WorkshopEquipmentPickerProps) {
  const { language, t, formatNumber } = useWorkshopLanguage();
  const id = useId(), dialog = useRef<HTMLDialogElement>(null), caller = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const [storageError, setStorageError] = useState(false);
  const catalog = useMemo(() => workshopEquipmentOptions(options), [options]);
  const filtered = useMemo(() => {
    const matches = searchWorkshopEquipment(catalog, query);
    const tokens = query.trim().toLocaleLowerCase(language).split(/\s+/).filter(Boolean);
    if (!tokens.length) return matches;
    return catalog.filter(option => matches.includes(option) || tokens.every(token => t(option.label).toLocaleLowerCase(language).includes(token)));
  }, [catalog, query, language, t]);
  const key = equipmentPreferencesKey(ownerKey);
  const snapshot = useCallback(() => {
    if (sessionPreferences.has(key)) return sessionPreferences.get(key)!;
    try { return window.localStorage.getItem(key); }
    catch { return sessionPreferences.get(key) ?? null; }
  }, [key]);
  const stored = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const preferences = useMemo(() => readEquipmentPreferences(stored), [stored]);
  const writePreferences = (next: EquipmentPreferences) => {
    const text = JSON.stringify(next);
    try { window.localStorage.setItem(key, text); sessionPreferences.delete(key); setStorageError(false); }
    catch { sessionPreferences.set(key, text); setStorageError(true); }
    window.dispatchEvent(new Event(preferencesEvent));
  };
  useEffect(() => {
    caller.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); if (caller.current?.isConnected) caller.current.focus(); };
  }, []);
  const choose = (option: EquipmentOption) => {
    writePreferences({ ...preferences, recent: [option.slug, ...preferences.recent.filter(slug => slug !== option.slug)].slice(0, 6) });
    onSelect(option.slug); onClose();
  };
  const favorite = (slug: string) => writePreferences({ ...preferences, favorites: preferences.favorites.includes(slug) ? preferences.favorites.filter(item => item !== slug) : [...preferences.favorites, slug] });
  const buttonClass = "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-base font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40";
  const cards = (items: EquipmentOption[]) => <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{items.map(option => {
    const supported = studioAssetSlugs.some(slug => slug === option.slug);
    return <div key={option.slug} className="relative min-w-0 rounded-xl border border-border bg-card">
      <button type="button" onClick={() => choose(option)} disabled={!supported} className="min-h-40 w-full rounded-xl px-3 pb-14 pt-3 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50">
        <WorkshopEquipmentPicture slug={option.slug} /><span className="block text-base font-semibold">{t(option.label)}</span>
        {!supported && <span className="mt-1 block text-sm text-muted-foreground">{t("No 3D model yet. Choose another item.")}</span>}
      </button>
      {supported && <button type="button" aria-label={t("Favorite {equipment}", { equipment: option.label })} aria-pressed={preferences.favorites.includes(option.slug)} onClick={() => favorite(option.slug)} className={`${buttonClass} absolute bottom-2 end-2 border-transparent text-sm`}><Star size={18} fill={preferences.favorites.includes(option.slug) ? "currentColor" : "none"} /><span>{t("Favorite")}</span></button>}
    </div>;
  })}</div>;
  const recent = preferences.recent.flatMap(slug => filtered.find(option => option.slug === slug) ?? []);
  const favorites = preferences.favorites.flatMap(slug => filtered.find(option => option.slug === slug) ?? []);
  return <dialog ref={dialog} lang={language} dir={language === "he" ? "rtl" : "ltr"} aria-labelledby={`${id}-title`} aria-describedby={`${id}-help`} onKeyDownCapture={event => {
    // Search inputs consume Escape to clear their query before dialog cancellation.
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
  }} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }} className="m-auto max-h-[90dvh] w-[min(44rem,calc(100%-1.5rem))] overflow-y-auto rounded-2xl border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/50">
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3"><h2 id={`${id}-title`} className="text-xl font-semibold">{t("Choose equipment")}</h2><button type="button" onClick={onClose} className={buttonClass}><X aria-hidden="true" size={18} /><span>{t("Close")}</span></button></div>
      <p id={`${id}-help`} className="text-sm text-muted-foreground">{t("Choose a picture to begin. Try Cable row for a seated pull or Pec deck for a chest fly.")}</p>
      <label className="block space-y-2 text-base font-semibold"><span>{t("Search equipment")}</span><input autoFocus type="search" maxLength={160} value={query} onChange={event => setQuery(event.target.value)} placeholder={t("Try row, chest fly or dumbbell")} className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-base font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" /></label>
      <p role="status" className="text-sm text-muted-foreground">{filtered.length ? t("{count} equipment choices", { count: formatNumber(filtered.length) }) : t("No matching equipment. Try cable, bench, chest fly or hand weights.")}</p>
      {storageError && <p role="status" className="text-sm text-muted-foreground">{t("Favorites and recent choices are kept for this session. Browser storage is unavailable.")}</p>}
      {!query.trim() && !!recent.length && <section aria-label={t("Recent equipment")} className="space-y-3"><h3 className="text-base font-semibold">{t("Recent equipment")}</h3>{cards(recent)}</section>}
      {!!favorites.length && <section aria-label={t("Favorite equipment")} className="space-y-3"><h3 className="text-base font-semibold">{t("Favorites")}</h3>{cards(favorites)}</section>}
      {(["Machines", "Weights", "Supports"] as const).map(group => {
        const grouped = filtered.filter(option => equipmentGroup(option.slug) === group);
        return grouped.length ? <section key={group} aria-label={t(group)} className="space-y-3"><h3 className="text-base font-semibold">{t(group)}</h3>{cards(grouped)}</section> : null;
      })}
      {!filtered.length && <button type="button" onClick={() => setQuery("")} className={buttonClass}>{t("Show all equipment")}</button>}
    </div>
  </dialog>;
}
