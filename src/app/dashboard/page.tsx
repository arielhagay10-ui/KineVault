import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Heart, Plus } from "lucide-react";
import { signOut } from "@/app/sign-in/actions";
import { getIdentity } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const identity = await getIdentity();
  if (!identity) redirect("/sign-in?next=/dashboard");
  const supabase = await createClient();
  const [favorites, privateCount] = await Promise.all([
    supabase.from("favorites").select("exercise_id,exercises(slug,current_content_id)")
      .eq("user_id", identity.userId).order("created_at", { ascending: false }),
    supabase.from("private_exercises").select("id", { count: "exact", head: true }).eq("owner_id", identity.userId),
  ]);
  const contentIds = (favorites.data ?? []).map((item) => item.exercises?.current_content_id).filter((id): id is string => Boolean(id));
  const { data: names } = contentIds.length
    ? await supabase.from("exercise_content").select("id,name").in("id", contentIds)
    : { data: [] };
  const nameById = new Map((names ?? []).map((item) => [item.id, item.name]));

  return (
    <main className="min-h-screen bg-[#f7f8f5] text-[#172a27]">
      <div className="mx-auto max-w-5xl px-6 pb-20 pt-8">
        <header className="flex items-center justify-between border-b border-[#dce5de] pb-6">
          <Link href="/" className="text-xl font-bold tracking-[-0.05em]">KineVault</Link>
          <form action={signOut}><button type="submit" className="text-sm font-medium text-[#526b5b] hover:underline">Sign out</button></form>
        </header>
        <div className="pt-12">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#28785f]">Your account</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em]">Your exercise library</h1>
          <p className="mt-3 text-[#617568]">Save movements you use, build private variations, and share a view link with friends.</p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <Link href="/my-exercises" className="rounded-2xl border border-[#dce5de] bg-white p-6 hover:border-[#a9cbb6]">
            <Plus size={22} className="text-[#28785f]" />
            <h2 className="mt-4 text-xl font-semibold">Private exercises</h2>
            <p className="mt-1 text-sm text-[#627568]">{privateCount.count ?? 0} drafts</p>
            <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-[#28785f]">Open my exercises <ArrowRight size={16} /></p>
          </Link>
          <div className="rounded-2xl border border-[#dce5de] bg-white p-6">
            <Heart size={22} className="text-[#28785f]" />
            <h2 className="mt-4 text-xl font-semibold">Favorites</h2>
            <p className="mt-1 text-sm text-[#627568]">{favorites.data?.length ?? 0} saved exercises</p>
            <Link href="/exercises" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#28785f]">Explore more <ArrowRight size={16} /></Link>
          </div>
        </div>
        {(favorites.data?.length ?? 0) > 0 && <section className="mt-10">
          <h2 className="text-xl font-semibold">Saved exercises</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {favorites.data?.map((item) => item.exercises && <Link key={item.exercise_id}
              href={`/exercises/${item.exercises.slug}`} className="rounded-xl border border-[#dce5de] bg-white px-5 py-4 font-medium hover:text-[#28785f]">
              {nameById.get(item.exercises.current_content_id) ?? item.exercises.slug}
            </Link>)}
          </div>
        </section>}
      </div>
    </main>
  );
}
