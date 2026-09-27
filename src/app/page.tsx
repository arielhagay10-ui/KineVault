import { ArrowUpRight, Orbit, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { CharacterPreview } from "@/components/character/character-preview";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f8f5] text-[#172a27]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-7 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#174a3e] text-[#c6f6de]">
            <Orbit size={23} strokeWidth={1.7} />
          </div>
          <span className="text-xl font-bold tracking-[-0.05em]">KineVault</span>
        </div>
        <Link href="/exercises" className="rounded-full border border-[#cbd9d0] px-4 py-2 text-sm font-medium text-[#355c45] hover:bg-white">Explore exercises</Link>
      </header>

      <section className="mx-auto grid max-w-7xl gap-12 px-6 pb-20 pt-12 lg:grid-cols-[0.83fr_1.17fr] lg:items-center lg:gap-16 lg:px-10 lg:pt-20">
        <div>
          <p className="mb-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#287660]">
            <span className="size-2 rounded-full bg-[#3db886]" />
            The exercise encyclopedia, in motion
          </p>
          <h1 className="max-w-xl text-5xl font-semibold leading-[1.02] tracking-[-0.065em] sm:text-6xl xl:text-7xl">
            Understand every movement.
          </h1>
          <p className="mt-7 max-w-lg text-lg leading-8 text-[#53665d]">
            Explore exercise variations through anatomy, equipment, and
            biomechanics. See how a movement works, then look closer at the
            joints and muscles behind it.
          </p>
          <div className="mt-10 grid max-w-lg gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-2xl border border-[#dce6de] bg-white/80 p-4">
              <Search className="mt-0.5 text-[#26775b]" size={20} />
              <div>
                <p className="font-semibold">Deep search</p>
                <p className="mt-1 text-sm leading-5 text-[#65786e]">Filter by muscle, joint action, equipment, and resistance.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-[#dce6de] bg-white/80 p-4">
              <ShieldCheck className="mt-0.5 text-[#26775b]" size={20} />
              <div>
                <p className="font-semibold">Reviewed knowledge</p>
                <p className="mt-1 text-sm leading-5 text-[#65786e]">Community contributions join the catalog after review.</p>
              </div>
            </div>
          </div>
          <Link href="/exercises" className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-[#33745d] hover:underline">
            Explore reviewed exercises
            <ArrowUpRight size={16} />
          </Link>
        </div>
        <CharacterPreview />
      </section>
    </main>
  );
}
