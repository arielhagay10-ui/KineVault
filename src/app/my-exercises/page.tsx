import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { getIdentity } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadWorkshopScene } from "@/lib/motion/load-scene";
import { DuplicatePrivateButton } from "@/components/private-exercises/duplicate-private-button";
import { PrivateDraftPreview } from "@/components/private-exercises/private-draft-preview";

export const dynamic = "force-dynamic";

export default async function MyExercisesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const identity = await getIdentity();
  if (!identity) redirect("/sign-in?next=/my-exercises");
  const supabase = await createClient();
  const query = await searchParams;
  const requestedPage = Number(query.page ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10000) : 1;
  const pageSize = 12;
  const { data: exercises, error, count } = await supabase.from("private_exercises")
    .select("id,content_id,updated_at,exercise_content(name,short_description)", { count: "exact" })
    .eq("owner_id", identity.userId).order("updated_at", { ascending: false }).order("id")
    .range((page - 1) * pageSize, page * pageSize - 1);
  const drafts = await Promise.all((exercises ?? []).map(async item => {
    try { return { ...item, scene: await loadWorkshopScene(item.content_id), previewError: false }; }
    catch { return { ...item, scene: null, previewError: true }; }
  }));

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 pb-20 pt-8">
        <header className="flex items-center justify-between border-b border-border pb-6">
          <Link href="/" className="text-xl font-bold tracking-[-0.05em]">KineVault</Link>
          <Link href="/dashboard" className="flex items-center gap-2 text-sm text-primary"><ArrowLeft size={16} /> Dashboard</Link>
        </header>
        <div className="flex flex-wrap items-end justify-between gap-5 py-12">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Private library</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em]">My exercises</h1>
            <p className="mt-3 text-muted-foreground">Your drafts stay private until you decide to share or submit them.</p>
          </div>
          <Link href="/my-exercises/new" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary"><Plus size={17} /> New exercise</Link>
        </div>
        {error ? <p role="alert" className="text-red-700 dark:text-red-300">Private exercises could not be loaded.</p>
          : exercises?.length ? <div className="grid gap-4 sm:grid-cols-2">
            {drafts.map((item) => (
              <article key={item.id} className="rounded-2xl border border-border bg-card p-6">
                <p className="text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">Private draft</p>
                <h2 className="mt-2 text-xl font-semibold">{item.exercise_content?.name ?? "Untitled exercise"}</h2>
                {item.exercise_content?.short_description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{item.exercise_content.short_description}</p>}
                <p className="mt-3 text-sm text-muted-foreground">Updated <time dateTime={item.updated_at}>{new Date(item.updated_at).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}</time></p>
                {item.scene && <PrivateDraftPreview scene={item.scene} name={item.exercise_content?.name ?? "Untitled exercise"} />}
                {item.previewError && <p className="mt-3 text-sm text-muted-foreground">Preview unavailable. Resume the draft to try again.</p>}
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Link href={`/my-exercises/${item.id}/workshop`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-3 text-base font-semibold text-primary-foreground">Resume draft <ArrowRight size={16} /></Link>
                  <Link href={`/my-exercises/${item.id}/edit`} className="min-h-11 py-3 text-base text-primary underline">Optional details</Link>
                  <DuplicatePrivateButton privateId={item.id} />
                </div>
              </article>
            ))}
          </div> : <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
            <h2 className="text-xl font-semibold">{count ? "No drafts on this page" : "No private exercises yet"}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{count ? "Return to your recent drafts." : "Create a draft to keep your own exercise variation."}</p>
            <Link href={count ? "/my-exercises" : "/my-exercises/new"} className="mt-5 inline-flex min-h-11 items-center gap-2 text-base font-semibold text-primary">{count ? "Recent drafts" : "Create one"} <ArrowRight size={16} /></Link>
          </div>}
        {(page > 1 || (count ?? 0) > page * pageSize) && <nav aria-label="Private library pages" className="mt-6 flex flex-wrap items-center gap-4 text-base">
          {page > 1 && <Link href={`/my-exercises?page=${page - 1}`} className="min-h-11 rounded-xl border border-border px-4 py-3">Previous drafts</Link>}
          {(count ?? 0) > page * pageSize && <Link href={`/my-exercises?page=${page + 1}`} className="min-h-11 rounded-xl border border-border px-4 py-3">More drafts</Link>}
        </nav>}
      </div>
    </main>
  );
}
