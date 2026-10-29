import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getIdentity } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CommunityPublishForm } from "@/components/submissions/community-publish-form";
import { CandidateSubmission } from "@/components/submissions/candidate-submission";
import { PageHeader } from "@/components/ui/page-layout";
import { LibraryNavigation } from "@/components/ui/workspace-navigation";

export default async function SubmitExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const identity = await getIdentity();
  if (!identity) redirect("/sign-in?next=/my-exercises");
  const { id } = await params;
  const supabase = await createClient();
  const { data: exercise, error: exerciseError } = await supabase.from("private_exercises")
    .select("id,content_id,catalog_candidate_id,exercise_content(name,family_id)").eq("id", id).eq("owner_id", identity.userId).maybeSingle();
  if (exerciseError) throw new Error("The private exercise could not be loaded");
  if (!exercise) notFound();
  if (exercise.catalog_candidate_id && exercise.exercise_content) {
    return <CandidateSubmission id={id} contentId={exercise.content_id}
      name={exercise.exercise_content.name} familyId={exercise.exercise_content.family_id} />;
  }
  const { data: publication, error: publicationError } = await supabase.from("exercise_publications")
    .select("exercise_id,exercises(slug,status)").eq("source_private_exercise_id", id).maybeSingle();
  if (publicationError) throw new Error("Publication details could not be loaded");
  const name = exercise.exercise_content?.name.trim() ?? "";
  const nameReady = name.length >= 2 && name.toLowerCase() !== "untitled exercise";
  return <main className="min-h-screen bg-background text-foreground">
    <div className="mx-auto max-w-5xl px-6 pb-20 pt-8">
      <LibraryNavigation />
      <PageHeader title="Publish exercise" back={{ href: `/my-exercises/${id}/edit`, label: "Private exercise" }} />
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-xl font-semibold">{exercise.exercise_content?.name}</h2>
        {publication ? <>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">This draft already has a public snapshot. Your private edits do not change that snapshot.</p>
          {publication.exercises?.status === "published"
            ? <Link href={`/exercises/${publication.exercises.slug}`} className="mt-5 inline-flex min-h-11 items-center font-semibold text-primary underline">View public exercise</Link>
            : <p className="mt-4 text-sm text-muted-foreground">The public exercise is hidden by moderation.</p>}
        </> : <>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">Publishing makes a copy visible to everyone in Explore immediately. It starts with a Community label. A moderator can verify it later.</p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Your saved name, details and movement are copied. Your private draft stays editable and future edits stay private. Classifications and rendered video are optional.</p>
          {nameReady ? <CommunityPublishForm privateId={id} /> : <p className="mt-5 text-sm">Save a name in <Link href={`/my-exercises/${id}/edit`} className="font-semibold text-primary underline">exercise details</Link> before publishing.</p>}
        </>}
      </section>
    </div>
  </main>;
}
