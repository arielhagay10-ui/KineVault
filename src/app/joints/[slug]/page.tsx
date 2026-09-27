import { TaxonomyLanding } from "@/components/catalog/taxonomy-landing";

export const dynamic = "force-dynamic";

export default async function JointPage({ params }: { params: Promise<{ slug: string }> }) {
  return <TaxonomyLanding kind="joint" slug={(await params).slug} />;
}
