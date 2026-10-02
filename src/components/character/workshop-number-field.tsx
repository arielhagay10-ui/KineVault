"use client";

import { useId, useState } from "react";
import { incrementWorkshopNumber } from "@/lib/motion/workshop-number";
import { parseLocalizedWorkshopNumber } from "@/lib/motion/workshop-language";
import { useWorkshopLanguage } from "./workshop-language";

export type WorkshopNumberFieldProps = { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; disabled?: boolean };

export function WorkshopNumberField({ label, value, onChange, min, max, step = 1, disabled = false }: WorkshopNumberFieldProps) {
  const id = useId();
  const { t, formatNumber } = useWorkshopLanguage();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const text = draft ?? formatNumber(value, { useGrouping: false, maximumFractionDigits: 12 });
  const increment = Number.isFinite(step) && step > 0 ? step : 1;
  const parsed = parseLocalizedWorkshopNumber(text, min, max);
  const base = parsed ?? value;
  const commit = () => {
    if (parsed === null) {
      setError(min !== undefined && max !== undefined ? t("Enter a number from {min} to {max}.", { min, max }) : min !== undefined ? t("Enter a number of {min} or more.", { min }) : max !== undefined ? t("Enter a number of {max} or less.", { max }) : t("Enter a valid number."));
      return;
    }
    if (parsed !== value) onChange(parsed);
    setDraft(null); setError(null);
  };
  const adjust = (direction: number) => {
    const next = incrementWorkshopNumber(base, increment * direction, min, max);
    setDraft(null); setError(null);
    if (next !== value) onChange(next);
  };
  const buttonClass = "min-h-11 min-w-11 rounded-lg border border-border bg-background text-lg font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40";
  return <div className="min-w-0 space-y-1.5">
    <label htmlFor={id} className="block text-base font-semibold">{t(label)}</label>
    <div className="flex min-w-0 items-center gap-2">
      <button type="button" disabled={disabled || min !== undefined && base <= min} aria-label={t("Decrease {label} by {increment}", { label: t(label), increment })} className={buttonClass} onClick={() => adjust(-1)}>−</button>
      <input id={id} type="text" inputMode="decimal" dir="ltr" value={text} disabled={disabled} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
        onChange={event => { setDraft(event.target.value); setError(null); }} onBlur={commit}
        onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); commit(); } }}
        className="min-h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-base tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40" />
      <button type="button" disabled={disabled || max !== undefined && base >= max} aria-label={t("Increase {label} by {increment}", { label: t(label), increment })} className={buttonClass} onClick={() => adjust(1)}>+</button>
    </div>
    {error && <p id={`${id}-error`} role="status" className="text-sm text-destructive">{error}</p>}
  </div>;
}
