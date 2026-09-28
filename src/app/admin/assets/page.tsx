import { notFound } from "next/navigation";
import { AssetAvailabilityForm } from "@/components/moderation/admin-forms";
import { getIdentity } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AssetsPage() {
  if ((await getIdentity())?.role !== "admin") notFound();
  const supabase = await createClient();
  const [rigs, assets] = await Promise.all([
    supabase.from("rigs").select("id,name,version,active,license_name,source_storage_path").order("name"),
    supabase.from("equipment_assets").select("id,slug,version,active,license_name,source_storage_path,equipment(name),attachments(name)").order("slug"),
  ]);
  if (rigs.error || assets.error) throw new Error("The asset library could not be loaded");
  return <>
    <h1 className="text-3xl font-semibold tracking-tight">Approved asset library</h1>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-[#617568]">Enable or retire reviewed asset versions. Retirement removes new selection; saved scenes and published demonstrations keep their original version. New source definitions require a reviewed migration and renderer support.</p>
    <div className="mt-7 grid gap-4 md:grid-cols-2">{[...(rigs.data ?? []).map((item) => ({ ...item, label: item.name, table: "rigs" as const })),
      ...(assets.data ?? []).map((item) => ({ ...item, label: item.equipment?.name ?? item.attachments?.name ?? item.slug, table: "equipment_assets" as const }))].map((item) => <section key={item.id} className="rounded-2xl border border-[#dce5de] bg-white p-5">
        <h2 className="text-lg font-semibold">{item.label}</h2><p className="mt-2 text-sm text-[#617568]">Version {item.version} · {item.active ? "Active" : "Retired"} · {item.license_name}</p>
        <p className="my-4 break-all text-xs text-[#617568]">{item.source_storage_path}</p><AssetAvailabilityForm table={item.table} id={item.id} active={item.active} />
      </section>)}</div>
  </>;
}
