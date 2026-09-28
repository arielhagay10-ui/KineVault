"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { MotionAnnotation } from "@/lib/motion/workshop";

export type MediaGroup = {
  id: string; presentation: string; angle: string | null;
  webm?: string; mp4?: string; poster?: string; license: string; credit: string | null;
};
const label = (value: string) => value.replaceAll("_", " ");

export function MediaGallery({ groups, annotations = [] }: { groups: MediaGroup[]; annotations?: MotionAnnotation[] }) {
  const [selected, setSelected] = useState(groups[0]?.id);
  const [failed, setFailed] = useState(false);
  const [timeMs, setTimeMs] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const current = groups.find((item) => item.id === selected) ?? groups[0];
  useEffect(() => {
    if (!current) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pause = () => { setAutoplay(!media.matches); if (media.matches) video.current?.pause(); };
    pause();
    media.addEventListener("change", pause);
    return () => media.removeEventListener("change", pause);
  }, [current]);
  if (!current) return <p className="rounded-2xl bg-muted p-8 text-muted-foreground">Demonstration unavailable.</p>;
  const presentations = [...new Set(groups.map((item) => item.presentation))];
  const angles = [...new Set(groups.filter((item) => item.presentation === current.presentation).map((item) => item.angle))];
  const choose = (group: MediaGroup) => { setSelected(group.id); setFailed(false); };
  return <section aria-label="Exercise demonstration">
    <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
      <video ref={video} key={current.id} autoPlay={autoplay} muted loop playsInline controls preload="metadata" poster={current.poster}
        onLoadedMetadata={(event) => { if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) event.currentTarget.pause(); }}
        onError={() => setFailed(true)} onTimeUpdate={(event) => setTimeMs(event.currentTarget.currentTime * 1000)}
        className="h-full w-full object-contain" aria-label="Exercise motion demonstration">
        {current.webm && <source src={current.webm} type="video/webm" />}
        {current.mp4 && <source src={current.mp4} type="video/mp4" />}
      </video>
    </div>
    {failed && <p role="alert" className="mt-3 text-sm text-muted-foreground">The demonstration could not be loaded. Reload to try again.</p>}
    <div className="mt-4 flex flex-wrap items-center gap-4">
      {presentations.length > 1 && <label className="text-sm">Character
        <select value={current.presentation} className="ml-2 rounded-lg border bg-card p-2 capitalize" onChange={(event) => {
          const matches = groups.filter((item) => item.presentation === event.target.value);
          choose(matches.find((item) => item.angle === current.angle) ?? matches[0]);
        }}>{presentations.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select>
      </label>}
      {angles.length > 1 && <label className="text-sm">Camera angle
        <select value={current.angle ?? ""} className="ml-2 rounded-lg border bg-card p-2 capitalize" onChange={(event) => {
          const match = groups.find((item) => item.presentation === current.presentation && (item.angle ?? "") === event.target.value);
          if (match) choose(match);
        }}>{angles.map((item) => <option key={item ?? "unspecified"} value={item ?? ""}>{item ? label(item) : "Unspecified"}</option>)}</select>
      </label>}
      <span className="text-xs capitalize text-muted-foreground">{current.presentation} · {current.angle ? label(current.angle) : "Unspecified view"}</span>
    </div>
    <p className="mt-3 text-xs leading-5 text-muted-foreground">{current.license}{current.credit && <> · {current.credit}</>}</p>
    {annotations.length > 0 && <section className="mt-5 rounded-xl border bg-card p-4"><h2 className="text-sm font-semibold">Movement notes</h2>
      <ol className="mt-3 space-y-2">{annotations.map((item, index) => <li key={index} className={`rounded-lg p-3 text-sm ${timeMs >= item.startMs && timeMs < item.endMs ? "bg-accent" : "bg-background"}`}>
        <button className="font-semibold" onClick={() => { if (video.current) video.current.currentTime = item.startMs / 1000; }}>{item.label}</button>
        <span className="ml-2 text-xs text-muted-foreground">{(item.startMs / 1000).toFixed(2)}–{(item.endMs / 1000).toFixed(2)}s</span>
        {item.note && <p className="mt-1 leading-6 text-muted-foreground">{item.note}</p>}
        {item.jointAction && <Link href={`/joint-actions/${item.jointAction}`} className="mt-2 inline-block text-xs capitalize text-primary underline">{item.jointAction.replaceAll("-", " ")}</Link>}
      </li>)}</ol>
    </section>}
  </section>;
}
