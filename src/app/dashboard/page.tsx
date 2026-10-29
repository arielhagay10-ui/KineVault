import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Plus } from "@/components/ui/icons";
import { ListPagination } from "@/components/catalog/list-pagination";
import { parseListPage } from "@/lib/search/list-page";
import type { RawSearchParams } from "@/lib/search/params";
import { getIdentity } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, PageState, primaryActionClass, secondaryActionClass } from "@/components/ui/page-layout";
import { LibraryNavigation } from "@/components/ui/workspace-navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { page, from, to } = parseListPage(await searchParams);
  const identity = await getIdentity();
  if (!identity) redirect("/sign-in?next=/dashboard");
  const supabase = await createClient();
  const [favorites, favoriteCount, privateCount, unread] = await Promise.all([
    supabase.from("favorites").select("exercise_id,exercises(slug,current_content_id)")
      .eq("user_id", identity.userId).order("created_at", { ascending: false }).order("exercise_id").range(from, to),
    supabase.from("favorites").select("exercise_id", { count: "exact", head: true }).eq("user_id", identity.userId),
    supabase.from("private_exercises").select("id", { count: "exact", head: true }).eq("owner_id", identity.userId),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", identity.userId).is("read_at", null),
  ]);
  if ([favorites, favoriteCount, privateCount, unread].some(result => result.error)) throw new Error("Your library could not be loaded");
  const contentIds = (favorites.data ?? []).map((item) => item.exercises?.current_content_id).filter((id): id is string => Boolean(id));
  const { data: names } = contentIds.length
    ? await supabase.from("exercise_content").select("id,name").in("id", contentIds)
    : { data: [] };
  const nameById = new Map((names ?? []).map((item) => [item.id, item.name]));

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 pb-20 pt-8">
        <LibraryNavigation />
        <PageHeader title="Your library" description="Your saved exercises and private drafts, all in one place."
          actions={<Link href="/my-exercises/new" className={primaryActionClass}><Plus size={16} />New exercise</Link>} />
        <section aria-labelledby="saved-exercises">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><h2 id="saved-exercises" className="text-xl font-semibold">Saved exercises</h2>
              <p className="mt-2 text-sm text-muted-foreground">{favoriteCount.count ?? 0} saved {favoriteCount.count === 1 ? "exercise" : "exercises"}</p></div>
            <Link href="/exercises" className={secondaryActionClass}>Explore exercises <ArrowRight size={16} /></Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {favorites.data?.map((item) => item.exercises ? <Link key={item.exercise_id}
              href={`/exercises/${item.exercises.slug}`} className="min-w-0 rounded-[12px] border border-border bg-card px-5 py-4 font-medium [overflow-wrap:anywhere] hover:text-primary">
              {nameById.get(item.exercises.current_content_id) ?? item.exercises.slug}
            </Link> : <div key={item.exercise_id} className="min-w-0 rounded-[12px] border border-border bg-card px-5 py-4">
              <p className="font-medium">Saved exercise unavailable</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">This exercise is no longer public. Explore the catalog to save another movement.</p>
            </div>)}
          </div>
          {!favorites.data?.length && <div className="mt-4"><PageState title={page > 1 ? "No saved exercises on this page" : "Save exercises for later"}
            description={page > 1 ? "Return to your saved exercises." : "Explore movements and use the heart to add them here. Create a private draft when you want to make your own variation."}>
            {page > 1 && <Link href="/dashboard" className={secondaryActionClass}>First page</Link>}
          </PageState></div>}
          <ListPagination path="/dashboard" page={page} total={favoriteCount.count ?? 0} />
        </section>
        <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-border pt-6 text-sm">
          <Link href="/my-exercises" className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary hover:underline">My exercises <span className="font-normal text-muted-foreground">{privateCount.count ?? 0} {privateCount.count === 1 ? "draft" : "drafts"}</span></Link>
          {!!unread.count && <Link href="/notifications" className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline">Review updates ({unread.count} unread)</Link>}
          {identity.role !== "user" && <Link href="/admin" className={secondaryActionClass}>Open review dashboard</Link>}
        </div>
      </div>
    </main>
  );
}
