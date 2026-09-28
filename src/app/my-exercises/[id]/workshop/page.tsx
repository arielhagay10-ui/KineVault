import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MotionWorkshop } from "@/components/character/motion-workshop";
import { getIdentity } from "@/lib/auth";
import { initialWorkshopScene, loadWorkshopScene } from "@/lib/motion/load-scene";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function WorkshopPage({ params }: { params: Promise<{ id: string }> }) {
  const identity = await getIdentity();
  if (!identity) redirect("/sign-in?next=/my-exercises");
  const { id } = await params;
  const supabase = await createClient();
  const { data: exercise } = await supabase.from("private_exercises")
    .select("id,content_id,exercise_content(name)")
    .eq("id", id).eq("owner_id", identity.userId).maybeSingle();
  if (!exercise) notFound();
  const [saved, equipment, assets] = await Promise.all([
    loadWorkshopScene(exercise.content_id),
    supabase.from("exercise_equipment").select("equipment(slug)").eq("content_id", exercise.content_id),
    supabase.from("equipment_assets").select("slug,active,equipment(name)").eq("version", 1),
  ]);
  const initial = initialWorkshopScene((equipment.data ?? []).map((item) => item.equipment?.slug ?? ""), saved);
  const equipmentOptions = (assets.data ?? []).filter((item) => item.active || item.slug === saved?.equipment?.slug)
    .filter((item) => ["dumbbell-pair", "barbell", "single-cable"].includes(item.slug))
    .map((item) => ({ slug: item.slug, label: item.slug === "dumbbell-pair" ? "Dumbbell pair" : item.equipment?.name ?? item.slug, active: item.active }));
  if (initial.equipment && !equipmentOptions.some((item) => item.slug === initial.equipment?.slug)) initial.equipment = null;

  return (
    <main className="min-h-screen bg-[#f7f8f5] px-5 py-8 text-[#172a27] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <Link href={`/my-exercises/${id}/edit`} className="text-sm font-medium text-[#34735b] hover:underline">← Exercise details</Link>
        <div className="mb-8 mt-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#28785f]">Motion workshop · private</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.055em]">{exercise.exercise_content?.name}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#64786b]">Pose the anatomical figure at key moments, then preview the movement. These controls describe the demo; your anatomy classifications stay in exercise details.</p>
        </div>
        <MotionWorkshop privateId={id} initialScene={initial} equipmentOptions={equipmentOptions} />
      </div>
    </main>
  );
}
