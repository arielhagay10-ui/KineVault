import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "@/components/ui/icons";
import { ExerciseCards } from "@/components/catalog/exercise-cards";
import { FilterSection } from "@/components/catalog/filter-section";
import { Button } from "@/components/ui/button";
import { parseExploreParams, type RawSearchParams } from "@/lib/search/params";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, PageState, secondaryActionClass } from "@/components/ui/page-layout";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<RawSearchParams> };
const profileOptions = [
  ["ascending", "Ascending"], ["descending", "Descending"],
  ["bell_shaped", "Bell shaped"], ["relatively_constant", "Relatively constant"],
  ["variable_complex", "Variable / complex"], ["unknown", "Unknown"],
] as const;
const difficultyOptions = [["beginner", "Beginner"], ["intermediate", "Intermediate"], ["advanced", "Advanced"]] as const;
const options = (items: readonly (readonly [string, string])[]) => items.map(([slug, name]) => ({ slug, name }));

export default async function JointActionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const raw = await searchParams;
  const filters = parseExploreParams({
    equipment: raw.equipment,
    muscle: raw.muscle,
    resistanceProfile: raw.resistanceProfile,
    bodyPosition: raw.bodyPosition,
    difficulty: raw.difficulty,
  });
  if (!filters) notFound();

  const supabase = await createClient();
  const [actionResult, equipmentResult, musclesResult, positionsResult] = await Promise.all([
    supabase.from("joint_actions").select("name,description,joints(name)").eq("slug", slug).maybeSingle(),
    supabase.from("equipment").select("slug,name").order("name"),
    supabase.from("muscles").select("slug,name").order("name"),
    supabase.from("body_positions").select("slug,name").order("name"),
  ]);
  const action = actionResult.data;
  if (!action) notFound();

  const { data: rows, error } = await supabase.rpc("explore_exercises", {
    joint_action_slugs: [slug],
    equipment_slugs: filters.equipment,
    muscle_slugs: filters.muscles,
    resistance_profiles: filters.resistanceProfiles,
    body_position_slugs: filters.bodyPositions,
    difficulty_values: filters.difficulties,
    page_size: 24,
  });
  const explore = new URLSearchParams({ jointAction: slug });
  for (const item of filters.equipment) explore.append("equipment", item);
  for (const item of filters.muscles) explore.append("muscle", item);
  for (const item of filters.resistanceProfiles) explore.append("resistanceProfile", item);
  for (const item of filters.bodyPositions) explore.append("bodyPosition", item);
  for (const item of filters.difficulties) explore.append("difficulty", item);
  const fullExploreUrl = `/exercises?${explore.toString()}`;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-10 lg:pt-10">
        <PageHeader title={`${action.joints?.name} ${action.name}`}
          description={action.description ?? `A movement at the ${action.joints?.name.toLowerCase() ?? "joint"} classified as ${action.name.toLowerCase()}. Exercise classifications depend on the performed technique and are reviewed individually.`} />
        <div className="grid gap-8 lg:grid-cols-[285px_minmax(0,1fr)]">
          <aside>
            <form action={`/joint-actions/${slug}`} method="get" className="rounded-xl border border-border bg-card p-5 lg:sticky lg:top-6">
              <h2 className="mb-4 font-semibold">Narrow this action</h2>
              <FilterSection title="Equipment" name="equipment" options={equipmentResult.data ?? []} selected={filters.equipment} />
              <FilterSection title="Muscles" name="muscle" options={musclesResult.data ?? []} selected={filters.muscles} />
              <FilterSection title="Resistance profile" name="resistanceProfile" options={options(profileOptions)} selected={filters.resistanceProfiles} />
              <FilterSection title="Body position" name="bodyPosition" options={positionsResult.data ?? []} selected={filters.bodyPositions} />
              <FilterSection title="Difficulty" name="difficulty" options={options(difficultyOptions)} selected={filters.difficulties} />
              <Button type="submit" className="mt-4 w-full">Apply filters <ArrowRight size={16} /></Button>
            </form>
          </aside>
          <section aria-label="Exercises with this joint action">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-xl font-semibold">Exercises</h2>
              <Link href={fullExploreUrl} className={secondaryActionClass}>Full Explore <ArrowRight size={16} /></Link>
            </div>
            {error ? <PageState error title="Exercises could not be loaded" description="Try the full exercise catalog to continue browsing."><Link href={fullExploreUrl} className={secondaryActionClass}>Full Explore</Link></PageState>
              : rows?.length ? <ExerciseCards rows={rows.slice(0, 24)} />
                : <PageState title="No exercises match these filters yet" description="Change a filter or browse the full catalog."><Link href={`/joint-actions/${slug}`} className={secondaryActionClass}>Clear filters</Link><Link href={fullExploreUrl} className={secondaryActionClass}>Full Explore</Link></PageState>}
            {(rows?.length ?? 0) > 24 && <Link href={fullExploreUrl} className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-primary">View more <ArrowRight size={16} /></Link>}
          </section>
        </div>
      </div>
    </main>
  );
}
