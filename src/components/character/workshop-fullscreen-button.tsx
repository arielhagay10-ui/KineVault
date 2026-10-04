"use client";

import { useEffect, useState, type RefObject } from "react";
import { Expand, Minimize } from "lucide-react";
import { useWorkshopLanguage } from "./workshop-language";

export function WorkshopFullscreenButton({ target, className }: { target: RefObject<HTMLDivElement | null>; className: string }) {
  const { t } = useWorkshopLanguage();
  const [active, setActive] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const update = () => setActive(document.fullscreenElement === target.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, [target]);
  const toggle = async () => {
    setError(false);
    try {
      if (document.fullscreenElement === target.current) await document.exitFullscreen();
      else await target.current?.requestFullscreen();
    } catch { setError(true); }
  };
  const Icon = active ? Minimize : Expand;
  return <>
    <button type="button" aria-label={t(active ? "Exit full screen" : "Full screen")} title={t(active ? "Exit full screen" : "Full screen")} aria-pressed={active} onClick={toggle} className={className}><Icon size={18} /><span className="hidden md:inline">{t(active ? "Exit full screen" : "Full screen")}</span></button>
    {error && <p role="alert" className="text-sm">{t("Full screen is unavailable in this browser.")}</p>}
  </>;
}
