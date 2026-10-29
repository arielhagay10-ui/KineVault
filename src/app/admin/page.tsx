import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, secondaryActionClass } from "@/components/ui/page-layout";

export default async function AdminPage() {
  const supabase = await createClient();
  const statuses = ["submitted", "in_review", "changes_requested", "approved", "rejected", "merged"] as const;
  const [counts, reports] = await Promise.all([
    Promise.all(statuses.map((status) => supabase.from("exercise_submissions")
      .select("id", { count: "exact", head: true }).eq("status", status))),
    supabase.from("exercise_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  if (reports.error || counts.some((result) => result.error)) throw new Error("The review overview could not be loaded");
  return <>
    <PageHeader title="Review overview" description="Review motion, compare classifications, and resolve contributions." />
    <section aria-labelledby="community-heading" className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-border bg-card p-6">
      <div><h2 id="community-heading" className="text-xl font-semibold">Community exercises</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Verify public exercises and review reports. {reports.count ?? 0} open reports.</p></div>
      <Link href="/admin/exercises" className={secondaryActionClass}>Review exercises</Link>
    </section>
    <section aria-labelledby="submissions-heading" className="mt-9">
      <h2 id="submissions-heading" className="text-xl font-semibold">Submission queue</h2>
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">{statuses.map((status, index) => <li key={status}>
        <Link href={`/admin/submissions?status=${status}`} className="flex min-h-16 items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring">
          <span className="text-sm font-semibold capitalize">{status.replaceAll("_", " ")}</span><span className="min-w-10 text-right text-lg font-semibold tabular-nums text-primary">{counts[index].count ?? 0}</span>
        </Link>
      </li>)}</ul>
    </section>
  </>;
}
