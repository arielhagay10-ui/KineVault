"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Expand, Minimize } from "@/components/ui/icons";
import { useWorkshopLanguage } from "./workshop-language";

export function WorkshopFullscreenButton({ target, className }: { target: RefObject<HTMLDivElement | null>; className: string }) {
  const { t } = useWorkshopLanguage();
  const [active, setActive] = useState(false);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attempt = useRef(0);
  useEffect(() => {
    const requests = attempt;
    const update = () => {
      setActive(document.fullscreenElement === target.current);
      setPending(false);
      setError(false);
      if (timer.current) clearTimeout(timer.current);
    };
    document.addEventListener("fullscreenchange", update);
    return () => {
      document.removeEventListener("fullscreenchange", update);
      if (timer.current) clearTimeout(timer.current);
      requests.current++;
    };
  }, [target]);
  const toggle = async () => {
    setError(false);
    const currentAttempt = ++attempt.current;
    const exiting = document.fullscreenElement === target.current;
    if (!target.current || (!exiting && (!target.current.requestFullscreen || document.fullscreenEnabled === false))) {
      setError(true);
      return;
    }
    setPending(true);
    // Some embedded browsers never settle the request or emit fullscreenchange.
    timer.current = setTimeout(() => {
      if (attempt.current !== currentAttempt) return;
      setPending(false);
      setActive(document.fullscreenElement === target.current);
      setError((document.fullscreenElement === target.current) !== !exiting);
    }, 2000);
    try {
      if (exiting) await document.exitFullscreen();
      else await target.current.requestFullscreen();
      if (attempt.current !== currentAttempt) return;
      setActive(document.fullscreenElement === target.current);
      setError((document.fullscreenElement === target.current) !== !exiting);
    } catch {
      if (attempt.current !== currentAttempt) return;
      setError(true);
    } finally {
      if (attempt.current === currentAttempt) {
        if (timer.current) clearTimeout(timer.current);
        setPending(false);
      }
    }
  };
  const Icon = active ? Minimize : Expand;
  return <>
    <button type="button" aria-label={t(active ? "Exit full screen" : "Full screen")} title={t(active ? "Exit full screen" : "Full screen")} aria-pressed={active} aria-busy={pending} disabled={pending} onClick={toggle} className={className}><Icon size={18} /><span className="hidden md:inline">{t(pending ? "Updating full screen…" : active ? "Exit full screen" : "Full screen")}</span></button>
    {error && <p role="alert" className="mt-2 max-w-80 text-sm">{t("This browser did not open full screen. Use F11 in your browser, or open this page in Chrome or Edge.")}</p>}
  </>;
}
