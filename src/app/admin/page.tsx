import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();
  const statuses = ["submitted", "in_review", "changes_requested", "approved", "rejected", "merged"] as const;
  const counts = await Promise.all(statuses.map((status) => supabase.from("exercise_submissions")
    .select("id", { count: "exact", head: true }).eq("status", status)));
  if (counts.some((result) => result.error)) throw new Error("The review overview could not be loaded");
  return <>
    <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Community moderation</p>
    <h1 className="mt-3 text-4xl font-semibold tracking-tight">Review overview</h1>
    <p className="mt-3 text-sm text-muted-foreground">Review motion, compare classifications, and resolve contributions.</p>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{statuses.map((status, index) => <Link key={status} href={`/admin/submissions?status=${status}`}
      className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/50 hover:bg-accent/30">
      <p className="text-sm capitalize text-muted-foreground">{status.replaceAll("_", " ")}</p><p className="mt-3 text-4xl font-semibold">{counts[index].count ?? 0}</p>
    </Link>)}</div>
  </>;
}
