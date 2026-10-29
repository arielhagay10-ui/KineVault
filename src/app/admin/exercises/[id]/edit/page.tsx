import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ReviewEditor } from "@/components/moderation/review-editor";
import { loadReviewContent, loadReviewOptions } from "@/lib/moderation/content";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, PageState, secondaryActionClass } from "@/components/ui/page-layout";

export default async function EditPublishedExercise({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: exercise, error } = await supabase.from("exercises").select("id,slug,current_content_id")
    .eq("id", id).eq("status", "published").maybeSingle();
  if (error) throw new Error("The exercise could not be loaded");
  if (!exercise) notFound();
  const [content, options, versions] = await Promise.all([
    loadReviewContent(exercise.current_content_id), loadReviewOptions(),
    supabase.from("exercise_versions").select("version_number,published_at,approved_by").eq("exercise_id", id)
      .order("version_number", { ascending: false }).limit(20),
  ]);
  if (!content) notFound();
  if (versions.error) throw new Error("Version history could not be loaded");
  return <div className="space-y-7">
    <PageHeader title={content.name} description="Save a new version with a recorded reason. The reviewed motion and media are preserved."
      back={{ href: "/admin/exercises", label: "Published exercises" }} actions={<Link href={`/exercises/${exercise.slug}`} className={secondaryActionClass}>View exercise</Link>} />
    <section className="rounded-xl border border-border bg-card p-6">
      <ReviewEditor exerciseId={id} contentId={exercise.current_content_id} initial={content} options={options} />
    </section>
    <section><h2 className="text-lg font-semibold">Version history</h2>
      <ol className="mt-4 divide-y divide-border rounded-xl border border-border bg-card px-5 text-sm">{versions.data?.map((version) => <li key={version.version_number} className="py-4">
        Version {version.version_number} · {new Date(version.published_at).toLocaleString()} · Reviewer {version.approved_by?.slice(0, 8) ?? "Unknown"}
      </li>)}</ol>
      {!versions.data?.length && <PageState title="No prior versions" description="Saved versions will appear here." />}
    </section>
  </div>;
}
