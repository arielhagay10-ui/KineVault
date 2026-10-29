import { notFound } from "next/navigation";
import { AssetAvailabilityForm } from "@/components/moderation/admin-forms";
import { getIdentity } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, PageState } from "@/components/ui/page-layout";

export default async function AssetsPage() {
  if ((await getIdentity())?.role !== "admin") notFound();
  const supabase = await createClient();
  const [rigs, assets] = await Promise.all([
    supabase.from("rigs").select("id,name,version,active,license_name,source_storage_path").order("name"),
    supabase.from("equipment_assets").select("id,slug,version,active,license_name,source_storage_path,equipment(name),attachments(name)").order("slug"),
  ]);
  if (rigs.error || assets.error) throw new Error("The asset library could not be loaded");
  return <>
    <PageHeader title="Approved asset library" description="Enable or retire reviewed asset versions. Retirement removes new selection; saved scenes and published demonstrations keep their original version. New source definitions require a reviewed migration and renderer support." />
    <div className="grid gap-4 md:grid-cols-2">{[...(rigs.data ?? []).map((item) => ({ ...item, label: item.name, table: "rigs" as const })),
      ...(assets.data ?? []).map((item) => ({ ...item, label: item.equipment?.name ?? item.attachments?.name ?? item.slug, table: "equipment_assets" as const }))].map((item) => <section key={item.id} className="min-w-0 rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">{item.label}</h2><p className="mt-2 text-sm text-muted-foreground">Version {item.version} · {item.active ? "Active" : "Retired"} · {item.license_name}</p>
        <p className="my-4 break-all text-xs text-muted-foreground">{item.source_storage_path}</p><AssetAvailabilityForm table={item.table} id={item.id} active={item.active} />
      </section>)}</div>
    {!rigs.data?.length && !assets.data?.length && <PageState title="No approved assets yet" description="Reviewed asset versions will appear here." />}
  </>;
}
