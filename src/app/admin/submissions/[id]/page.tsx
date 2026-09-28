import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { SharedMotion } from "@/components/character/shared-motion";
import { ReviewComparison } from "@/components/moderation/review-comparison";
import { ReviewDecisions } from "@/components/moderation/review-decisions";
import { ReviewEditor } from "@/components/moderation/review-editor";
import { ReviewAnnotations } from "@/components/moderation/review-annotations";
import { getIdentity } from "@/lib/auth";
import { loadPrivateRenderMedia } from "@/lib/media/private-media";
import { loadReviewContent, loadReviewOptions } from "@/lib/moderation/content";
import { formatReviewValue, humanLabel, reviewFieldLabels, type ReviewField } from "@/lib/moderation/schema";
import { loadWorkshopScene } from "@/lib/motion/load-scene";
import { createClient } from "@/lib/supabase/server";

export default async function SubmissionReviewPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const query = await searchParams;
  const identity = await getIdentity();
  const supabase = await createClient();
  const { data: submission } = await supabase.from("exercise_submissions").select("*").eq("id", id).maybeSingle();
  if (!submission) notFound();
  const search = typeof query.q === "string" ? query.q.trim().slice(0, 100) : "";
  const [original, editorial, options, duplicates, scene, media, events, suggestions, profile, searchResults, prior] = await Promise.all([
    loadReviewContent(submission.original_content_id),
    submission.editorial_content_id ? loadReviewContent(submission.editorial_content_id) : null,
    loadReviewOptions(), supabase.rpc("find_submission_duplicates", { p_submission_id: id }),
    loadWorkshopScene(submission.original_content_id), loadPrivateRenderMedia(submission.original_content_id),
    supabase.from("moderation_events").select("id,action,reason,comment,created_at,moderation_field_changes(field_name,before_value,after_value)").eq("submission_id", id).order("created_at"),
    supabase.from("taxonomy_suggestions").select("taxonomy_name,suggested_name,explanation").eq("submission_id", id),
    supabase.from("profiles").select("display_name").eq("user_id", submission.owner_id).maybeSingle(),
    search ? supabase.rpc("explore_exercises", { search_text: search, page_size: 12 }) : { data: [], error: null },
    submission.revision_of_id ? supabase.from("exercise_submissions").select("original_content_id").eq("id", submission.revision_of_id).maybeSingle() : { data: null },
  ]);
  if (!original) notFound();
  if (duplicates.error || events.error || suggestions.error || searchResults.error) throw new Error("The review comparison could not be loaded");
  const { data: familyVariations, error: familyError } = original.family
    ? await supabase.from("exercises").select("id,slug,exercise_content!inner(name,exercise_families!inner(slug))")
      .eq("status", "published").eq("exercise_content.exercise_families.slug", original.family)
      .order("slug").limit(20)
    : { data: [], error: null };
  if (familyError) throw new Error("The existing family variations could not be loaded");
  const { data: publishedVersion, error: versionError } = ["approved", "merged"].includes(submission.status)
    ? await supabase.from("exercise_versions").select("exercises(slug)")
      .eq("source_submission_id", id).order("published_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null, error: null };
  if (versionError) throw new Error("The publication result could not be loaded");
  const compareId = z.uuid().safeParse(query.compare);
  const targetId = compareId.success ? compareId.data : submission.related_exercise_id ?? duplicates.data?.[0]?.exercise_id;
  const { data: target } = targetId ? await supabase.from("exercises")
    .select("id,slug,current_content_id").eq("id", targetId).eq("status", "published").maybeSingle() : { data: null };
  const [comparison, previousRevision, renderScene, editorialScene] = await Promise.all([
    target ? loadReviewContent(target.current_content_id) : null,
    prior.data ? loadReviewContent(prior.data.original_content_id) : null,
    supabase.from("exercise_scenes").select("id").eq("content_id", submission.original_content_id).maybeSingle(),
    submission.editorial_content_id ? loadWorkshopScene(submission.editorial_content_id) : null,
  ]);
  const { data: renderJob } = renderScene.data ? await supabase.from("render_jobs").select("status,error_code,attempt_count")
    .eq("scene_id", renderScene.data.id).order("queued_at", { ascending: false }).limit(1).maybeSingle() : { data: null };
  const targets = new Map<string, { id: string; name: string }>();
  for (const candidate of duplicates.data ?? []) targets.set(candidate.exercise_id, { id: candidate.exercise_id, name: candidate.name });
  for (const candidate of searchResults.data ?? []) targets.set(candidate.exercise_id, { id: candidate.exercise_id, name: candidate.name });
  if (target && comparison) targets.set(target.id, { id: target.id, name: comparison.name });
  const disabled = !!submission.assigned_reviewer_id && submission.assigned_reviewer_id !== identity?.userId && identity?.role !== "admin";
  const { data: candidate } = submission.catalog_candidate_id ? await supabase.from("exercises")
    .select("id,slug").eq("id", submission.catalog_candidate_id).eq("status", "pending_media").maybeSingle() : { data: null };
  const defaultSlug = candidate?.slug ?? (editorial?.name ?? original.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);

  return <div className="space-y-8">
    <Link href="/admin/submissions" className="text-sm font-semibold text-primary">← Review queue</Link>
    <header><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{humanLabel(submission.status)}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{original.name}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{profile.data?.display_name || `Contributor ${submission.owner_id.slice(0, 8)}`} · {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : "Draft"} · Motion reuse {submission.allow_motion_reuse ? "allowed with attribution" : "not authorized"}</p>
      {identity?.role === "admin" && <Link href={`/admin/roles?user=${submission.owner_id}`} className="mt-3 inline-block text-xs font-semibold text-primary">Manage contributor role</Link>}
    </header>
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Demonstration</h2>
        {media?.webm || media?.mp4 ? <video controls muted loop playsInline poster={media.poster ?? undefined} className="mt-4 aspect-square max-h-[550px] w-full rounded-xl bg-muted object-contain">
          {media.webm && <source src={media.webm} type="video/webm" />}{media.mp4 && <source src={media.mp4} type="video/mp4" />}
        </video> : <p className="mt-4 text-sm text-muted-foreground">Render: {renderJob?.status ?? "Not queued"}{renderJob?.error_code ? ` (${humanLabel(renderJob.error_code)})` : ""}.</p>}
        {scene && <details className="mt-5"><summary className="cursor-pointer text-sm font-semibold text-primary">Inspect motion source and camera views</summary><SharedMotion scene={scene} /></details>}
      </section>
      <section className="rounded-2xl border border-border bg-card p-5"><h2 className="mb-5 text-lg font-semibold">Review decision</h2>
      <ReviewDecisions key={submission.status} submissionId={id} status={submission.status} defaultSlug={defaultSlug}
          targets={[...targets.values()]} relatedId={target?.id ?? null} renderFailed={renderJob?.status === "failed"} disabled={disabled} candidate={candidate} />
      {publishedVersion?.exercises && <Link href={`/exercises/${publishedVersion.exercises.slug}`} className="mt-4 inline-block text-sm font-semibold text-primary underline">View exercise</Link>}
      </section>
    </div>
    {(suggestions.data?.length ?? 0) > 0 && <section className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-5"><h2 className="text-lg font-semibold">Taxonomy suggestions</h2>
      <ul className="mt-3 space-y-3 text-sm">{suggestions.data?.map((item, index) => <li key={index}><strong>{humanLabel(item.taxonomy_name)}:</strong> {item.suggested_name}{item.explanation && <p className="mt-1 text-muted-foreground">{item.explanation}</p>}</li>)}</ul>
      <p className="mt-3 text-xs text-muted-foreground">An admin must add valid taxonomy records before unresolved classifications can be approved.</p>
    </section>}
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">Compare with the public database</h2>
      <form className="mt-4 flex gap-3"><label className="sr-only" htmlFor="comparison-search">Exercise name</label>
        <input id="comparison-search" name="q" maxLength={100} defaultValue={search} placeholder="Find another exercise by name" className="min-w-0 flex-1 rounded-xl border border-border px-4 py-2.5 text-sm" />
        <button className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">Search</button>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">{[...targets.values()].map((item) => <Link key={item.id} href={`/admin/submissions/${id}?compare=${item.id}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
        className={`rounded-lg border px-3 py-2 text-sm ${item.id === target?.id ? "border-primary bg-muted" : "border-border"}`}>{item.name}</Link>)}</div>
      {(duplicates.data?.length ?? 0) > 0 && <ul className="mt-4 space-y-2 text-xs text-muted-foreground">{duplicates.data?.map((item) => <li key={item.exercise_id}>{item.name}: comparison score {item.score}/100 · {item.shared_joint_actions} shared actions · {item.shared_equipment} shared equipment{item.exact_name ? " · Exact name" : item.alias_match ? " · Existing alias" : ""}</li>)}</ul>}
      {!targets.size && <p className="mt-4 text-sm text-muted-foreground">No matching public exercises found.</p>}
    </section>
    {!!familyVariations?.length && <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">Existing family variations</h2>
      <ul className="mt-4 flex flex-wrap gap-3">{familyVariations.map((item) => <li key={item.id}>
        <Link href={`/admin/submissions/${id}?compare=${item.id}`} className="text-sm font-semibold text-primary underline">{item.exercise_content.name}</Link>
      </li>)}</ul>
      <p className="mt-3 text-xs text-muted-foreground">Showing up to 20 published members. Compare each variation’s classifications independently.</p>
    </section>}
    {comparison && <ReviewComparison original={original} comparison={comparison} title={`Public comparison: ${comparison.name}`} />}
    {previousRevision && <details><summary className="mb-4 cursor-pointer text-sm font-semibold text-primary">Changes since the previous submission</summary><ReviewComparison original={previousRevision} comparison={original} title="Submission revision" /></details>}
    {editorial && <details><summary className="mb-4 cursor-pointer text-sm font-semibold text-primary">Submitted versus editorial classifications</summary><ReviewComparison original={original} comparison={editorial} title="Reviewer corrections" /></details>}
    {editorial && submission.status === "in_review" && !disabled && <section className="rounded-2xl border border-border bg-card p-6"><h2 className="mb-6 text-xl font-semibold">Correct classifications</h2>
      <ReviewEditor submissionId={id} initial={editorial} options={options} />
    </section>}
    {editorialScene && editorial && submission.status === "in_review" && !disabled && <ReviewAnnotations submissionId={id} scene={editorialScene}
      actions={options.jointActions.filter((item) => editorial.joint_actions.some((action) => action.slug === item.slug))} />}
    <section className="rounded-2xl border border-border bg-card p-6"><h2 className="text-xl font-semibold">Review history</h2>
      <ol className="mt-5 space-y-5">{events.data?.map((event) => <li key={event.id} className="border-l-2 border-border pl-4">
        <p className="text-sm font-semibold capitalize">{humanLabel(event.action)}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</p>
        {event.reason && <p className="mt-2 text-sm">{humanLabel(event.reason)}</p>}{event.comment && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{event.comment}</p>}
        {event.moderation_field_changes.length > 0 && <dl className="mt-3 space-y-3 text-xs">{event.moderation_field_changes.map((change) => <div key={change.field_name}>
          <dt className="font-semibold">{reviewFieldLabels[change.field_name as ReviewField] ?? humanLabel(change.field_name)}</dt>
          <dd className="mt-1 whitespace-pre-wrap"><del className="text-red-700 dark:text-red-300">{formatReviewValue(change.before_value)}</del><span className="mx-2">→</span><ins className="text-primary">{formatReviewValue(change.after_value)}</ins></dd>
        </div>)}</dl>}
      </li>)}</ol>
    </section>
  </div>;
}
