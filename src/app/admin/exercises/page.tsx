import Link from "next/link";
import { z } from "zod";
import { getIdentity } from "@/lib/auth";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PublicationBadge } from "@/components/catalog/publication-badge";

export default async function AdminExercises({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; status?: string }> }) {
  const identity = await getIdentity();
  if (!identity || identity.role === "user") notFound();
  const params = await searchParams;
  const query = params.q?.trim().slice(0, 100) ?? "";
  const page = z.coerce.number().int().min(1).max(10000).catch(1).parse(params.page);
  const status = z.enum(["all", "published", "withdrawn", "community", "reported"]).catch("all").parse(params.status);
  const supabase = await createClient();
  let request = supabase.from("exercises")
    .select(status === "reported"
      ? "id,slug,status,verified_at,exercise_content!inner(name),exercise_reports!inner(id,status)"
      : "id,slug,status,verified_at,exercise_content!inner(name),exercise_reports(id,status)", { count: "exact" })
    .in("status", ["published", "withdrawn"]).eq("exercise_reports.status", "open");
  if (status === "published" || status === "withdrawn") request = request.eq("status", status);
  if (status === "community") request = request.is("verified_at", null).eq("status", "published");
  if (query) request = request.ilike("exercise_content.name", `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
  const { data, error, count } = await request.order("published_at", { ascending: false, nullsFirst: false }).order("id").range((page - 1) * 20, page * 20 - 1);
  if (error) throw new Error("The catalog could not be loaded");
  const url = (target: number) => `/admin/exercises?${new URLSearchParams({ q: query, status, page: String(target) })}`;
  return <div><h1 className="text-3xl font-semibold">Exercise moderation</h1>
    <p className="mt-3 text-sm text-muted-foreground">Review community exercises, verification and reports.</p>
    <form className="my-6 flex flex-wrap gap-3">
      <label htmlFor="catalog-search" className="sr-only">Exercise name</label>
      <input id="catalog-search" name="q" defaultValue={query} maxLength={100} placeholder="Search by name" className="min-h-11 min-w-0 flex-1 rounded-xl border bg-card p-3" />
      <label htmlFor="catalog-status" className="sr-only">Exercise status</label>
      <select id="catalog-status" name="status" defaultValue={status} className="min-h-11 rounded-xl border bg-card p-3"><option value="all">Public and hidden</option><option value="published">Public</option><option value="community">Awaiting verification</option><option value="reported">Open reports</option><option value="withdrawn">Hidden</option></select>
      <button className="min-h-11 rounded-xl border px-5 font-semibold">Search</button>
    </form>
    <ul className="divide-y rounded-2xl border bg-card">{data?.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div><Link href={`/admin/exercises/${item.id}`} className="font-semibold text-primary underline">{item.exercise_content.name}</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3"><PublicationBadge verifiedAt={item.verified_at} />{item.status === "withdrawn" && <span className="text-xs text-muted-foreground">Hidden</span>}{item.exercise_reports.some(report => report.status === "open") && <span className="text-xs font-semibold">Open reports</span>}</div>
      </div>
      <Link href={`/admin/exercises/${item.id}`} className="shrink-0 text-sm font-semibold text-primary">Review exercise</Link>
    </li>)}</ul>
    {!data?.length && <p className="mt-6 text-sm text-muted-foreground">No exercises match.</p>}
    <nav className="mt-6 flex justify-between text-sm font-semibold text-primary" aria-label="Moderation pages">{page > 1 ? <Link href={url(page - 1)}>Previous</Link> : <span />}{(count ?? 0) > page * 20 && <Link href={url(page + 1)}>Next page</Link>}</nav>
  </div>;
}
