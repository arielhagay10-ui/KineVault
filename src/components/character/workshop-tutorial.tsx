"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { workshopTutorialSteps } from "@/lib/motion/workshop-tutorial";
import { placeTutorialMascot, type TutorialBox, type TutorialMascotPlacement } from "@/lib/motion/tutorial-placement";
import { useWorkshopLanguage } from "./workshop-language";
import { ArrowRight, Check, X } from "@/components/ui/icons";
import "./workshop-tutorial.css";

type TutorialLayout = { target: TutorialBox; mascot: TutorialMascotPlacement | null };

function revealTutorialTarget(container: HTMLElement, target: HTMLElement, playback: boolean) {
  target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
  if (window.innerWidth < 768 && !playback) {
    const preview = container.querySelector<HTMLElement>("[data-workshop-preview]");
    container.scrollTop += target.getBoundingClientRect().top - (preview?.getBoundingClientRect().bottom ?? 0) - 16;
  }
}

export function WorkshopTutorial({ step, root, onStep, onClose }: {
  step: number; root: RefObject<HTMLDivElement | null>; onStep: (step: number) => void; onClose: () => void;
}) {
  const { t, formatNumber, language } = useWorkshopLanguage();
  const id = useId(), card = useRef<HTMLDivElement>(null), heading = useRef<HTMLHeadingElement>(null), tips = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<TutorialLayout | null>(null);
  const [ready, setReady] = useState(false);
  const current = workshopTutorialSteps[step];
  const targetVisible = !!layout;

  useEffect(() => { tips.current?.scrollTo({ top: 0, behavior: "instant" }); }, [step, targetVisible, language]);

  useEffect(() => {
    const container = root.current;
    if (!container) return;
    let frame = 0, target: HTMLElement | null = null, revealed = false;
    const resize = new ResizeObserver(() => schedule());
    const measure = () => {
      frame = 0;
      setReady(true);
      const figurePreview = container.querySelector<HTMLElement>("[data-workshop-figure-preview]");
      if (window.innerWidth >= 1024 && figurePreview?.getClientRects().length && card.current) {
        const preview = figurePreview.getBoundingClientRect();
        const width = Math.min(352, Math.max(288, preview.width / 2 - 64));
        const height = card.current.getBoundingClientRect().height;
        card.current.style.setProperty("--tutorial-card-width", `${width}px`);
        card.current.style.setProperty("--tutorial-card-left", `${preview.right - width - 64}px`);
        card.current.style.setProperty("--tutorial-card-top", `${Math.min(window.innerHeight - height - 12, preview.top + Math.max(56, (preview.height - height) / 2))}px`);
      }
      const next = container.querySelector<HTMLElement>(`[data-tutorial-target="${current.target}"]`);
      if (next !== target) {
        if (target) { target.removeAttribute("data-tutorial-active"); resize.unobserve(target); }
        target = next;
        if (target) { target.setAttribute("data-tutorial-active", "true"); resize.observe(target); }
      }
      if (!target || !target.getClientRects().length || !card.current) {
        setLayout(previous => previous === null ? previous : null);
        return;
      }
      if (!revealed) {
        revealed = true;
        revealTutorialTarget(container, target, current.target === "playback");
        heading.current?.focus({ preventScroll: true });
      }
      const bounds = target.getBoundingClientRect(), panel = card.current.getBoundingClientRect();
      let left = Math.max(0, bounds.left - 5), top = Math.max(0, bounds.top - 5);
      let right = Math.min(window.innerWidth, bounds.right + 5), bottom = Math.min(window.innerHeight, bounds.bottom + 5);
      // A spotlight must not reveal content clipped by a scrolling editor or sticky preview.
      for (let ancestor = target.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor), clip = ancestor.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { left = Math.max(left, clip.left); right = Math.min(right, clip.right); }
        if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom); }
        if (ancestor === container) break;
      }
      if (window.innerWidth < 768 && target.closest("[data-workshop-controls-scroll]")) {
        const preview = container.querySelector<HTMLElement>("[data-workshop-preview]");
        if (preview) top = Math.max(top, preview.getBoundingClientRect().bottom);
      }
      if (right <= left || bottom <= top) { setLayout(previous => previous === null ? previous : null); return; }
      const box = { left, top, width: right - left, height: bottom - top };
      const size = window.innerWidth < 768 ? 96 : 128;
      const editor = container.getBoundingClientRect();
      const mascot = placeTutorialMascot(box, { width: size, height: size }, { width: window.innerWidth, height: Math.min(window.innerHeight, editor.bottom) }, { left: panel.left, top: panel.top, width: panel.width, height: panel.height });
      const value = { target: box, mascot };
      setLayout(previous => JSON.stringify(previous) === JSON.stringify(value) ? previous : value);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    resize.observe(container);
    for (const selector of ["[data-workshop-preview]", "[data-workshop-figure-preview]", "[data-workshop-controls-scroll]"]) {
      const section = container.querySelector(selector);
      if (section) resize.observe(section);
    }
    if (card.current) resize.observe(card.current);
    const mutation = new MutationObserver(schedule);
    mutation.observe(container, { childList: true, subtree: true });
    const reposition = () => { revealed = false; schedule(); };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", schedule, true);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect(); mutation.disconnect();
      target?.removeAttribute("data-tutorial-active");
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [current.target, root, language]);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) { event.preventDefault(); onClose(); }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [onClose]);

  const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40";
  const target = layout?.target, mascot = layout?.mascot;
  return <div className="pointer-events-none fixed inset-0 z-[90]" dir={language === "he" ? "rtl" : "ltr"} lang={language}>
    <svg data-tutorial-dimmer aria-hidden="true" className="absolute inset-0 h-full w-full">
      <defs><mask id={`${id}-spotlight`}><rect width="100%" height="100%" fill="white" />{target && <rect x={target.left} y={target.top} width={target.width} height={target.height} rx="12" fill="black" />}</mask></defs>
      <rect width="100%" height="100%" fill="rgb(10 20 30 / 60%)" mask={`url(#${id}-spotlight)`} />
    </svg>
    {target && <div aria-hidden="true" data-tutorial-spotlight className="fixed rounded-xl border-2 border-primary" style={{ left: target.left, top: target.top, width: target.width, height: target.height }} />}
    {mascot && <div aria-hidden="true" data-tutorial-pointer data-tutorial-direction={mascot.direction} className="workshop-tutorial-mascot fixed left-0 top-0" style={{ width: mascot.width, height: mascot.height, transform: `translate3d(${mascot.left}px, ${mascot.top}px, 0)` }}>
      <Image src={`/tutorial/kine-pointing-${mascot.direction}.webp`} alt="" width={128} height={128} className="h-full w-full object-contain" loading="eager" />
    </div>}
    <div ref={card} role="dialog" aria-modal="false" data-workshop-tutorial aria-label={t("Workshop tutorial")} aria-describedby={`${id}-tips`}
      className="workshop-tutorial-card pointer-events-auto fixed rounded-2xl bg-card p-4 text-foreground shadow-xl"
      style={{ visibility: ready ? "visible" : "hidden" }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Image src={`/tutorial/kine-${step === 3 ? "review" : "welcome"}.webp`} alt="" width={28} height={28} className="h-7 w-7 shrink-0 object-contain" />
          <span className="text-xs font-semibold text-primary">{step === 0 ? t("Hi, I'm Kine. Let's make a movement.") : t("Try it as we go.")}</span>
        </div>
        <button type="button" onClick={onClose} aria-label={t("Close tutorial")} className={`${button} shrink-0 px-3`}><X size={16} /></button>
      </div>
      <h2 id={id} ref={heading} tabIndex={-1} className="text-base font-semibold leading-5 outline-none">{t(current.title)}</h2>
      <div ref={tips} id={`${id}-tips`} className="min-h-0 space-y-2 overflow-y-auto text-sm leading-5 text-muted-foreground">{current.tips.map(tip => <p key={tip}>{t(tip)}</p>)}{!layout && <button type="button" onClick={() => {
        onStep(step);
        requestAnimationFrame(() => {
          const container = root.current;
          const target = container?.querySelector<HTMLElement>(`[data-tutorial-target="${current.target}"]`);
          if (container && target) revealTutorialTarget(container, target, current.target === "playback");
        });
      }} className={`${button} border border-border text-foreground`}>{t("Return to this tip")}</button>}</div>
      <div className="flex items-center justify-between gap-2 border-t border-border pt-1">
        <button type="button" disabled={step === 0} onClick={() => onStep(step - 1)} className={button}>{t("Previous tip")}</button>
        <span aria-label={t("Tutorial progress")} className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatNumber(step + 1)} / {formatNumber(workshopTutorialSteps.length)}</span>
        {step < workshopTutorialSteps.length - 1 ? <button type="button" onClick={() => onStep(step + 1)} className={`${button} bg-primary text-primary-foreground hover:bg-primary/90`}>{t("Next tip")}<ArrowRight size={14} className="rtl:rotate-180" /></button> : <button type="button" onClick={onClose} className={`${button} bg-primary text-primary-foreground hover:bg-primary/90`}>{t("Finish tutorial")}<Check size={14} /></button>}
      </div>
    </div>
  </div>;
}
