"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { formSnapshot } from "@/lib/form-state";

export function useMetadataGuard(recoveryKey: string, restoredBaseline?: string) {
  const form = useRef<HTMLFormElement>(null);
  const baseline = useRef<string | null>(restoredBaseline ?? null);
  const dirty = useRef(false);
  const refresh = useCallback(() => {
    if (!form.current) return;
    const snapshot = formSnapshot(new FormData(form.current));
    baseline.current ??= snapshot;
    dirty.current = snapshot !== baseline.current;
    try {
      if (dirty.current) sessionStorage.setItem(recoveryKey, JSON.stringify({ baseline: baseline.current,
        values: [...new FormData(form.current).entries()].filter(([name, value]) => !name.startsWith("$ACTION_") && typeof value === "string"), updatedAt: Date.now() }));
      else sessionStorage.removeItem(recoveryKey);
    } catch { /* The unload and link guards still protect edits if storage is unavailable. */ }
  }, [recoveryKey]);
  // Also catches controlled/hidden selections changed by suggestion buttons.
  useLayoutEffect(refresh);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      refresh();
      if (dirty.current) event.preventDefault();
    };
    const navigate = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.target === "_blank" || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = new URL(anchor.href, location.href);
      if (target.pathname === location.pathname && target.search === location.search) return;
      refresh();
      if (dirty.current && !window.confirm("Your exercise details have unsaved changes. Leave without saving?")) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); };
  }, [refresh]);
  return { form, refresh };
}
