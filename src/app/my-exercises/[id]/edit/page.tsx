import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DeletePrivateButton } from "@/components/private-exercises/delete-private-button";
import { PrivateExerciseForm } from "@/components/private-exercises/private-exercise-form";
import { SharePanel } from "@/components/private-exercises/share-panel";
import { getIdentity } from "@/lib/auth";
import { loadReviewContent, loadReviewOptions } from "@/lib/moderation/content";
import type { PrivateExerciseInput } from "@/lib/private-exercises/schema";
import { createClient } from "@/lib/supabase/server";
import { loadWorkshopScene } from "@/lib/motion/load-scene";
import { DuplicatePrivateButton } from "@/components/private-exercises/duplicate-private-button";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; sceneSaved?: string }> };

export default async function EditPrivateExercisePage({ params, searchParams }: Props) {
  const identity = await getIdentity();
  if (!identity) redirect("/sign-in?next=/my-exercises");
  const { id } = await params;
  const supabase = await createClient();
  const { data: record } = await supabase.from("private_exercises")
    .select("id,content_id,copied_from_exercise_id,catalog_candidate_id").eq("id", id).eq("owner_id", identity.userId).maybeSingle();
  if (!record) notFound();

  const contentId = record.content_id;
  const { data: sourceExercise } = record.copied_from_exercise_id
    ? await supabase.from("exercises").select("slug").eq("id", record.copied_from_exercise_id).maybeSingle()
    : { data: null };
  const [metadata, shares, options, scene] = await Promise.all([
    loadReviewContent(contentId),
    supabase.from("private_exercise_shares").select("id").eq("private_exercise_id", record.id).is("revoked_at", null),
    loadReviewOptions(),
    loadWorkshopScene(contentId).catch(() => null),
  ]);
  if (!metadata) notFound();
  const selected = (role: "primary" | "secondary" | "stabilizer") =>
    metadata.muscles.filter((item) => item.role === role).map((item) => item.slug);
  const initial: PrivateExerciseInput = {
    privateId: record.id, name: metadata.name, shortDescription: metadata.description ?? "",
    familySlug: metadata.family, primaryMuscles: selected("primary"), secondaryMuscles: selected("secondary"),
    stabilizerMuscles: selected("stabilizer"), joints: metadata.joints.map((item) => item.slug),
    jointActions: metadata.joint_actions.map((item) => item.slug), equipment: metadata.equipment.map((item) => item.slug),
    resistanceProfile: metadata.resistance_profile, bodyPositionSlug: metadata.body_position,
  };
  const query = await searchParams;
  const saved = query.saved === "1";
  const sceneSaved = query.sceneSaved === "1";

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-5xl">
        <Link href="/my-exercises" className="text-sm font-medium text-primary hover:underline">My exercises</Link>
        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Private draft</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.055em]">Edit exercise</h1>
          </div>
          <DeletePrivateButton privateId={record.id} />
        </div>
        {saved && <p role="status" className="my-6 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-primary">Saved privately.</p>}
        {sceneSaved && <p role="status" className="my-6 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-primary">Movement saved privately. Give it a name. Anatomy and instructions are optional.</p>}
        {record.catalog_candidate_id && <p className="mt-4 rounded-xl border bg-muted p-4 text-sm">Preparing an original catalog candidate. Save its classifications, create a clear motion, then submit for review. Approval preserves the candidate’s identity.</p>}
        {!record.catalog_candidate_id && sourceExercise && <p className="mt-4 text-sm text-muted-foreground">Copied from <Link href={`/exercises/${sourceExercise.slug}`} className="font-semibold text-primary underline">the public exercise</Link>. Your edits are independent.</p>}
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href={`/my-exercises/${record.id}/workshop`} className="inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary">Open motion workshop</Link>
          <Link href={`/my-exercises/${record.id}/submit`} className="inline-flex rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-primary hover:bg-muted">Submit for review</Link>
          <DuplicatePrivateButton privateId={record.id} />
        </div>
        <div className="mt-8"><PrivateExerciseForm key={JSON.stringify(metadata)} ownerId={identity.userId} initial={initial} options={options} metadata={metadata} scene={scene} /></div>
        <SharePanel privateId={record.id} active={(shares.data?.length ?? 0) > 0} />
      </div>
    </main>
  );
}
