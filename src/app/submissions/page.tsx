import Link from "next/link";
import { LibraryNavigation } from "@/components/ui/workspace-navigation";
import { redirect } from "next/navigation";
import { ListPagination } from "@/components/catalog/list-pagination";
import { parseListPage, substringPattern } from "@/lib/search/list-page";
import type { RawSearchParams } from "@/lib/search/params";
import { getIdentity } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, PageState, secondaryActionClass } from "@/components/ui/page-layout";

export const dynamic = "force-dynamic";

export default async function SubmissionsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { page, query, from, to } = parseListPage(await searchParams);
  const identity = await getIdentity();
  if (!identity) redirect("/sign-in?next=/submissions");
  const supabase = await createClient();
  let request = supabase.from("exercise_submissions")
    .select("id,status,submitted_at,original_content_id,revision_of_id,content:exercise_content!exercise_submissions_original_content_id_fkey!inner(name)", { count: "exact" })
    .eq("owner_id", identity.userId).order("submitted_at", { ascending: false }).order("id");
  if (query) request = request.ilike("content.name", substringPattern(query));
  const { data: submissions, error, count } = await request.range(from, to);

  return <main className="min-h-screen bg-background text-foreground">
    <div className="mx-auto max-w-5xl px-6 pb-20 pt-8">
      <LibraryNavigation />
      <PageHeader title="My submissions" description="Track review progress and requests for changes." back={{ href: "/dashboard", label: "Your library" }} />
      <form method="get" role="search" className="flex flex-wrap gap-3">
        <label className="sr-only" htmlFor="submission-search">Search submissions</label>
        <input id="submission-search" name="q" maxLength={100} defaultValue={query} placeholder="Search by exercise name" className="min-h-11 min-w-0 flex-1 basis-52 rounded-xl border border-input bg-card px-4 text-sm" />
        <button className={secondaryActionClass}>Search</button>
      </form>
      {error ? <div className="mt-8"><PageState error title="Submissions could not be loaded" description="Try again to check your review progress."><Link href={`/submissions?${new URLSearchParams({ page: String(page), ...(query ? { q: query } : {}) })}`} className={secondaryActionClass}>Try again</Link></PageState></div>
        : submissions?.length ? <div className="mt-8 space-y-3">{submissions.map((item) => <Link key={item.id}
          href={`/submissions/${item.id}`} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring">
          <div><h2 className="font-semibold">{item.content?.name ?? "Exercise submission"}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : "Draft"}{item.revision_of_id ? " · Revision" : ""}</p></div>
          <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold capitalize text-muted-foreground">{item.status.replaceAll("_", " ")}</span>
        </Link>)}</div>
          : <div className="mt-8"><PageState title={query || page > 1 ? "No submissions on this page" : "No submissions yet"}
            description="Create a private exercise and send a reviewed copy to the community.">
            <Link href="/my-exercises" className={secondaryActionClass}>Go to my exercises</Link>
          </PageState></div>}
      {!error && <ListPagination path="/submissions" page={page} total={count ?? 0} query={query} />}
    </div>
  </main>;
}
