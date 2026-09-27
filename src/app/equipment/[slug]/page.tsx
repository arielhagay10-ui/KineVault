import { TaxonomyLanding } from "@/components/catalog/taxonomy-landing";

export const dynamic = "force-dynamic";

export default async function EquipmentPage({ params }: { params: Promise<{ slug: string }> }) {
  return <TaxonomyLanding kind="equipment" slug={(await params).slug} />;
}
