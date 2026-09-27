import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { getIdentity } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MyExercisesPage() {
  const identity = await getIdentity();
  if (!identity) redirect("/sign-in?next=/my-exercises");
  const supabase = await createClient();
  const { data: exercises, error } = await supabase.from("private_exercises")
    .select("id,updated_at,exercise_content(name,short_description)")
    .eq("owner_id", identity.userId).order("updated_at", { ascending: false });

  return (
    <main className="min-h-screen bg-[#f7f8f5] text-[#172a27]">
      <div className="mx-auto max-w-5xl px-6 pb-20 pt-8">
        <header className="flex items-center justify-between border-b border-[#dce5de] pb-6">
          <Link href="/" className="text-xl font-bold tracking-[-0.05em]">KineVault</Link>
          <Link href="/dashboard" className="flex items-center gap-2 text-sm text-[#3f765b]"><ArrowLeft size={16} /> Dashboard</Link>
        </header>
        <div className="flex flex-wrap items-end justify-between gap-5 py-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#28785f]">Private library</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em]">My exercises</h1>
            <p className="mt-3 text-[#617568]">Your drafts stay private until you decide to share or submit them.</p>
          </div>
          <Link href="/my-exercises/new" className="inline-flex items-center gap-2 rounded-xl bg-[#174a3e] px-5 py-3 text-sm font-semibold text-white hover:bg-[#246a53]"><Plus size={17} /> New exercise</Link>
        </div>
        {error ? <p role="alert" className="text-red-700">Private exercises could not be loaded.</p>
          : exercises?.length ? <div className="grid gap-4 sm:grid-cols-2">
            {exercises.map((item) => (
              <Link key={item.id} href={`/my-exercises/${item.id}/edit`}
                className="group rounded-2xl border border-[#dce5de] bg-white p-6 hover:border-[#a9cbb6] hover:shadow-md">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#6e9079]">Private draft</p>
                <h2 className="mt-2 text-xl font-semibold group-hover:text-[#28785f]">{item.exercise_content?.name ?? "Untitled exercise"}</h2>
                {item.exercise_content?.short_description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#647568]">{item.exercise_content.short_description}</p>}
                <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-[#28785f]">Edit exercise <ArrowRight size={16} /></p>
              </Link>
            ))}
          </div> : <div className="rounded-2xl border border-dashed border-[#cddbd0] bg-white px-6 py-16 text-center">
            <h2 className="text-xl font-semibold">No private exercises yet</h2>
            <p className="mt-2 text-sm text-[#637669]">Create a draft to keep your own exercise variation.</p>
            <Link href="/my-exercises/new" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#28785f]">Create one <ArrowRight size={16} /></Link>
          </div>}
      </div>
    </main>
  );
}
