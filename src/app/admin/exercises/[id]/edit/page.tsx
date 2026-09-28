import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ReviewEditor } from "@/components/moderation/review-editor";
import { loadReviewContent, loadReviewOptions } from "@/lib/moderation/content";
import { createClient } from "@/lib/supabase/server";

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
    <header><Link href="/admin/exercises" className="text-sm font-semibold text-[#28785f]">← Published exercises</Link>
      <h1 className="mt-4 text-3xl font-semibold">{content.name}</h1>
      <p className="mt-3 text-sm text-[#617568]">Save a new version with a recorded reason. The reviewed motion and media are preserved.</p>
      <Link href={`/exercises/${exercise.slug}`} className="mt-3 inline-block text-sm underline">View exercise</Link>
    </header>
    <section className="rounded-2xl border bg-white p-6">
      <ReviewEditor exerciseId={id} contentId={exercise.current_content_id} initial={content} options={options} />
    </section>
    <section><h2 className="text-lg font-semibold">Version history</h2>
      <ol className="mt-4 space-y-3 text-sm">{versions.data?.map((version) => <li key={version.version_number}>
        Version {version.version_number} · {new Date(version.published_at).toLocaleString()} · Reviewer {version.approved_by?.slice(0, 8) ?? "Unknown"}
      </li>)}</ol>
    </section>
  </div>;
}
