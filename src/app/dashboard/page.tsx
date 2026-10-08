import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Heart, Plus } from "@/components/ui/icons";
import { ListPagination } from "@/components/catalog/list-pagination";
import { parseListPage } from "@/lib/search/list-page";
import type { RawSearchParams } from "@/lib/search/params";
import { getIdentity } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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
        <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Your library</h1>
        <section aria-labelledby="start-here" className="mt-8 border-y border-border py-7">
          <h2 id="start-here" className="text-xl font-semibold">Start here</h2>
          <ol className="mt-5 grid gap-6 md:grid-cols-3">
            <li><span className="text-sm font-semibold text-primary">1. Explore</span><p className="my-3 text-sm leading-6 text-muted-foreground">Find a movement. Save it with the heart, or copy it to your exercises.</p><Link href="/exercises" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">Explore exercises <ArrowRight size={16} /></Link></li>
            <li><span className="text-sm font-semibold text-primary">2. Create</span><p className="my-3 text-sm leading-6 text-muted-foreground">Choose equipment, set the movement, then name and save your private draft.</p><Link href="/my-exercises/new" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Plus size={16} /> Create an exercise</Link></li>
            <li><span className="text-sm font-semibold text-primary">3. Share</span><p className="my-3 text-sm leading-6 text-muted-foreground">Open a saved exercise to make a view link or submit it for public review.</p><Link href="/my-exercises" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">Open my exercises <ArrowRight size={16} /></Link></li>
          </ol>
        </section>
        {identity.role !== "user" && <Link href="/admin" className="mt-5 inline-block rounded-[12px] border border-border bg-card px-4 py-3 text-sm font-semibold text-primary">Open review dashboard</Link>}
        <nav className="mt-5 flex flex-wrap gap-3 text-sm font-semibold text-primary" aria-label="Community contributions"><Link href="/submissions" className="inline-flex min-h-11 items-center rounded-[8px] border border-input bg-card px-4 py-2 hover:bg-muted">My submissions</Link><Link href="/notifications" className="inline-flex min-h-11 items-center rounded-[8px] border border-input bg-card px-4 py-2 hover:bg-muted">Review updates{unread.count ? ` (${unread.count} unread)` : ""}</Link></nav>
        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <Link href="/my-exercises" className="rounded-[12px] border border-border bg-card p-6 hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring">
            <Plus size={22} className="text-primary" />
            <h2 className="mt-4 text-xl font-semibold">Private exercises</h2>
            <p className="mt-1 text-sm text-muted-foreground">{privateCount.count ?? 0} {privateCount.count === 1 ? "draft" : "drafts"}</p>
            <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-primary">Open my exercises <ArrowRight size={16} /></p>
          </Link>
          <div className="rounded-[12px] border border-border bg-card p-6">
            <Heart size={22} className="text-primary" />
            <h2 className="mt-4 text-xl font-semibold">Favorites</h2>
            <p className="mt-1 text-sm text-muted-foreground">{favoriteCount.count ?? 0} saved {favoriteCount.count === 1 ? "exercise" : "exercises"}</p>
            <Link href="/exercises" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">Explore more <ArrowRight size={16} /></Link>
          </div>
        </div>
        {((favoriteCount.count ?? 0) > 0 || page > 1) && <section className="mt-10">
          <h2 className="text-xl font-semibold">Saved exercises</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {favorites.data?.map((item) => item.exercises && <Link key={item.exercise_id}
              href={`/exercises/${item.exercises.slug}`} className="rounded-[12px] border border-border bg-card px-5 py-4 font-medium hover:text-primary">
              {nameById.get(item.exercises.current_content_id) ?? item.exercises.slug}
            </Link>)}
          </div>
          {!favorites.data?.length && <p className="mt-4 text-sm text-muted-foreground">No saved exercises on this page.</p>}
          <ListPagination path="/dashboard" page={page} total={favoriteCount.count ?? 0} />
        </section>}
      </div>
    </main>
  );
}
