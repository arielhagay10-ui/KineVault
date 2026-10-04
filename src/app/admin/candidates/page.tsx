import { ListPagination } from "@/components/catalog/list-pagination";
import { parseListPage, substringPattern } from "@/lib/search/list-page";
import type { RawSearchParams } from "@/lib/search/params";
import { prepareCandidate } from "./actions";
import { createClient } from "@/lib/supabase/server";

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
    <header><p className="text-xs font-bold uppercase tracking-widest text-primary">Original catalog</p>
      <h1 className="mt-3 text-3xl font-semibold">Prepare catalog candidates</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">These original drafts await a demonstration and biomechanical review. Prepare a private copy, refine its classifications, create a motion, and submit it for review. Approval can publish the candidate using its existing identity, URL, and relationships.</p>
    </header>
    <form method="get" className="flex gap-3">
      <label className="sr-only" htmlFor="candidate-search">Search candidates</label>
      <input id="candidate-search" name="q" defaultValue={query} placeholder="Search candidate names" className="min-h-11 min-w-0 flex-1 rounded-xl border bg-card px-4 text-sm" />
      <button className="min-h-11 rounded-xl border bg-card px-4 text-sm font-semibold hover:bg-muted">Search</button>
    </form>
    {data?.length ? <ul className="grid gap-4 sm:grid-cols-2">{data.map((item) => <li key={item.id} className="rounded-2xl border bg-card p-6">
      <p className="text-xs text-muted-foreground">{item.exercise_content?.exercise_families?.name ?? "Family not classified"}</p>
      <h2 className="mt-2 text-lg font-semibold">{item.exercise_content?.name}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.exercise_content?.short_description}</p>
      <form action={prepareCandidate} className="mt-5"><input type="hidden" name="exerciseId" value={item.id} />
        <button className="rounded-xl border bg-background px-4 py-2.5 text-sm font-semibold">Prepare demonstration</button>
      </form>
    </li>)}</ul> : <p className="rounded-xl border bg-card p-6 text-muted-foreground">{query || page > 1 ? "No candidates on this page." : "All original candidates have been prepared and published."}</p>}
    <ListPagination path="/admin/candidates" page={page} total={count ?? 0} query={query} />
  </div>;
}
