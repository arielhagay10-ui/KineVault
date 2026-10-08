import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SubmissionForm } from "@/components/submissions/submission-form";
import { getIdentity } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SubmitExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const identity = await getIdentity();
  if (!identity) redirect("/sign-in?next=/my-exercises");
  const { id } = await params;
  const supabase = await createClient();
  const { data: exercise } = await supabase.from("private_exercises")
    .select("id,content_id,exercise_content(name,family_id)")
    .eq("id", id).eq("owner_id", identity.userId).maybeSingle();
  if (!exercise) notFound();
  const [muscles, actions, scene, duplicates, revision] = await Promise.all([
    supabase.from("exercise_muscles").select("muscle_id", { count: "exact", head: true })
      .eq("content_id", exercise.content_id).eq("role", "primary"),
    supabase.from("exercise_joint_actions").select("joint_action_id", { count: "exact", head: true })
      .eq("content_id", exercise.content_id).eq("role", "primary"),
    supabase.from("exercise_scenes").select("id,duration_ms").eq("content_id", exercise.content_id).maybeSingle(),
    supabase.rpc("find_exercise_duplicates", { p_private_id: id }),
    supabase.from("exercise_submissions").select("id")
      .eq("source_private_exercise_id", id).eq("status", "changes_requested")
      .order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const { data: frames } = scene.data
    ? await supabase.from("motion_keyframes")
      .select("position_ms,motion_joint_poses(rig_joint_id)")
      .eq("scene_id", scene.data.id).order("position_ms")
    : { data: null };
  const completeMotion = Boolean(scene.data && frames && frames.length >= 2
    && frames[0].position_ms === 0
    && frames[frames.length - 1].position_ms === scene.data.duration_ms
    && frames.some((frame) => frame.motion_joint_poses.length > 0));
  const checks = [
    { label: "Exercise family", ready: Boolean(exercise.exercise_content?.family_id), href: `/my-exercises/${id}/edit` },
    { label: "Primary muscle", ready: (muscles.count ?? 0) > 0, href: `/my-exercises/${id}/edit` },
    { label: "Primary joint action", ready: (actions.count ?? 0) > 0, href: `/my-exercises/${id}/edit` },
    { label: "Saved motion demonstration", ready: completeMotion, href: `/my-exercises/${id}/workshop` },
  ];
  const missingRequired = [
    !checks[0].ready && "exercise_families",
    !checks[1].ready && "muscles",
    !checks[2].ready && "joint_actions",
  ].filter((value): value is string => Boolean(value));

  return <main className="min-h-screen bg-background px-6 py-10 text-foreground">
    <div className="mx-auto max-w-4xl">
      <Link href={`/my-exercises/${id}/edit`} className="text-sm font-medium text-primary hover:underline">Private exercise</Link>
      <div className="mt-8">

        <h1 className="mt-2 text-4xl font-semibold tracking-[-0.055em]">Submit {exercise.exercise_content?.name}</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">Review your classifications and motion before sending an immutable copy to the moderation queue.</p>
      </div>
      <section className="my-8 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-xl font-semibold">Ready for review</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{checks.map((item) => <Link key={item.label} href={item.href}
          className="flex items-center justify-between rounded-xl bg-background px-4 py-3 text-sm font-medium hover:bg-muted">
          {item.label}<span className={item.ready ? "text-primary" : "text-muted-foreground"}>{item.ready ? "Complete" : item.label === "Saved motion demonstration" ? "Add" : "Add or suggest"}</span>
        </Link>)}</div>
      </section>
      {duplicates.error && <p role="alert" className="mb-6 text-sm text-red-700 dark:text-red-300">Duplicate comparison is unavailable. Reload before submitting.</p>}
      <SubmissionForm privateId={id} revisionOfId={revision.data?.id ?? null}
        candidates={duplicates.data ?? []} motionReady={completeMotion}
        missingRequired={missingRequired} duplicatesReady={!duplicates.error} />
    </div>
  </main>;
}
