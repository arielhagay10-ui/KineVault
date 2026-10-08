import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "@/components/ui/icons";
import { ExerciseCards } from "@/components/catalog/exercise-cards";
import { createClient } from "@/lib/supabase/server";

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
      <div className="mx-auto max-w-7xl px-6 pb-20 pt-8 lg:px-10">
        <div className="max-w-3xl pb-10 pt-12">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{kind === "family" ? "Exercise family" : kind}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">{record.name}</h1>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            {record.description ?? `Explore reviewed exercises associated with ${record.name.toLowerCase()}. Each variation keeps its own equipment and biomechanics.`}
          </p>
          <Link href={exploreUrl} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary">
            Open all filters <ArrowRight size={16} />
          </Link>
        </div>
        {error ? <p className="text-sm text-red-700 dark:text-red-300">Exercises could not be loaded.</p>
          : rows?.length ? <ExerciseCards rows={rows.slice(0, 24)} />
            : <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center text-muted-foreground">No reviewed demonstrations yet.</div>}
        {(rows?.length ?? 0) > 24 && <Link href={exploreUrl} className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-primary">View more <ArrowRight size={16} /></Link>}
      </div>
    </main>
  );
}
