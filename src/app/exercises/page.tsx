import Link from "next/link";
import { ArrowRight, Dumbbell, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExerciseCards } from "@/components/catalog/exercise-cards";
import { FilterSection } from "@/components/catalog/filter-section";
import { createClient } from "@/lib/supabase/server";
import {
  filterParamNames, nextPageUrl, parseExploreParams, type ExploreCursor, type RawSearchParams,
} from "@/lib/search/params";

export const dynamic = "force-dynamic";

const profileOptions = [
  ["ascending", "Ascending"],
  ["descending", "Descending"],
  ["bell_shaped", "Bell shaped"],
  ["relatively_constant", "Relatively constant"],
  ["variable_complex", "Variable / complex"],
  ["unknown", "Unknown"],
] as const;
const mechanicOptions = [["compound", "Compound"], ["isolation", "Isolation"]] as const;
const forceOptions = [["push", "Push"], ["pull", "Pull"], ["static", "Static"], ["mixed", "Mixed"]] as const;
const lateralityOptions = [["unilateral", "Unilateral"], ["bilateral", "Bilateral"], ["alternating", "Alternating"]] as const;
const peakOptions = [["beginning", "Beginning"], ["middle", "Middle"], ["end", "End"], ["multiple", "Multiple"], ["unknown", "Unknown"]] as const;
const difficultyOptions = [["beginner", "Beginner"], ["intermediate", "Intermediate"], ["advanced", "Advanced"]] as const;
const optionList = (values: readonly (readonly [string, string])[]) => values.map(([slug, name]) => ({ slug, name }));

type Props = { searchParams: Promise<RawSearchParams> };

export default async function ExplorePage({ searchParams }: Props) {
  const params = parseExploreParams(await searchParams);
  if (!params) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-24">
        <h1 className="text-3xl font-semibold">Invalid search filters</h1>
        <p className="mt-3 text-zinc-600">Check the URL parameters and try again.</p>
        <Link className="mt-6 inline-block underline" href="/exercises">Reset filters</Link>
      </main>
    );
  }

  const supabase = await createClient();
  const [results, muscles, joints, actions, families, patterns, planes,
    categories, equipment, attachments, sources, positions] = await Promise.all([
    supabase.rpc("explore_exercises", {
      search_text: params.query || undefined,
      muscle_slugs: params.muscles,
      primary_muscle_slugs: params.primaryMuscles,
      secondary_muscle_slugs: params.secondaryMuscles,
      stabilizer_muscle_slugs: params.stabilizerMuscles,
      joint_slugs: params.joints,
      joint_action_slugs: params.jointActions,
      family_slugs: params.families,
      movement_pattern_slugs: params.movementPatterns,
      plane_slugs: params.planes,
      mechanic_values: params.mechanics,
      force_type_values: params.forceTypes,
      laterality_values: params.lateralities,
      equipment_category_slugs: params.equipmentCategories,
      equipment_slugs: params.equipment,
      attachment_slugs: params.attachments,
      resistance_source_slugs: params.resistanceSources,
      resistance_profiles: params.resistanceProfiles,
      peak_resistance_positions: params.peakPositions,
      body_position_slugs: params.bodyPositions,
      difficulty_values: params.difficulties,
      sort_key: params.sort,
      cursor_name: params.cursor?.name,
      cursor_published_at: params.cursor?.publishedAt,
      cursor_favorite_count: params.cursor?.favoriteCount,
      cursor_id: params.cursor?.id,
      page_size: 24,
    }),
    supabase.from("muscles").select("slug,name").order("name"),
    supabase.from("joints").select("id,slug,name").order("name"),
    supabase.from("joint_actions").select("slug,name,joint_id").order("slug"),
    supabase.from("exercise_families").select("slug,name").order("name"),
    supabase.from("movement_patterns").select("slug,name").order("name"),
    supabase.from("planes_of_motion").select("slug,name").order("name"),
    supabase.from("equipment_categories").select("slug,name").order("name"),
    supabase.from("equipment").select("slug,name").order("name"),
    supabase.from("attachments").select("slug,name").order("name"),
    supabase.from("resistance_sources").select("slug,name").order("name"),
    supabase.from("body_positions").select("slug,name").order("name"),
  ]);

  if ([results, muscles, joints, actions, families, patterns, planes, categories,
    equipment, attachments, sources, positions].some((result) => result.error)) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-24">
        <h1 className="text-3xl font-semibold">Explore is unavailable</h1>
        <p className="mt-3 text-zinc-600">The catalog could not be loaded. Please try again shortly.</p>
      </main>
    );
  }

  const rows = results.data ?? [];
  const visibleRows = rows.slice(0, 24);
  const hasMore = rows.length > 24;
  const last = visibleRows.at(-1);
  let nextCursor: ExploreCursor | null = null;
  if (hasMore && last) {
    nextCursor = { sort: params.sort, id: last.exercise_id };
    if (params.sort === "alphabetical") nextCursor.name = last.normalized_name;
    if (params.sort === "newest") nextCursor.publishedAt = last.published_at;
    if (params.sort === "most_favorited") nextCursor.favoriteCount = last.favorite_count;
  }

  const jointNames = new Map((joints.data ?? []).map((joint) => [joint.id, joint.name]));
  const activeFilterCount = filterParamNames.reduce((count, [field]) => count + params[field].length, 0);

  return (
    <main className="min-h-screen bg-[#f7f8f5] text-[#172a27]">
      <header className="border-b border-[#dce5de] bg-white/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link href="/" className="text-xl font-bold tracking-[-0.05em]">KineVault</Link>
          <Link href="/dashboard" className="text-sm font-medium text-[#4d745c]">My library</Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 pb-20 pt-12 lg:px-10">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#26775b]">Explore the database</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">Find the movement you mean.</h1>
          <p className="mt-4 text-[#63756c]">Search exercises and combine anatomical, equipment, and resistance filters.</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[285px_minmax(0,1fr)]">
          <aside>
            <form action="/exercises" method="get" className="rounded-2xl border border-[#dce5de] bg-white p-5 lg:sticky lg:top-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-semibold"><SlidersHorizontal size={18} /> Filters</h2>
                {activeFilterCount > 0 && <Link href="/exercises" className="text-xs font-medium text-[#26775b]">Clear all</Link>}
              </div>

              <label className="mb-2 block text-sm font-semibold" htmlFor="exercise-search">Search</label>
              <div className="relative mb-5">
                <Search size={17} className="absolute left-3 top-3 text-[#7c8d83]" />
                <input id="exercise-search" name="q" defaultValue={params.query} placeholder="Name or alias"
                  className="w-full rounded-xl border border-[#d6e2d9] bg-[#fafcf9] py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#348965] focus:ring-2 focus:ring-[#cee9d8]" />
              </div>

              <FilterHeading title="Anatomy" />
              <FilterSection title="Any muscle role" name="muscle" options={muscles.data ?? []} selected={params.muscles} />
              <FilterSection title="Primary muscles" name="primaryMuscle" options={muscles.data ?? []} selected={params.primaryMuscles} />
              <FilterSection title="Secondary muscles" name="secondaryMuscle" options={muscles.data ?? []} selected={params.secondaryMuscles} />
              <FilterSection title="Stabilizer muscles" name="stabilizerMuscle" options={muscles.data ?? []} selected={params.stabilizerMuscles} />
              <FilterSection title="Joints" name="joint" options={(joints.data ?? []).map(({ slug, name }) => ({ slug, name }))} selected={params.joints} />
              <details open className="border-t border-[#edf1eb] py-4">
                <summary className="cursor-pointer font-semibold">Joint actions</summary>
                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-2">
                  {(actions.data ?? []).map((action) => (
                    <label key={action.slug} className="flex cursor-pointer items-start gap-2 text-sm text-[#50645a]">
                      <input type="checkbox" name="jointAction" value={action.slug}
                        defaultChecked={params.jointActions.includes(action.slug)} className="mt-0.5 accent-[#26775b]" />
                      <span>{jointNames.get(action.joint_id) ?? "Joint"} {action.name}</span>
                    </label>
                  ))}
                </div>
              </details>
              <FilterHeading title="Movement" />
              <FilterSection title="Exercise families" name="family" options={families.data ?? []} selected={params.families} />
              <FilterSection title="Movement patterns" name="movementPattern" options={patterns.data ?? []} selected={params.movementPatterns} />
              <FilterSection title="Plane of motion" name="plane" options={planes.data ?? []} selected={params.planes} />
              <FilterSection title="Mechanic" name="mechanic" options={optionList(mechanicOptions)} selected={params.mechanics} />
              <FilterSection title="Force type" name="forceType" options={optionList(forceOptions)} selected={params.forceTypes} />
              <FilterSection title="Laterality" name="laterality" options={optionList(lateralityOptions)} selected={params.lateralities} />
              <FilterHeading title="Equipment" />
              <FilterSection title="Equipment category" name="equipmentCategory" options={categories.data ?? []} selected={params.equipmentCategories} />
              <FilterSection title="Equipment" name="equipment" options={equipment.data ?? []} selected={params.equipment} />
              <FilterSection title="Attachments" name="attachment" options={attachments.data ?? []} selected={params.attachments} />
              <FilterHeading title="Biomechanics" />
              <FilterSection title="Resistance source" name="resistanceSource" options={sources.data ?? []} selected={params.resistanceSources} />
              <FilterSection title="Resistance profile" name="resistanceProfile"
                options={profileOptions.map(([slug, name]) => ({ slug, name }))} selected={params.resistanceProfiles} />
              <FilterSection title="Peak resistance" name="peakPosition" options={optionList(peakOptions)} selected={params.peakPositions} />
              <FilterHeading title="Other" />
              <FilterSection title="Body position" name="bodyPosition" options={positions.data ?? []} selected={params.bodyPositions} />
              <FilterSection title="Difficulty" name="difficulty" options={optionList(difficultyOptions)} selected={params.difficulties} />

              <label className="mt-4 block text-sm font-semibold" htmlFor="sort">Sort by</label>
              <select id="sort" name="sort" defaultValue={params.sort}
                className="mt-2 w-full rounded-xl border border-[#d6e2d9] bg-[#fafcf9] px-3 py-2.5 text-sm">
                <option value="alphabetical">Alphabetical</option>
                <option value="newest">Newest</option>
                <option value="most_favorited">Most favorited</option>
              </select>
              <Button type="submit" className="mt-5 w-full">Apply filters <ArrowRight size={16} /></Button>
              <p className="mt-3 text-xs leading-5 text-[#7c8d83]">Every selected value must match.</p>
            </form>
          </aside>

          <section aria-label="Search results">
            <div className="mb-5 flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-[#5e7165]">{visibleRows.length} {visibleRows.length === 1 ? "exercise" : "exercises"} on this page</p>
              {activeFilterCount > 0 && <p className="text-xs text-[#667b6e]">{activeFilterCount} active filters</p>}
            </div>
            {visibleRows.length === 0 ? (
              <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-[#cddbd0] bg-white/70 px-6 text-center">
                <Dumbbell size={30} className="text-[#6d9980]" />
                <h2 className="mt-4 text-xl font-semibold">{params.query || activeFilterCount ? "No matching exercises" : "Demonstrations are being prepared"}</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-[#6d8073]">
                  {params.query || activeFilterCount
                    ? "Try fewer filters or a different exercise name."
                    : "Exercises appear here after their character demonstrations and biomechanics are reviewed."}
                </p>
                {(params.query || activeFilterCount > 0) && (
                  <Link href="/exercises" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#26775b]">
                    <RotateCcw size={15} /> Reset search
                  </Link>
                )}
              </div>
            ) : (
              <ExerciseCards rows={visibleRows} />
            )}
            {nextCursor && (
              <Link href={nextPageUrl(params, nextCursor)}
                className="mt-8 inline-flex items-center gap-2 rounded-xl border border-[#c7d9cc] bg-white px-5 py-3 text-sm font-semibold text-[#285f48] hover:bg-[#eff6ef]">
                Next page <ArrowRight size={16} />
              </Link>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function FilterHeading({ title }: { title: string }) {
  return <h3 className="mt-7 pb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#71917a]">{title}</h3>;
}
