import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getIdentity } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadWorkshopScene } from "@/lib/motion/load-scene";
import { MotionInspector } from "@/components/character/motion-inspector";
import { PublicationBadge } from "@/components/catalog/publication-badge";
import { PublicModerationForm } from "@/components/submissions/public-moderation-form";

export default async function ModerateExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const identity = await getIdentity();
  if (!identity || identity.role === "user") notFound();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: exercise, error } = await supabase.from("exercises")
    .select("id,slug,current_content_id,status,verified_at,exercise_content(name,short_description)")
    .eq("id", id).in("status", ["published", "withdrawn"]).maybeSingle();
  if (error) throw new Error("The exercise could not be loaded");
  if (!exercise) notFound();
  const [priorHide, reports, openReportCount, history, scene] = await Promise.all([
    supabase.from("exercise_moderation_events").select("id", { count: "exact", head: true }).eq("exercise_id", id).eq("action", "hide"),
    supabase.from("exercise_reports").select("id,reason,status,created_at").eq("exercise_id", id)
      .order("status").order("created_at", { ascending: false }).limit(50),
    supabase.from("exercise_reports").select("id", { count: "exact", head: true }).eq("exercise_id", id).eq("status", "open"),
    supabase.from("exercise_moderation_events").select("id,action,comment,created_at").eq("exercise_id", id)
      .order("created_at", { ascending: false }).limit(30),
    loadWorkshopScene(exercise.current_content_id),
  ]);
  if ([priorHide, reports, openReportCount, history].some(result => result.error)) throw new Error("Moderation details could not be loaded");
  const openReports = openReportCount.count ?? 0;
  return <div className="space-y-7">
    <header>
      <Link href="/admin/exercises" className="text-sm font-semibold text-primary">Exercise moderation</Link>
      <h1 className="mt-4 text-3xl font-semibold">{exercise.exercise_content?.name}</h1>
      <div className="mt-3 flex items-center gap-3"><PublicationBadge verifiedAt={exercise.verified_at} /><span className="text-sm text-muted-foreground">{exercise.status === "withdrawn" ? "Hidden" : "Public"}</span></div>
      {exercise.exercise_content?.short_description && <p className="mt-3 text-sm text-muted-foreground">{exercise.exercise_content.short_description}</p>}
      {exercise.status === "published" && <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-primary">
        <Link href={`/exercises/${exercise.slug}`} className="underline">View public exercise</Link>
        <Link href={`/admin/exercises/${id}/edit`} className="underline">Review metadata</Link>
      </div>}
    </header>
    {scene && <MotionInspector scene={scene} />}
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="mb-5 text-xl font-semibold">Moderation</h2>
      <PublicModerationForm exerciseId={id} hidden={exercise.status === "withdrawn"} verified={Boolean(exercise.verified_at)} canRestore={(priorHide.count ?? 0) > 0} openReports={openReports} />
    </section>
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-xl font-semibold">Reports</h2>
      <ul className="mt-4 divide-y divide-border">{reports.data?.map(report => <li key={report.id} className="py-4">
        <p className="text-xs capitalize text-muted-foreground">{report.status} · {new Date(report.created_at).toLocaleString()}</p><p className="mt-2 whitespace-pre-wrap text-sm">{report.reason}</p>
      </li>)}</ul>{!reports.data?.length && <p className="mt-4 text-sm text-muted-foreground">No reports.</p>}
      {reports.data?.length === 50 && <p className="mt-4 text-xs text-muted-foreground">Showing 50 reports, with open reports first.</p>}
    </section>
    <section><h2 className="text-xl font-semibold">Moderation history</h2>
      <ol className="mt-4 space-y-4 text-sm">{history.data?.map(event => <li key={event.id}>
        <p className="font-semibold capitalize">{event.action.replaceAll("_", " ")} · {new Date(event.created_at).toLocaleString()}</p>{event.comment && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{event.comment}</p>}
      </li>)}</ol>
    </section>
  </div>;
}
