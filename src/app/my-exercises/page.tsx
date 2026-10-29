import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Plus } from "@/components/ui/icons";
import { getIdentity } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadWorkshopScene } from "@/lib/motion/load-scene";
import { DuplicatePrivateButton } from "@/components/private-exercises/duplicate-private-button";
import { PrivateDraftPreview } from "@/components/private-exercises/private-draft-preview";
import { PageHeader, PageState, primaryActionClass, secondaryActionClass } from "@/components/ui/page-layout";
import { LibraryNavigation } from "@/components/ui/workspace-navigation";

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
    .select("id,content_id,catalog_candidate_id,updated_at,exercise_content(name,short_description,exercise_muscles(role,muscles(slug)))", { count: "exact" })
    .eq("owner_id", identity.userId).order("updated_at", { ascending: false }).order("id")
    .range((page - 1) * pageSize, page * pageSize - 1);
  const drafts = await Promise.all((exercises ?? []).map(async item => {
    try { return { ...item, scene: await loadWorkshopScene(item.content_id), previewError: false }; }
    catch { return { ...item, scene: null, previewError: true }; }
  }));

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 pb-20 pt-8">
        <LibraryNavigation />
        <PageHeader title="My exercises" description="Your drafts stay private until you share a link or publish a public copy."
          actions={<Link href="/my-exercises/new" className={primaryActionClass}><Plus size={17} aria-hidden />New exercise</Link>} />
        {error ? <PageState error title="Private exercises could not be loaded" description="Try again to see your saved drafts."><Link href={`/my-exercises?page=${page}`} className={secondaryActionClass}>Try again</Link></PageState>
          : exercises?.length ? <div className="grid gap-4 sm:grid-cols-2">
            {drafts.map((item) => (
              <article key={item.id} className="min-w-0 rounded-[12px] border border-border bg-card p-6">
                <p className="text-xs font-medium text-primary">Private draft</p>
                <h2 className="mt-2 break-words text-xl font-semibold">{item.exercise_content?.name ?? "Untitled exercise"}</h2>
                {item.exercise_content?.short_description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{item.exercise_content.short_description}</p>}
                <p className="mt-3 text-sm text-muted-foreground">Updated <time dateTime={item.updated_at}>{new Date(item.updated_at).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}</time></p>
                {item.scene && <PrivateDraftPreview scene={item.scene} name={item.exercise_content?.name ?? "Untitled exercise"}
                  muscleSlugs={item.exercise_content?.exercise_muscles.flatMap(item => item.muscles ? [item.muscles.slug] : []) ?? []}
                  secondaryMuscleSlugs={item.exercise_content?.exercise_muscles.flatMap(item => item.role === "secondary" && item.muscles ? [item.muscles.slug] : []) ?? []} />}
                {item.previewError && <p className="mt-3 text-sm text-muted-foreground">Preview unavailable. Resume the draft to try again.</p>}
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Link href={`/my-exercises/${item.id}/workshop`} className={primaryActionClass}>Resume draft <ArrowRight size={16} /></Link>
                </div>
                <details className="mt-4 border-t border-border pt-2">
                  <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-ring">More actions</summary>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <Link href={`/my-exercises/${item.id}/edit`} className={secondaryActionClass}>Optional details</Link>
                    <Link href={`/my-exercises/${item.id}/edit#sharing`} className={secondaryActionClass}>Share exercise</Link>
                    <Link href={`/my-exercises/${item.id}/submit`} className={secondaryActionClass}>{item.catalog_candidate_id ? "Submit for review" : "Publish exercise"}</Link>
                    <DuplicatePrivateButton privateId={item.id} />
                  </div>
                </details>
              </article>
            ))}
          </div> : <PageState title={count ? "No drafts on this page" : "No private exercises yet"}
            description={count ? "Return to your recent drafts." : "Create a draft to keep your own exercise variation."}>
            <Link href={count ? "/my-exercises" : "/my-exercises/new"} className={primaryActionClass}>{count ? "Recent drafts" : "Create one"} <ArrowRight size={16} /></Link>
          </PageState>}
        {(page > 1 || (count ?? 0) > page * pageSize) && <nav aria-label="Private library pages" className="mt-6 flex flex-wrap items-center gap-4 text-base">
          {page > 1 && <Link href={`/my-exercises?page=${page - 1}`} className="min-h-11 rounded-[12px] border border-border px-4 py-3">Previous drafts</Link>}
          {(count ?? 0) > page * pageSize && <Link href={`/my-exercises?page=${page + 1}`} className="min-h-11 rounded-[12px] border border-border px-4 py-3">More drafts</Link>}
        </nav>}
      </div>
    </main>
  );
}
