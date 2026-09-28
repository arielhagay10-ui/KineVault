import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { TaxonomyForm } from "@/components/moderation/admin-forms";
import { getIdentity } from "@/lib/auth";
import { humanLabel } from "@/lib/moderation/schema";
import { taxonomyNames, taxonomyNameSchema, taxonomyRecordSchema } from "@/lib/moderation/taxonomies";
import { createClient } from "@/lib/supabase/server";

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
    <h1 className="text-3xl font-semibold tracking-tight">Taxonomy management</h1>
    <p className="mt-3 text-sm text-[#617568]">Keep anatomical joints, actions, muscles, and movement concepts separate. Referenced classifications cannot be deleted.</p>
    <nav className="mt-6 flex flex-wrap gap-2" aria-label="Taxonomies">{taxonomyNames.map((name) => <Link key={name} href={`/admin/taxonomies?table=${name}`}
      className={`rounded-lg border px-3 py-2 text-xs capitalize ${name === table ? "border-[#28785f] bg-[#edf5ee]" : "border-[#dce5de] bg-white"}`}>{humanLabel(name)}</Link>)}</nav>
    <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="rounded-2xl border border-[#dce5de] bg-white p-5"><h2 className="text-lg font-semibold capitalize">{humanLabel(table)} ({rows.length})</h2>
        <ul className="mt-4 divide-y divide-[#edf1eb]">{rows.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm">
          <div><p className="font-medium">{item.name}</p><p className="mt-1 text-xs text-[#617568]">{item.slug}</p></div>
          <Link href={`/admin/taxonomies?table=${table}&edit=${item.id}`} className="font-semibold text-[#28785f]">Edit</Link>
        </li>)}</ul>
      </section>
      <section className="h-fit rounded-2xl border border-[#dce5de] bg-white p-5"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-semibold">{record ? "Edit classification" : "New classification"}</h2>
        {record && <Link href={`/admin/taxonomies?table=${table}`} className="text-xs font-semibold text-[#28785f]">Add new</Link>}</div>
        <TaxonomyForm key={`${table}-${record?.id ?? "new"}`} table={table} record={record} parents={rows} joints={joints.data ?? []} categories={categories.data ?? []} />
      </section>
    </div>
    <details className="mt-6 rounded-2xl border border-[#dce5de] bg-white p-5"><summary className="cursor-pointer text-sm font-semibold">Recent admin audit history</summary>
      <ul className="mt-4 space-y-3 text-xs text-[#617568]">{history.data?.map((event) => <li key={event.id}>{event.operation.toLowerCase()} · {new Date(event.created_at).toLocaleString()}</li>)}</ul>
    </details>
  </>;
}
