"use client";

import { useEffect } from "react";
import { ClickScrollPlugin, OverlayScrollbars as initialize, type OverlayScrollbars as ScrollbarInstance } from "overlayscrollbars";

initialize.plugin(ClickScrollPlugin);

export function OverlayScrollbars() {
  useEffect(() => {
    const instances = new Map<HTMLElement, ScrollbarInstance>();
    const pending = new Set<HTMLElement>();
    let frame = 0;
    const initializePending = () => {
      frame = 0;
      for (const [element, instance] of instances) {
        if (!element.isConnected) { instance.destroy(); instances.delete(element); }
      }
      for (const element of pending) {
        if (!element.isConnected || element === document.documentElement || element instanceof HTMLTextAreaElement || instances.has(element)) continue;
        // Reparenting an open dialog removes it from WebKit's native modal layer.
        if (element.querySelector("dialog[open]")) continue;
        const style = getComputedStyle(element);
        if (element !== document.body && !/auto|scroll/.test(`${style.overflowX} ${style.overflowY}`)) continue;
        const originalPosition = element.style.position;
        // The library's unlayered CSS would otherwise override fixed/sticky utilities.
        if (style.position !== "static") element.style.position = style.position;
        instances.set(element, initialize({ target: element, elements: { viewport: element } }, {
          scrollbars: { theme: "os-theme-kinevault", autoHide: "scroll", autoHideDelay: 900, clickScroll: true },
          // Body scroll locking is temporary while the workshop or a dialog is open.
          overflow: { x: element !== document.body && style.overflowX === "hidden" ? "hidden" : "scroll", y: element !== document.body && style.overflowY === "hidden" ? "hidden" : "scroll" },
        }, { destroyed: () => { element.style.position = originalPosition; } }));
      }
      pending.clear();
    };
    // Interaction hydrates the touched React boundary. Initialize on the next frame,
    // rather than altering streamed children before React takes ownership of them.
    const onInteraction = (event: Event) => {
      for (const element of event.composedPath()) {
        if (element instanceof HTMLElement && !element.closest(".os-scrollbar")) pending.add(element);
      }
      if (!frame) frame = requestAnimationFrame(initializePending);
    };
    pending.add(document.body);
    initializePending();
    document.addEventListener("pointerover", onInteraction, { passive: true });
    document.addEventListener("focusin", onInteraction);
    document.addEventListener("scroll", onInteraction, { passive: true, capture: true });
    const onResize = () => {
      // Rebuilding ancestors can exit fullscreen or remove native dialog modality.
      if (document.fullscreenElement || document.querySelector("dialog[open]")) {
        instances.forEach(instance => instance.update(true));
        return;
      }
      for (const [element, instance] of instances) { instance.destroy(); pending.add(element); }
      instances.clear();
      if (!frame) frame = requestAnimationFrame(initializePending);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerover", onInteraction);
      document.removeEventListener("focusin", onInteraction);
      document.removeEventListener("scroll", onInteraction, true);
      window.removeEventListener("resize", onResize);
      instances.forEach(instance => instance.destroy());
    };
  }, []);
  return null;
}
