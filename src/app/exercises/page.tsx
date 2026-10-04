import Link from "next/link";
import { ArrowRight, BookOpen, Dumbbell, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExerciseCards } from "@/components/catalog/exercise-cards";
import { FilterSection } from "@/components/catalog/filter-section";
import { MobileFilters } from "@/components/catalog/mobile-filters";
import { createClient } from "@/lib/supabase/server";
import { loadTaxonomyOptions } from "@/lib/taxonomy-options";
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
        <p className="mt-3 text-muted-foreground">Check the URL parameters and try again.</p>
        <Link className="mt-6 inline-block underline" href="/exercises">Reset filters</Link>
      </main>
    );
  }

  const supabase = await createClient();
  const [results, options] = await Promise.all([
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
    loadTaxonomyOptions(),
  ]);

  if (results.error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-24">
        <h1 className="text-3xl font-semibold">Explore is unavailable</h1>
        <p className="mt-3 text-muted-foreground">The catalog could not be loaded. Please try again shortly.</p>
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

  const activeFilterCount = filterParamNames.reduce((count, [field]) => count + params[field].length, 0);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3.5 lg:px-10">
          <Link href="/" className="text-xl font-bold tracking-[-0.05em]">KineVault</Link>
          <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-[8px] border border-input px-4 py-2 text-sm font-semibold text-primary hover:bg-muted"><BookOpen size={17} aria-hidden />My library</Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 pb-20 pt-7 sm:pt-8 lg:px-10">
        <div className="mb-7 max-w-2xl">
          <p className="text-[0.8125rem] font-medium text-primary">Explore the database</p>
          <h1 className="mt-2 text-[1.9375rem] font-semibold leading-[1.16] tracking-[-0.035em] sm:text-[2.375rem] sm:leading-[1.15]">Find the movement you mean.</h1>
          <p className="mt-3 text-[0.9375rem] leading-[1.65] text-muted-foreground">Search exercises and combine anatomical, equipment, and resistance filters.</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[285px_minmax(0,1fr)]">
          <aside>
            <MobileFilters count={activeFilterCount}>
            <form action="/exercises" method="get" className="flex flex-col rounded-[12px] border border-border bg-card shadow-[0_2px_5px_rgb(36_58_78/0.025)] lg:sticky lg:top-6 lg:max-h-[max(20rem,calc(100dvh-300px))]">
              <div className="min-h-0 max-h-[52dvh] overflow-y-auto p-5 [scrollbar-gutter:stable] lg:max-h-none lg:flex-1">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-semibold"><SlidersHorizontal size={18} /> Filters</h2>
                {activeFilterCount > 0 && <Link href="/exercises" className="text-xs font-medium text-primary">Clear all</Link>}
              </div>

              <label className="mb-2 block text-sm font-semibold" htmlFor="exercise-search">Search</label>
              <div className="relative mb-5">
                <Search size={17} className="absolute left-3 top-3 text-muted-foreground" />
                <input id="exercise-search" name="q" defaultValue={params.query} placeholder="Name or alias"
                  className="min-h-11 w-full rounded-[8px] border border-input bg-card py-2.5 pl-10 pr-3 text-sm placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring" />
              </div>

              <FilterSection title="Any muscle role" name="muscle" options={options.muscles} selected={params.muscles} />
              <FilterSection title="Joints" name="joint" options={(options.joints).map(({ slug, name }) => ({ slug, name }))} selected={params.joints} />
              <FilterSection title="Exercise families" name="family" options={options.families} selected={params.families} />
              <FilterHeading title="Equipment" />
              <FilterSection title="Equipment" name="equipment" options={options.equipment} selected={params.equipment} />
              <FilterSection title="Joint actions" name="jointAction" options={options.jointActions} selected={params.jointActions} defaultOpen />
              <details open={filterParamNames.some(([field]) => !["muscles", "joints", "jointActions", "equipment", "families"].includes(field) && params[field].length > 0)} className="border-t border-border py-1.5">
                <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold">Advanced classifications</summary>
                <div className="mt-2">
              <FilterHeading title="Anatomy" />
              <FilterSection title="Primary muscles" name="primaryMuscle" options={options.muscles} selected={params.primaryMuscles} />
              <FilterSection title="Secondary muscles" name="secondaryMuscle" options={options.muscles} selected={params.secondaryMuscles} />
              <FilterSection title="Stabilizer muscles" name="stabilizerMuscle" options={options.muscles} selected={params.stabilizerMuscles} />
              <FilterHeading title="Movement" />
              <FilterSection title="Movement patterns" name="movementPattern" options={options.movementPatterns} selected={params.movementPatterns} />
              <FilterSection title="Plane of motion" name="plane" options={options.planes} selected={params.planes} />
              <FilterSection title="Mechanic" name="mechanic" options={optionList(mechanicOptions)} selected={params.mechanics} />
              <FilterSection title="Force type" name="forceType" options={optionList(forceOptions)} selected={params.forceTypes} />
              <FilterSection title="Laterality" name="laterality" options={optionList(lateralityOptions)} selected={params.lateralities} />
              <FilterSection title="Equipment category" name="equipmentCategory" options={options.equipmentCategories} selected={params.equipmentCategories} />
              <FilterSection title="Attachments" name="attachment" options={options.attachments} selected={params.attachments} />
              <FilterHeading title="Biomechanics" />
              <FilterSection title="Resistance source" name="resistanceSource" options={options.resistanceSources} selected={params.resistanceSources} />
              <FilterSection title="Resistance profile" name="resistanceProfile"
                options={profileOptions.map(([slug, name]) => ({ slug, name }))} selected={params.resistanceProfiles} />
              <FilterSection title="Peak resistance" name="peakPosition" options={optionList(peakOptions)} selected={params.peakPositions} />
              <FilterHeading title="Other" />
              <FilterSection title="Body position" name="bodyPosition" options={options.bodyPositions} selected={params.bodyPositions} />
              <FilterSection title="Difficulty" name="difficulty" options={optionList(difficultyOptions)} selected={params.difficulties} />

                </div>
              </details>
              <label className="mt-4 block text-sm font-semibold" htmlFor="sort">Sort by</label>
              <select id="sort" name="sort" defaultValue={params.sort}
                className="mt-2 min-h-11 w-full rounded-[8px] border border-input bg-card px-3 py-2.5 text-sm">
                <option value="alphabetical">Alphabetical</option>
                <option value="newest">Newest</option>
                <option value="most_favorited">Most favorited</option>
              </select>
              </div>
              <div className="shrink-0 rounded-b-[12px] border-t bg-card px-5 py-4">
                <Button type="submit" className="min-h-11 w-full">Apply filters <ArrowRight size={16} /></Button>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Every selected value must match.</p>
              </div>
            </form>
            </MobileFilters>
          </aside>

          <section aria-label="Search results">
            {activeFilterCount > 0 && <ul aria-label="Selected filters" className="mb-5 flex flex-wrap gap-2">
              {filterParamNames.flatMap(([field, name]) => params[field].map(value => {
                const taxonomy = options[field as keyof typeof options];
                const label = taxonomy?.find(option => option.slug === value)?.name ?? value.replaceAll("_", " ").replaceAll("-", " ");
                const query = new URLSearchParams();
                if (params.query) query.set("q", params.query);
                if (params.sort !== "alphabetical") query.set("sort", params.sort);
                for (const [otherField, otherName] of filterParamNames) for (const selected of params[otherField]) {
                  if (otherName !== name || selected !== value) query.append(otherName, selected);
                }
                return <li key={`${name}-${value}`}><Link href={`/exercises?${query}`} aria-label={`Remove ${label} filter`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border bg-card px-3 text-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">{label}<span aria-hidden>×</span></Link></li>;
              }))}
            </ul>}
            <div className="mb-5 flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-foreground">{visibleRows.length} {visibleRows.length === 1 ? "exercise" : "exercises"} on this page</p>
              {activeFilterCount > 0 && <p className="text-xs text-muted-foreground">{activeFilterCount} active filters</p>}
            </div>
            {visibleRows.length === 0 ? (
              <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/70 px-6 text-center">
                <Dumbbell size={30} className="text-muted-foreground" />
                <h2 className="mt-4 text-xl font-semibold">{params.query || activeFilterCount ? "No matching exercises" : "Demonstrations are being prepared"}</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  {params.query || activeFilterCount
                    ? "Try fewer filters or a different exercise name."
                    : "Exercises appear here after their character demonstrations and biomechanics are reviewed."}
                </p>
                {(params.query || activeFilterCount > 0) && (
                  <Link href="/exercises" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                    <RotateCcw size={15} /> Reset search
                  </Link>
                )}
              </div>
            ) : (
              <ExerciseCards rows={visibleRows} />
            )}
            {nextCursor && (
              <Link href={nextPageUrl(params, nextCursor)}
                className="mt-8 inline-flex items-center gap-2 rounded-[12px] border border-border bg-card px-5 py-3 text-sm font-semibold text-primary hover:bg-muted">
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
  return <h3 className="mt-[18px] pb-2 text-[0.8125rem] font-semibold text-muted-foreground">{title}</h3>;
}
