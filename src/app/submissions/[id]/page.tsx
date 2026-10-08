import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { withdrawSubmission } from "@/app/submissions/actions";
import { MotionInspector } from "@/components/character/motion-inspector";
import { MediaGallery } from "@/components/catalog/media-gallery";
import { getIdentity } from "@/lib/auth";
import { loadPrivateRenderMedia } from "@/lib/media/private-media";
import { loadWorkshopScene } from "@/lib/motion/load-scene";
import { createClient } from "@/lib/supabase/server";
import { formatReviewValue, humanLabel, reviewFieldLabels, type ReviewField } from "@/lib/moderation/schema";

export const dynamic = "force-dynamic";

export default async function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const identity = await getIdentity();
  if (!identity) redirect("/sign-in?next=/submissions");
  const { id } = await params;
  const supabase = await createClient();
  const { data: submission } = await supabase.from("exercise_submissions")
    .select("id,status,original_content_id,source_private_exercise_id,submitted_at,duplicate_disposition,related_exercise_id,allow_motion_reuse,revision_of_id")
    .eq("id", id).eq("owner_id", identity.userId).maybeSingle();
  if (!submission) notFound();
  const [content, muscles, actions, equipment, family, events, suggestions, scene] = await Promise.all([
    supabase.from("exercise_content").select("name,short_description,family_id").eq("id", submission.original_content_id).single(),
    supabase.from("exercise_muscles").select("role,muscles(name)").eq("content_id", submission.original_content_id),
    supabase.from("exercise_joint_actions").select("role,joint_actions(name,joints(name))").eq("content_id", submission.original_content_id),
    supabase.from("exercise_equipment").select("equipment(name)").eq("content_id", submission.original_content_id),
    supabase.from("exercise_families").select("id,name"),
    supabase.from("moderation_events").select("action,reason,comment,created_at,from_status,to_status,moderation_field_changes(field_name,before_value,after_value)")
      .eq("submission_id", id).order("created_at", { ascending: true }),
    supabase.from("taxonomy_suggestions").select("taxonomy_name,suggested_name,explanation").eq("submission_id", id),
    loadWorkshopScene(submission.original_content_id),
  ]);
  if (!content.data) notFound();
  const [renderScene, renderedMedia] = await Promise.all([
    supabase.from("exercise_scenes").select("id")
      .eq("content_id", submission.original_content_id).maybeSingle(),
    loadPrivateRenderMedia(submission.original_content_id),
  ]);
  const { data: renderJob } = renderScene.data
    ? await supabase.from("render_jobs").select("status,attempt_count,error_code")
      .eq("scene_id", renderScene.data.id).order("queued_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const familyName = family.data?.find((item) => item.id === content.data.family_id)?.name;
  const canWithdraw = submission.status === "submitted" || submission.status === "changes_requested";

  return <main className="min-h-screen bg-background px-6 py-10 text-foreground">
    <div className="mx-auto max-w-5xl">
      <Link href="/submissions" className="text-sm font-medium text-primary hover:underline">My submissions</Link>
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.055em]">{content.data.name}</h1>
          <p className="mt-3 text-sm capitalize text-muted-foreground">{submission.status.replaceAll("_", " ")} · {submission.submitted_at ? new Date(submission.submitted_at).toLocaleDateString() : "Draft"}</p></div>
        <div className="flex flex-wrap gap-3">
          {submission.source_private_exercise_id && <Link href={`/my-exercises/${submission.source_private_exercise_id}/edit`} className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-primary">Edit my private copy</Link>}
          {submission.status === "changes_requested" && submission.source_private_exercise_id && <Link href={`/my-exercises/${submission.source_private_exercise_id}/submit`} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Send a revision</Link>}
          {canWithdraw && <form action={withdrawSubmission}><input type="hidden" name="submissionId" value={id} /><button type="submit" className="rounded-xl border border-red-200 bg-card px-4 py-2.5 text-sm font-semibold text-red-700 dark:text-red-300">Withdraw</button></form>}
        </div>
      </div>
      {content.data.short_description && <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">{content.data.short_description}</p>}
      {(renderedMedia?.webm || renderedMedia?.mp4) && <section className="mt-9 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Rendered demonstration</h2><span className="text-xs text-muted-foreground">Private review asset</span></div>
        <MediaGallery groups={[{ id, presentation: "anatomy", angle: scene?.cameraAngle ?? null,
          webm: renderedMedia.webm ?? undefined, mp4: renderedMedia.mp4 ?? undefined,
          poster: renderedMedia.poster ?? undefined, license: "CC BY-SA 4.0", credit: "Z-Anatomy / BodyParts3D" }]} />
      </section>}
      {renderJob && renderJob.status !== "succeeded" && <p role="status" className="mt-6 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">Demonstration render: {renderJob.status.replaceAll("_", " ")}{renderJob.status === "failed" ? ". A reviewer can request another attempt." : "."}</p>}
      {scene && <MotionInspector scene={scene} />}
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-xl font-semibold">Original classifications</h2>
          <dl className="mt-5 space-y-4 text-sm">
            <div><dt className="text-muted-foreground">Family</dt><dd className="mt-1 font-medium">{familyName ?? "Not set"}</dd></div>
            <div><dt className="text-muted-foreground">Muscles</dt><dd className="mt-1 font-medium">{(muscles.data ?? []).map((item) => `${item.muscles?.name} (${item.role})`).join(", ") || "Not set"}</dd></div>
            <div><dt className="text-muted-foreground">Joint actions</dt><dd className="mt-1 font-medium">{(actions.data ?? []).map((item) => `${item.joint_actions?.joints?.name} ${item.joint_actions?.name} (${item.role})`).join(", ") || "Not set"}</dd></div>
            <div><dt className="text-muted-foreground">Equipment</dt><dd className="mt-1 font-medium">{(equipment.data ?? []).map((item) => item.equipment?.name).join(", ") || "None"}</dd></div>
          </dl>
          <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">Motion reuse {submission.allow_motion_reuse ? "allowed with attribution" : "not authorized"}.</p>
          {(suggestions.data?.length ?? 0) > 0 && <div className="mt-5 border-t border-border pt-4"><h3 className="text-sm font-semibold">Suggested classifications</h3><ul className="mt-2 space-y-2 text-sm text-muted-foreground">{suggestions.data?.map((item, index) => <li key={index}><span className="capitalize">{item.taxonomy_name.replaceAll("_", " ")}</span>: {item.suggested_name}{item.explanation ? ` — ${item.explanation}` : ""}</li>)}</ul></div>}
        </section>
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-xl font-semibold">Review history</h2>
          <ol className="mt-5 space-y-4">{(events.data ?? []).map((event, index) => <li key={`${event.created_at}-${index}`} className="border-l-2 border-border pl-4">
            <p className="text-sm font-semibold capitalize">{event.action.replaceAll("_", " ")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</p>
            {event.reason && <p className="mt-2 text-sm capitalize text-muted-foreground">Reason: {event.reason.replaceAll("_", " ")}</p>}
            {event.comment && <p className="mt-2 text-sm leading-6 text-muted-foreground">{event.comment}</p>}
            {event.moderation_field_changes.length > 0 && <dl className="mt-3 space-y-3 text-xs">{event.moderation_field_changes.map((change) => <div key={change.field_name}>
              <dt className="font-semibold">{reviewFieldLabels[change.field_name as ReviewField] ?? humanLabel(change.field_name)}</dt>
              <dd className="mt-1 whitespace-pre-wrap"><del className="text-red-700 dark:text-red-300">{formatReviewValue(change.before_value)}</del><span className="mx-2"></span><ins className="text-primary">{formatReviewValue(change.after_value)}</ins></dd>
            </div>)}</dl>}
          </li>)}</ol>
        </section>
      </div>
    </div>
  </main>;
}
