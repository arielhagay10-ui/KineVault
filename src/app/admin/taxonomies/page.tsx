import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { TaxonomyForm } from "@/components/moderation/admin-forms";
import { getIdentity } from "@/lib/auth";
import { humanLabel } from "@/lib/moderation/schema";
import { taxonomyNames, taxonomyNameSchema, taxonomyRecordSchema } from "@/lib/moderation/taxonomies";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, PageState, secondaryActionClass } from "@/components/ui/page-layout";

export default async function TaxonomiesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if ((await getIdentity())?.role !== "admin") notFound();
  const query = await searchParams;
  const table = taxonomyNameSchema.catch("muscles").parse(query.table);
  const supabase = await createClient();
  const [records, joints, categories, history] = await Promise.all([
    supabase.from(table).select("*").order("name"), supabase.from("joints").select("id,name").order("name"),
    supabase.from("equipment_categories").select("id,name").order("name"),
    supabase.from("admin_events").select("id,operation,created_at,before_value,after_value").eq("object_type", table).order("created_at", { ascending: false }).limit(10),
  ]);
  if (records.error || joints.error || categories.error || history.error) throw new Error("Taxonomies could not be loaded");
  const rows = (records.data ?? []).map((item) => taxonomyRecordSchema.parse(item));
  const editId = z.uuid().safeParse(query.edit);
  const record = editId.success ? rows.find((item) => item.id === editId.data) ?? null : null;
  return <>
    <PageHeader title="Taxonomy management" description="Keep anatomical joints, actions, muscles, and movement concepts separate. Referenced classifications cannot be deleted." />
    <nav className="flex flex-wrap gap-2" aria-label="Taxonomies">{taxonomyNames.map((name) => <Link key={name} href={`/admin/taxonomies?table=${name}`} aria-current={name === table ? "page" : undefined}
      className={`${secondaryActionClass} capitalize ${name === table ? "border-primary bg-muted" : ""}`}>{humanLabel(name)}</Link>)}</nav>
    <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="min-w-0 rounded-xl border border-border bg-card p-5"><h2 className="text-lg font-semibold capitalize">{humanLabel(table)} ({rows.length})</h2>
        <ul className="mt-4 divide-y divide-border">{rows.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm">
          <div className="min-w-0"><p className="break-words font-medium">{item.name}</p><p className="mt-1 break-all text-xs text-muted-foreground">{item.slug}</p></div>
          <Link href={`/admin/taxonomies?table=${table}&edit=${item.id}`} className="inline-flex min-h-11 shrink-0 items-center font-semibold text-primary underline-offset-4 hover:underline">Edit</Link>
        </li>)}</ul>{!rows.length && <PageState title="No classifications yet" description="Use the form to add the first classification." />}
      </section>
      <section className="h-fit min-w-0 rounded-xl border border-border bg-card p-5"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-semibold">{record ? "Edit classification" : "New classification"}</h2>
        {record && <Link href={`/admin/taxonomies?table=${table}`} className="text-xs font-semibold text-primary">Add new</Link>}</div>
        <TaxonomyForm key={`${table}-${record?.id ?? "new"}`} table={table} record={record} parents={rows} joints={joints.data ?? []} categories={categories.data ?? []} />
      </section>
    </div>
    <details className="mt-6 rounded-2xl border border-border bg-card p-5"><summary className="cursor-pointer text-sm font-semibold">Recent admin audit history</summary>
      <ul className="mt-4 space-y-3 text-xs text-muted-foreground">{history.data?.map((event) => <li key={event.id}>{event.operation.toLowerCase()} · {new Date(event.created_at).toLocaleString()}</li>)}</ul>
    </details>
  </>;
}
