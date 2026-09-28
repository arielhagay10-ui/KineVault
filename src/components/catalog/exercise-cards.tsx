import Image from "next/image";
import Link from "next/link";
import { Dumbbell } from "lucide-react";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { mediaObjectKey, signMediaObjects } from "@/lib/media/signed-media";

type ExerciseRow = Database["public"]["Functions"]["explore_exercises"]["Returns"][number];

export async function ExerciseCards({ rows }: { rows: ExerciseRow[] }) {
  const supabase = await createClient();
  const { data: posterRows } = rows.length > 0
    ? await supabase.from("exercise_media").select("content_id,storage_bucket,storage_path")
      .eq("kind", "poster").in("content_id", rows.map((row) => row.content_id))
    : { data: [] };
  const signed = await signMediaObjects(posterRows ?? []);
  const posters = new Map((posterRows ?? []).map((item) => [item.content_id,
    signed.get(mediaObjectKey(item))]));

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((exercise, index) => {
        const poster = posters.get(exercise.content_id);
        return (
          <Link key={exercise.exercise_id} href={`/exercises/${exercise.slug}`}
            className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-0.5 hover:border-border hover:shadow-lg hover:shadow-black/5">
            <div className="flex aspect-[4/3] items-center justify-center bg-muted text-muted-foreground">
              {poster
                ? <Image src={poster} alt="" width={640} height={640} loading={index < 3 ? "eager" : "lazy"} unoptimized className="h-full w-full object-contain" />
                : <Dumbbell size={42} strokeWidth={1.2} aria-hidden />}
            </div>
            <div className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{exercise.family_slug?.replaceAll("-", " ") ?? "Exercise"}</p>
              <h2 className="mt-2 text-lg font-semibold tracking-tight group-hover:text-primary">{exercise.name}</h2>
              {exercise.short_description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{exercise.short_description}</p>}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
