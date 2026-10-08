"use client";


import { Textarea } from "@/components/ui/textarea";
import type { MotionAnnotation } from "@/lib/motion/workshop";

export function AnnotationFields({ annotations, durationMs, actions, onChange }: {
  annotations: MotionAnnotation[]; durationMs: number; actions: { slug: string; name: string }[];
  onChange: (value: MotionAnnotation[]) => void;
}) {
  const input = "mt-1 w-full rounded-lg border bg-card p-2 text-sm";
  const change = (index: number, patch: Partial<MotionAnnotation>) => onChange(annotations.map((item, at) => at === index ? { ...item, ...patch } : item));
  return <fieldset className="space-y-4"><legend className="text-lg font-semibold">Timed movement notes</legend>
    <p className="text-xs leading-5 text-muted-foreground">Label setup, phases, or cues. Link actions from this exercise’s classifications. These notes are reviewed before publication.</p>
    {annotations.map((item, index) => <fieldset key={index} className="space-y-3 rounded-xl border p-3">
      <legend className="px-1 text-xs font-semibold">Note {index + 1}</legend>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs">Start (seconds)<input type="number" min={0} max={durationMs / 1000} step={0.01} value={item.startMs / 1000}
          onChange={(event) => change(index, { startMs: Math.round(Number(event.target.value) * 1000) })} className={input} /></label>
        <label className="text-xs">End (seconds)<input type="number" min={0} max={durationMs / 1000} step={0.01} value={item.endMs / 1000}
          onChange={(event) => change(index, { endMs: Math.round(Number(event.target.value) * 1000) })} className={input} /></label>
      </div>
      <label className="block text-xs">Label<input value={item.label} maxLength={80} onChange={(event) => change(index, { label: event.target.value })} className={input} /></label>
      <label className="block text-xs">Joint action<select value={item.jointAction ?? ""} onChange={(event) => change(index, { jointAction: event.target.value || null })} className={input}>
        <option value="">General movement note</option>{actions.map((action) => <option key={action.slug} value={action.slug}>{action.name}</option>)}
      </select></label>
      <label className="block text-xs">Explanation<Textarea value={item.note ?? ""} maxLength={500} rows={2} onChange={(event) => change(index, { note: event.target.value || null })} className={input} /></label>
      <button type="button" onClick={() => onChange(annotations.filter((_, at) => at !== index))} className="text-xs font-semibold text-destructive">Remove note {index + 1}</button>
    </fieldset>)}
    <button type="button" disabled={annotations.length >= 24} onClick={() => onChange([...annotations, {
      startMs: 0, endMs: durationMs, label: "Movement cue", note: null, jointAction: null,
    }])} className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">Add timed note</button>
  </fieldset>;
}
