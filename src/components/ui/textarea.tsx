"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";

// Native text editing, with a draggable thumb drawn over the field instead of a gutter.
export function Textarea(props: ComponentPropsWithoutRef<"textarea">) {
  const field = useRef<HTMLTextAreaElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const drag = useRef<{ y: number; scroll: number } | null>(null);
  const update = () => {
    const area = field.current, handle = thumb.current;
    if (!area || !handle) return;
    const height = Math.max(24, area.clientHeight ** 2 / area.scrollHeight);
    handle.hidden = area.scrollHeight <= area.clientHeight;
    handle.style.height = `${height}px`;
    handle.style.top = `${area.offsetTop + area.scrollTop / Math.max(1, area.scrollHeight - area.clientHeight) * (area.clientHeight - height)}px`;
  };
  useEffect(() => {
    const area = field.current!;
    const observer = new ResizeObserver(update);
    observer.observe(area);
    area.addEventListener("input", update);
    area.addEventListener("scroll", update);
    update();
    return () => { observer.disconnect(); area.removeEventListener("input", update); area.removeEventListener("scroll", update); };
  }, []);
  useEffect(update, [props.value, props.defaultValue]);
  return <span className="relative block">
    <textarea {...props} ref={field} className={`block ${props.className ?? ""}`} />
    <span ref={thumb} hidden aria-hidden="true" data-textarea-scrollbar className="absolute end-0 w-3 cursor-default touch-none select-none px-1"
      onPointerDown={event => {
        event.preventDefault();
        drag.current = { y: event.clientY, scroll: field.current!.scrollTop };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        const area = field.current!;
        if (drag.current) area.scrollTop = drag.current.scroll + (event.clientY - drag.current.y) * (area.scrollHeight - area.clientHeight) / Math.max(1, area.clientHeight - event.currentTarget.clientHeight);
      }}
      onPointerUp={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
      <span className="block h-full rounded-full bg-ring hover:bg-primary" />
    </span>
  </span>;
}
