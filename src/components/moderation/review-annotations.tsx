"use client";

import { useState, useTransition } from "react";
import { editAnnotations } from "@/app/admin/submissions/actions";
import { AnnotationFields } from "@/components/character/annotation-fields";
import type { WorkshopScene } from "@/lib/motion/workshop";

export function ReviewAnnotations({ submissionId, scene, actions }: {
  submissionId: string; scene: WorkshopScene; actions: { slug: string; name: string }[];
}) {
  const [annotations, setAnnotations] = useState(scene.annotations ?? []);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<{ error: string | null; message?: string } | null>(null);
  const [pending, startTransition] = useTransition();
  return <form className="space-y-4 rounded-2xl border bg-card p-5" onSubmit={(event) => {
    event.preventDefault(); startTransition(async () => setStatus(await editAnnotations(submissionId, annotations, comment)));
  }}>
    <AnnotationFields annotations={annotations} durationMs={scene.durationMs} actions={actions} onChange={setAnnotations} />
    <label className="block text-sm font-semibold">Reason for note corrections<textarea required minLength={5} maxLength={2000}
      value={comment} onChange={(event) => setComment(event.target.value)} className="mt-2 w-full rounded-xl border bg-card p-3" /></label>
    <button disabled={pending} className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">{pending ? "Saving…" : "Save movement notes"}</button>
    {status && <p role={status.error ? "alert" : "status"} className="text-sm">{status.error ?? status.message}</p>}
  </form>;
}
