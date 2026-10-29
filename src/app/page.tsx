import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "@/components/ui/icons";
import { ExerciseCards } from "@/components/catalog/exercise-cards";
import { ExerciseSearch } from "@/components/catalog/exercise-search";
import { secondaryActionClass } from "@/components/ui/page-layout";
import { createClient } from "@/lib/supabase/server";

export default function Home() {
  return <main className="mx-auto max-w-7xl space-y-12 px-4 py-8 sm:space-y-14 lg:px-10 lg:py-16">
    <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-16">
      <div className="min-w-0 space-y-5">
        <h1 className="max-w-3xl text-[2rem] font-semibold leading-tight tracking-[-0.025em] sm:text-5xl sm:leading-[1.16]">Find the exercise<br className="hidden sm:block" /> you&apos;re looking for.</h1>
          <p className="text-base leading-6 text-muted-foreground">Search by name, or browse by muscle, equipment, and joint action.</p>
        <form action="/exercises" method="get" role="search" aria-label="Exercise search"><ExerciseSearch /></form>
        <div><p className="mb-3 text-xs text-muted-foreground">Try a topic</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/exercises?muscle=lateral-deltoid" className={secondaryActionClass}>Lateral deltoid</Link>
            <Link href="/exercises?equipment=cable" className={secondaryActionClass}>Cable</Link>
            <Link href="/exercises?jointAction=shoulder-abduction" className={secondaryActionClass}>Shoulder abduction</Link>
          </div>
        </div>
      </div>
      <div className="hidden lg:block"><Image src="/posters/home-mascot.png" alt="Blue mascot wearing glasses and holding a pencil and notebook" width={1254} height={1254} sizes="240px" className="h-[260px] w-60 object-contain" /></div>
    </section>
    <section aria-labelledby="browse-heading">
      <h2 id="browse-heading" className="mb-5 text-xl font-semibold">Browse the encyclopedia</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["muscle", "By muscle", "Find the anatomy you want to train."],
          ["equipment", "By equipment", "Explore movements for your equipment."],
          ["jointAction", "By joint action", "Find exercises by how the body moves."],
        ].map(([filter, title, description]) => <Link key={filter} href={`/exercises?browse=${filter}#filter-${filter}`} className="rounded-xl border border-border bg-card p-5 hover:border-primary/50">
          <h3 className="flex items-center gap-2 text-xl font-semibold text-primary">{title}<ArrowRight size={16} aria-hidden /></h3>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">{description}</p>
        </Link>)}
      </div>
    </section>
    <Suspense fallback={null}><HomeExercises /></Suspense>
    <div className="flex items-center gap-4 rounded-xl bg-card p-4 lg:hidden"><Image src="/posters/home-mascot.png" alt="Blue mascot wearing glasses and holding a pencil and notebook" width={1254} height={1254} sizes="96px" className="h-28 w-24 shrink-0 object-contain" /><p className="text-sm leading-5 text-muted-foreground">Understand movement.<br />Build your own library.</p></div>
    <footer className="border-t border-border pt-8 text-xs text-muted-foreground">KineVault · Exercise encyclopedia</footer>
  </main>;
}

async function HomeExercises() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("explore_exercises", { page_size: 3 });
  if (error || !data?.length) return null;
  return <section aria-labelledby="library-preview-heading"><h2 id="library-preview-heading" className="mb-5 text-xl font-semibold">From the exercise library</h2><ExerciseCards rows={data.slice(0, 3)} presentation="teaching" /></section>;
}
