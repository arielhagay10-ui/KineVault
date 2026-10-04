"use client";

import { useWorkshopLanguage } from "./workshop-language";

const shortcuts = [
  ["Undo", "Ctrl / ⌘ + Z"],
  ["Redo", "Ctrl / ⌘ + Shift + Z · Ctrl + Y"],
  ["Save scene", "Ctrl / ⌘ + S"],
  ["Duplicate selected equipment", "Ctrl / ⌘ + D"],
  ["Remove selected equipment", "Backspace / Delete"],
  ["Play / pause", "Space"],
  ["Previous / next pose", "[ / ]"],
  ["Move with mouse / Camera", "E / C"],
  ["Show shortcuts", "?"],
  ["Return to camera / Close shortcuts", "Escape"],
];

export function WorkshopShortcutGuide() {
  const { t } = useWorkshopLanguage();
  return <section aria-label={t("Keyboard shortcuts")} className="space-y-3">
    <h3 className="font-semibold">{t("Keyboard shortcuts")}</h3>
    <dl className="grid gap-x-6 sm:grid-cols-2">{shortcuts.map(([action, keys]) => <div key={action} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-2">
      <dt>{t(action)}</dt><dd><kbd dir="ltr" className="inline-block rounded border border-border bg-muted px-2 py-1 font-mono text-xs">{keys}</kbd></dd>
    </div>)}</dl>
    <p className="text-muted-foreground">{t("Click the preview or focus the workshop to use playback and pose shortcuts. Text fields keep their own Undo. Space still activates focused buttons; arrows still adjust sliders and handles.")}</p>
  </section>;
}
