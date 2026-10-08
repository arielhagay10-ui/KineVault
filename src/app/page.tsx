import { ArrowUpRight, BookOpen } from "@/components/ui/icons";
import Link from "next/link";
import { CharacterPreview } from "@/components/character/character-preview";

export default function Home() {
  return <main className="min-h-screen bg-background text-foreground">
    <section className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 py-12 sm:py-20 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-16 lg:px-10">
      <div>
        <Link href="/" className="mb-10 inline-block text-xl font-bold text-primary">KineVault</Link>
        <h1 className="max-w-xl text-[2.5rem] font-semibold leading-[1.15] tracking-[-0.03em] sm:text-[3.25rem]">Understand every movement.</h1>
        <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">Find exercises by muscle, movement, or equipment. Save your favorites and create your own.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/exercises" className="inline-flex min-h-12 items-center gap-3 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Explore exercises <ArrowUpRight size={16} /></Link>
          <Link href="/dashboard" className="inline-flex min-h-12 items-center gap-3 rounded-lg border border-input px-5 py-3 text-sm font-semibold text-primary hover:bg-muted"><BookOpen size={16} /> My library</Link>
        </div>
      </div>
      <CharacterPreview />
    </section>
  </main>;
}
