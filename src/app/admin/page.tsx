import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

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

    <h1 className="mt-3 text-4xl font-semibold tracking-tight">Review overview</h1>
    <p className="mt-3 text-sm text-muted-foreground">Review motion, compare classifications, and resolve contributions.</p>
    <Link href="/admin/exercises" className="mt-6 block rounded-2xl border border-border bg-card p-6 hover:border-primary/50">
      <h2 className="text-xl font-semibold text-primary">Community exercises</h2>
      <p className="mt-2 text-sm text-muted-foreground">Verify public exercises and review reports. {reports.count ?? 0} open reports.</p>
    </Link>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{statuses.map((status, index) => <Link key={status} href={`/admin/submissions?status=${status}`}
      className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/50 hover:bg-accent/30">
      <p className="text-sm capitalize text-muted-foreground">{status.replaceAll("_", " ")}</p><p className="mt-3 text-4xl font-semibold">{counts[index].count ?? 0}</p>
    </Link>)}</div>
  </>;
}
