import Image from "next/image";
import Link from "next/link";
import { Dumbbell } from "lucide-react";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

type ExerciseRow = Database["public"]["Functions"]["explore_exercises"]["Returns"][number];

export async function ExerciseCards({ rows }: { rows: ExerciseRow[] }) {
  const supabase = await createClient();
  const { data: posterRows } = rows.length > 0
    ? await supabase.from("exercise_media").select("content_id,storage_bucket,storage_path")
      .eq("kind", "poster").in("content_id", rows.map((row) => row.content_id))
    : { data: [] };
  const posters = new Map((posterRows ?? []).map((item) => [item.content_id,
    supabase.storage.from(item.storage_bucket).getPublicUrl(item.storage_path).data.publicUrl]));

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((exercise) => {
        const poster = posters.get(exercise.content_id);
        return (
          <Link key={exercise.exercise_id} href={`/exercises/${exercise.slug}`}
            className="group overflow-hidden rounded-2xl border border-[#dce5de] bg-white transition hover:-translate-y-0.5 hover:border-[#aacbb7] hover:shadow-lg hover:shadow-[#163a2c]/5">
            <div className="flex aspect-[4/3] items-center justify-center bg-[#e9efea] text-[#6f9b82]">
              {poster
                ? <Image src={poster} alt="" width={640} height={480} unoptimized className="h-full w-full object-cover" />
                : <Dumbbell size={42} strokeWidth={1.2} aria-hidden />}
            </div>
            <div className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6a8a75]">{exercise.family_slug?.replaceAll("-", " ") ?? "Exercise"}</p>
              <h2 className="mt-2 text-lg font-semibold tracking-tight group-hover:text-[#28745a]">{exercise.name}</h2>
              {exercise.short_description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#66776c]">{exercise.short_description}</p>}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
