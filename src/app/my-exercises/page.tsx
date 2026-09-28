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
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 pb-20 pt-8">
        <header className="flex items-center justify-between border-b border-border pb-6">
          <Link href="/" className="text-xl font-bold tracking-[-0.05em]">KineVault</Link>
          <Link href="/dashboard" className="flex items-center gap-2 text-sm text-primary"><ArrowLeft size={16} /> Dashboard</Link>
        </header>
        <div className="flex flex-wrap items-end justify-between gap-5 py-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Private library</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em]">My exercises</h1>
            <p className="mt-3 text-muted-foreground">Your drafts stay private until you decide to share or submit them.</p>
          </div>
          <Link href="/my-exercises/new" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary"><Plus size={17} /> New exercise</Link>
        </div>
        {error ? <p role="alert" className="text-red-700 dark:text-red-300">Private exercises could not be loaded.</p>
          : exercises?.length ? <div className="grid gap-4 sm:grid-cols-2">
            {exercises.map((item) => (
              <Link key={item.id} href={`/my-exercises/${item.id}/edit`}
                className="group rounded-2xl border border-border bg-card p-6 hover:border-border hover:shadow-md">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Private draft</p>
                <h2 className="mt-2 text-xl font-semibold group-hover:text-primary">{item.exercise_content?.name ?? "Untitled exercise"}</h2>
                {item.exercise_content?.short_description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{item.exercise_content.short_description}</p>}
                <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-primary">Edit exercise <ArrowRight size={16} /></p>
              </Link>
            ))}
          </div> : <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
            <h2 className="text-xl font-semibold">No private exercises yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">Create a draft to keep your own exercise variation.</p>
            <Link href="/my-exercises/new" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">Create one <ArrowRight size={16} /></Link>
          </div>}
      </div>
    </main>
  );
}
