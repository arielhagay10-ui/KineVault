import Link from "next/link";
import { redirect } from "next/navigation";
import { ListPagination } from "@/components/catalog/list-pagination";
import { parseListPage, substringPattern } from "@/lib/search/list-page";
import type { RawSearchParams } from "@/lib/search/params";
import { getIdentity } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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

  return <main className="min-h-screen bg-background px-6 py-10 text-foreground">
    <div className="mx-auto max-w-4xl">
      <header className="flex items-center justify-between border-b border-border pb-6">
        <Link href="/" className="text-xl font-bold tracking-[-0.05em]">KineVault</Link>
        <Link href="/dashboard" className="text-sm font-medium text-primary">Dashboard</Link>
      </header>
      <p className="mt-10 text-xs font-bold uppercase tracking-[0.18em] text-primary">Community contributions</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-[-0.055em]">My submissions</h1>
      <p className="mt-3 text-sm text-muted-foreground">Track review progress and requests for changes.</p>
      <form method="get" className="mt-6 flex gap-3">
        <label className="sr-only" htmlFor="submission-search">Search submissions</label>
        <input id="submission-search" name="q" defaultValue={query} placeholder="Search by exercise name" className="min-h-11 min-w-0 flex-1 rounded-xl border bg-card px-4 text-sm" />
        <button className="min-h-11 rounded-xl border bg-card px-4 text-sm font-semibold hover:bg-muted">Search</button>
      </form>
      {error ? <p role="alert" className="mt-8 text-destructive">Submissions could not be loaded.</p>
        : submissions?.length ? <div className="mt-8 space-y-3">{submissions.map((item) => <Link key={item.id}
          href={`/submissions/${item.id}`} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring">
          <div><h2 className="font-semibold">{item.content?.name ?? "Exercise submission"}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : "Draft"}{item.revision_of_id ? " · Revision" : ""}</p></div>
          <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold capitalize text-muted-foreground">{item.status.replaceAll("_", " ")}</span>
        </Link>)}</div>
          : <div className="mt-8 rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
            <h2 className="text-xl font-semibold">{query || page > 1 ? "No submissions on this page" : "No submissions yet"}</h2>
            <p className="mt-2 text-sm text-muted-foreground">Create a private exercise and send a reviewed copy to the community.</p>
            <Link href="/my-exercises" className="mt-5 inline-block text-sm font-semibold text-primary underline">Go to my exercises</Link>
          </div>}
      {!error && <ListPagination path="/submissions" page={page} total={count ?? 0} query={query} />}
    </div>
  </main>;
}
