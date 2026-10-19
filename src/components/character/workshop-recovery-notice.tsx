"use client";

import { useWorkshopLanguage } from "./workshop-language";

export function WorkshopRecoveryNotice({ updatedAt, hasSavedVersion, onRestore, onDismiss }: {
  updatedAt: number; hasSavedVersion: boolean; onRestore: () => void; onDismiss: () => void;
}) {
  const { t, language } = useWorkshopLanguage();
  return <section aria-label={t("Recover draft")} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
    <div className="min-w-0 flex-1">
      <h2 className="text-sm font-semibold">{t("An unfinished draft is available on this device")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("Restore it, or discard this device copy.")} <time dateTime={new Date(updatedAt).toISOString()} className="block tabular-nums">{new Date(updatedAt).toLocaleString(language)}</time></p>
    </div>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={onRestore} className="min-h-11 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{t("Restore device draft")}</button>
      <button type="button" onClick={onDismiss} className="min-h-11 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{t(hasSavedVersion ? "Continue with saved exercise" : "Continue with blank exercise")}</button>
    </div>
  </section>;
}
