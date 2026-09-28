import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export default async function AdminExercises({ searchParams }: { searchParams: Promise<{ q?: string; after?: string; id?: string }> }) {
  const params = await searchParams;
  const query = params.q?.trim().slice(0, 100) ?? "";
  const supabase = await createClient();
  const cursorId = z.uuid().safeParse(params.id);
  const { data, error } = await supabase.rpc("explore_exercises", { search_text: query || undefined, page_size: 20,
    cursor_name: cursorId.success ? params.after?.slice(0, 160) : undefined,
    cursor_id: cursorId.success ? cursorId.data : undefined });
  if (error) throw new Error("The public catalog could not be loaded");
  return <div><h1 className="text-3xl font-semibold">Published exercises</h1>
    <p className="mt-3 text-sm text-muted-foreground">Correct reviewed classifications without overwriting the original version.</p>
    <form className="my-6 flex gap-3"><label htmlFor="catalog-search" className="sr-only">Exercise name</label>
      <input id="catalog-search" name="q" defaultValue={query} maxLength={100} placeholder="Search by name or alias" className="min-w-0 flex-1 rounded-xl border p-3" />
      <button className="rounded-xl border px-5 font-semibold">Search</button>
    </form>
    <ul className="divide-y rounded-2xl border bg-card">{(data ?? []).slice(0, 20).map((item) => <li key={item.exercise_id} className="flex items-center justify-between gap-4 p-5">
      <Link href={`/exercises/${item.slug}`} className="font-medium">{item.name}</Link>
      <Link href={`/admin/exercises/${item.exercise_id}/edit`} className="shrink-0 text-sm font-semibold text-primary">Review metadata</Link>
    </li>)}</ul>
    {!data?.length && <p className="mt-6 text-sm text-muted-foreground">No published exercises match.</p>}
    {data && data.length > 20 && <Link className="mt-6 inline-block font-semibold underline" href={`/admin/exercises?${new URLSearchParams({ q: query, after: data[19].normalized_name, id: data[19].exercise_id })}`}>Next page</Link>}
  </div>;
}
