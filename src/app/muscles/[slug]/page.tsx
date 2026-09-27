import { TaxonomyLanding } from "@/components/catalog/taxonomy-landing";

export const dynamic = "force-dynamic";

export default async function MusclePage({ params }: { params: Promise<{ slug: string }> }) {
  return <TaxonomyLanding kind="muscle" slug={(await params).slug} />;
}
