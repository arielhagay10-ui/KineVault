"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useWorkshopLanguage } from "./workshop-language";

export function WorkshopNameDialog({ initialName, onSave, onClose }: {
  initialName: string; onSave: (name: string) => void; onClose: () => void;
}) {
  const { language, t } = useWorkshopLanguage();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [name, setName] = useState(initialName);
  useEffect(() => {
    const caller = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current;
    // Native dialog focus reads the attribute; React autoFocus runs while hidden.
    cancel.current?.setAttribute("autofocus", "");
    element?.showModal();
    return () => { element?.close(); if (caller?.isConnected) caller.focus(); };
  }, []);
  const button = "inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40";
  return <dialog ref={dialog} lang={language} dir={language === "he" ? "rtl" : "ltr"}
    aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => {
      event.stopPropagation();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        event.currentTarget.querySelector("form")?.requestSubmit();
      }
    }}
    className="m-auto w-[min(26rem,calc(100%-1.5rem))] rounded-2xl border border-border bg-background p-6 text-foreground shadow-xl backdrop:bg-black/50">
    <form onSubmit={event => { event.preventDefault(); if (name.trim().length >= 2) onSave(name.trim()); }} className="space-y-5">
      <h2 id={`${id}-title`} className="text-xl font-semibold">{t("Name your exercise")}</h2>
      <label className="block space-y-2 text-sm font-semibold">{t("Exercise name")}
        <input value={name} onChange={event => setName(event.target.value)} required maxLength={160} autoComplete="off"
          className="min-h-11 w-full rounded-lg border border-border bg-background p-3 text-base font-normal" />
      </label>
      <div className="flex justify-end gap-2">
        <button ref={cancel} type="button" onClick={onClose} className={button}>{t("Cancel")}</button>
        <button type="submit" disabled={name.trim().length < 2} className={`${button} bg-primary text-primary-foreground`}>{t("Save exercise")}</button>
      </div>
    </form>
  </dialog>;
}
