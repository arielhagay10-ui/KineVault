"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Opt-in diagnostics keep measurement work out of normal workshop sessions. */
export function WorkshopCommitMetrics({ children }: { children: ReactNode }) {
  const enabledRef = useRef(false);
  const counterRef = useRef<HTMLSpanElement>(null);
  const commitsRef = useRef(0);
  useEffect(() => { enabledRef.current = new URLSearchParams(window.location.search).get("metrics") === "1"; }, []);
  useEffect(() => {
    if (!enabledRef.current) return;
    commitsRef.current += 1;
    counterRef.current?.setAttribute("data-workshop-commits", String(commitsRef.current));
  });
  return <><span ref={counterRef} hidden />{children}</>;
}
