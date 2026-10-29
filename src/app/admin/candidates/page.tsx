import Link from "next/link";
import { ListPagination } from "@/components/catalog/list-pagination";
import { parseListPage, substringPattern } from "@/lib/search/list-page";
import type { RawSearchParams } from "@/lib/search/params";
import { prepareCandidate } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, PageState, secondaryActionClass } from "@/components/ui/page-layout";

export default async function CatalogCandidatesPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { page, query, from, to } = parseListPage(await searchParams);
  const supabase = await createClient();
  let request = supabase.from("exercises")
    .select("id,slug,exercise_content!inner(name,short_description,exercise_families(name))", { count: "exact" })
    .eq("status", "pending_media").is("created_by", null).order("slug").order("id");
  if (query) request = request.ilike("exercise_content.name", substringPattern(query));
  const { data, error, count } = await request.range(from, to);
  if (error) throw new Error("Catalog candidates could not be loaded");
  return <div className="space-y-7">
    <PageHeader title="Prepare catalog candidates" description="These original drafts await a demonstration and biomechanical review. Prepare a private copy, refine its classifications, create a motion, and submit it for review. Approval can publish the candidate using its existing identity, URL, and relationships." />
    <form method="get" role="search" className="flex flex-wrap gap-3">
      <label className="sr-only" htmlFor="candidate-search">Search candidates</label>
      <input id="candidate-search" name="q" maxLength={100} defaultValue={query} placeholder="Search candidate names" className="min-h-11 min-w-0 flex-1 basis-52 rounded-xl border border-input bg-card px-4 text-sm" />
      <button className={secondaryActionClass}>Search</button>
    </form>
    {data?.length ? <ul className="grid gap-4 sm:grid-cols-2">{data.map((item) => <li key={item.id} className="min-w-0 rounded-xl border border-border bg-card p-6">
      <p className="text-xs text-muted-foreground">{item.exercise_content?.exercise_families?.name ?? "Family not classified"}</p>
      <h2 className="mt-2 text-lg font-semibold">{item.exercise_content?.name}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.exercise_content?.short_description}</p>
      <form action={prepareCandidate} className="mt-5"><input type="hidden" name="exerciseId" value={item.id} />
        <button className={secondaryActionClass}>Prepare demonstration</button>
      </form>
    </li>)}</ul> : <PageState title={query || page > 1 ? "No candidates on this page" : "No original candidates to prepare"}
      description={query || page > 1 ? "Change the search or return to the first page." : "Original drafts awaiting a demonstration will appear here."}>
      {(query || page > 1) && <Link href="/admin/candidates" className={secondaryActionClass}>Clear search</Link>}
    </PageState>}
    <ListPagination path="/admin/candidates" page={page} total={count ?? 0} query={query} />
  </div>;
}
