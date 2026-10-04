import { ArrowUpRight, BookOpen, Orbit, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { CharacterPreview } from "@/components/character/character-preview";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-4 px-6 py-5 sm:py-7 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Orbit size={23} strokeWidth={1.7} />
          </div>
          <span className="text-xl font-bold tracking-[-0.05em]">KineVault</span>
        </div>
        <nav aria-label="Main navigation" className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-start">
          <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-[8px] border border-input bg-card px-4 py-2 text-sm font-semibold text-primary hover:bg-muted"><BookOpen size={17} aria-hidden />My library</Link>
          <Link href="/exercises" className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full border border-border px-4 py-2 text-sm font-medium text-primary hover:border-primary/50 hover:bg-card">Explore exercises</Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 pb-14 pt-7 sm:gap-12 sm:pt-10 lg:grid-cols-[0.83fr_1.17fr] lg:items-center lg:gap-16 lg:px-10">
        <div>
          <p className="mb-5 text-[0.8125rem] font-medium text-primary">
            The exercise encyclopedia, in motion
          </p>
          <h1 className="max-w-xl text-[2.5625rem] font-semibold leading-[1.1] tracking-[-0.05em] sm:text-[3.375rem] sm:leading-[1.09]">
            Understand every movement.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-[1.7] text-muted-foreground sm:text-[1.0625rem]">
            Explore exercise variations through anatomy, equipment, and
            biomechanics. See how a movement works, then look closer at the
            joints and muscles behind it.
          </p>
          <div className="mt-7 grid max-w-lg gap-5 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <Search className="mt-0.5 shrink-0 text-primary" size={20} aria-hidden />
              <div>
                <p className="font-semibold">Deep search</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">Filter by muscle, joint action, equipment, and resistance.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 shrink-0 text-primary" size={20} aria-hidden />
              <div>
                <p className="font-semibold">Reviewed knowledge</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">Community contributions join the catalog after review.</p>
              </div>
            </div>
          </div>
          <Link href="/exercises" className="mt-7 inline-flex min-h-12 items-center gap-2.5 rounded-[8px] bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            Explore reviewed exercises
            <ArrowUpRight size={16} />
          </Link>
        </div>
        <CharacterPreview />
      </section>
    </main>
  );
}
