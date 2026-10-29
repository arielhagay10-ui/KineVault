import Link from "next/link";
import { SubmissionForm } from "@/components/submissions/submission-form";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-layout";
import { LibraryNavigation } from "@/components/ui/workspace-navigation";

export async function CandidateSubmission({ id, contentId, name, familyId }: {
  id: string; contentId: string; name: string; familyId: string | null;
}) {
  const supabase = await createClient();
  const [muscles, actions, scene, duplicates, revision] = await Promise.all([
    supabase.from("exercise_muscles").select("muscle_id", { count: "exact", head: true })
      .eq("content_id", contentId).eq("role", "primary"),
    supabase.from("exercise_joint_actions").select("joint_action_id", { count: "exact", head: true })
      .eq("content_id", contentId).eq("role", "primary"),
    supabase.from("exercise_scenes").select("id,duration_ms").eq("content_id", contentId).maybeSingle(),
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
    { label: "Exercise family", ready: Boolean(familyId), href: `/my-exercises/${id}/edit` },
    { label: "Primary muscle", ready: (muscles.count ?? 0) > 0, href: `/my-exercises/${id}/edit` },
    { label: "Primary joint action", ready: (actions.count ?? 0) > 0, href: `/my-exercises/${id}/edit` },
    { label: "Saved motion demonstration", ready: completeMotion, href: `/my-exercises/${id}/workshop` },
  ];
  const missingRequired = [
    !checks[0].ready && "exercise_families",
    !checks[1].ready && "muscles",
    !checks[2].ready && "joint_actions",
  ].filter((value): value is string => Boolean(value));

  return <main className="min-h-screen bg-background text-foreground">
    <div className="mx-auto max-w-5xl px-6 pb-20 pt-8">
      <LibraryNavigation />
      <PageHeader title={`Submit ${name}`} back={{ href: `/my-exercises/${id}/edit`, label: "Private exercise" }}
        description="Review your classifications and motion before sending an immutable copy to the moderation queue." />
      <section className="mb-8 rounded-xl border border-border bg-card p-6">
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
