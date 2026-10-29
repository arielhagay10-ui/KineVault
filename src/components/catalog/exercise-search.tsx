import { Search } from "@/components/ui/icons";
import { primaryActionClass } from "@/components/ui/page-layout";

export function ExerciseSearch({ defaultValue = "" }: { defaultValue?: string }) {
  return <div className="min-w-0">
    <label htmlFor="exercise-search" className="mb-2 block text-sm font-medium">Search exercises</label>
    <div className="flex min-w-0 gap-3">
      <div className="relative min-w-0 flex-1">
        <Search size={17} aria-hidden className="pointer-events-none absolute start-3 top-3.5 text-muted-foreground" />
        <input id="exercise-search" type="search" name="q" maxLength={100} defaultValue={defaultValue} placeholder="Name or alias"
          className="min-h-12 w-full min-w-0 rounded-lg border border-input bg-card py-3 ps-10 pe-3 text-base placeholder:text-muted-foreground focus:border-primary focus:outline-2 focus:outline-ring sm:text-sm" />
      </div>
      <button type="submit" className={`${primaryActionClass} min-h-12 shrink-0`}>Search</button>
    </div>
  </div>;
}
