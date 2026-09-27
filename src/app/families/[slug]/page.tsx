import { TaxonomyLanding } from "@/components/catalog/taxonomy-landing";

export const dynamic = "force-dynamic";

export default async function FamilyPage({ params }: { params: Promise<{ slug: string }> }) {
  return <TaxonomyLanding kind="family" slug={(await params).slug} />;
}
