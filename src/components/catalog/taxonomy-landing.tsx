import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "@/components/ui/icons";
import { ExerciseCards } from "@/components/catalog/exercise-cards";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, PageState, secondaryActionClass } from "@/components/ui/page-layout";

type Kind = "family" | "muscle" | "joint" | "equipment";

export async function TaxonomyLanding({ kind, slug }: { kind: Kind; slug: string }) {
  const supabase = await createClient();
  const recordResult = kind === "family"
    ? await supabase.from("exercise_families").select("name,description").eq("slug", slug).maybeSingle()
    : kind === "muscle"
      ? await supabase.from("muscles").select("name,description").eq("slug", slug).maybeSingle()
      : kind === "joint"
        ? await supabase.from("joints").select("name,description").eq("slug", slug).maybeSingle()
        : await supabase.from("equipment").select("name,description").eq("slug", slug).maybeSingle();
  const record = recordResult.data;
  if (!record) notFound();

  const filterName = kind === "family" ? "family" : kind;
  const filterArgs = kind === "family" ? { family_slugs: [slug] }
    : kind === "muscle" ? { muscle_slugs: [slug] }
      : kind === "joint" ? { joint_slugs: [slug] } : { equipment_slugs: [slug] };
  const { data: rows, error } = await supabase.rpc("explore_exercises", { ...filterArgs, page_size: 24 });
  const exploreUrl = `/exercises?${new URLSearchParams({ [filterName]: slug }).toString()}`;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-10 lg:pt-10">
        <PageHeader title={record.name}
          description={record.description ?? `Explore reviewed exercises associated with ${record.name.toLowerCase()}. Each variation keeps its own equipment and biomechanics.`}
          actions={<Link href={exploreUrl} className={secondaryActionClass}>Open all filters <ArrowRight size={16} /></Link>} />
        {error ? <PageState error title="Exercises could not be loaded" description="Try the full exercise catalog to continue browsing."><Link href={exploreUrl} className={secondaryActionClass}>Open all filters <ArrowRight size={16} /></Link></PageState>
          : rows?.length ? <ExerciseCards rows={rows.slice(0, 24)} />
            : <PageState title="No exercises yet" description="Reviewed exercises for this classification will appear here."><Link href={exploreUrl} className={secondaryActionClass}>Open all filters <ArrowRight size={16} /></Link></PageState>}
        {(rows?.length ?? 0) > 24 && <Link href={exploreUrl} className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-primary">View more <ArrowRight size={16} /></Link>}
      </div>
    </main>
  );
}
