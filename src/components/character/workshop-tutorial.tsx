"use client";

import { useEffect, useId, useRef } from "react";
import { workshopTutorialSteps } from "@/lib/motion/workshop-tutorial";
import { useWorkshopLanguage } from "./workshop-language";

export function WorkshopTutorial({ step, onStep, onClose, onShowControls }: {
  step: number; onStep: (step: number) => void; onClose: () => void; onShowControls: () => void;
}) {
  const { t, formatNumber } = useWorkshopLanguage();
  const id = useId(), heading = useRef<HTMLHeadingElement>(null);
  const current = workshopTutorialSteps[step];
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [step]);
  const button = "inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40";
  return <section data-workshop-tutorial aria-label={t("Workshop tutorial")} className="scroll-mt-24 border-b border-primary/30 bg-primary/5 p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium text-muted-foreground">{t("Tutorial")} · {formatNumber(step + 1)} / {formatNumber(workshopTutorialSteps.length)}</span><button type="button" onClick={onClose} className={button}>{t("Close tutorial")}</button></div>
    <h2 id={id} ref={heading} tabIndex={-1} className="mt-2 text-lg font-semibold outline-none">{t(current.title)}</h2>
    <ul className="my-3 max-w-4xl list-disc space-y-2 ps-5 text-sm">{current.tips.map(tip => <li key={tip}>{t(tip)}</li>)}</ul>
    <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={onShowControls} className={button}>{t("Show these controls")}</button><div className="ms-auto flex gap-2"><button type="button" disabled={step === 0} onClick={() => onStep(step - 1)} className={button}>{t("Previous tip")}</button>{step < workshopTutorialSteps.length - 1 ? <button type="button" onClick={() => onStep(step + 1)} className={`${button} bg-primary text-primary-foreground`}>{t("Next tip")}</button> : <button type="button" onClick={onClose} className={`${button} bg-primary text-primary-foreground`}>{t("Finish tutorial")}</button>}</div></div>
  </section>;
}
