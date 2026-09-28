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
  const [saved, equipment, assets, actions] = await Promise.all([
    loadWorkshopScene(exercise.content_id),
    supabase.from("exercise_equipment").select("equipment(slug)").eq("content_id", exercise.content_id),
    supabase.from("equipment_assets").select("slug,active,equipment(name)").eq("version", 1),
    supabase.from("exercise_joint_actions").select("joint_actions(slug,name,joints(name))").eq("content_id", exercise.content_id),
  ]);
  if (equipment.error || assets.error || actions.error) throw new Error("Workshop options could not be loaded");
  const jointActions = (actions.data ?? []).flatMap((item) => item.joint_actions ? [{
    slug: item.joint_actions.slug, name: `${item.joint_actions.joints?.name ?? ""} ${item.joint_actions.name}`,
  }] : []);
  const initial = initialWorkshopScene((equipment.data ?? []).map((item) => item.equipment?.slug ?? ""), saved);
  const equipmentOptions = (assets.data ?? []).filter((item) => item.active || item.slug === saved?.equipment?.slug)
    .filter((item) => ["dumbbell-pair", "barbell", "single-cable"].includes(item.slug))
    .map((item) => ({ slug: item.slug, label: item.slug === "dumbbell-pair" ? "Dumbbell pair" : item.equipment?.name ?? item.slug, active: item.active }));
  if (initial.equipment && !equipmentOptions.some((item) => item.slug === initial.equipment?.slug)) initial.equipment = null;

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8">
      <div className="mx-auto max-w-7xl">
        <Link href={`/my-exercises/${id}/edit`} className="text-sm font-medium text-primary hover:underline">← Exercise details</Link>
        <div className="mb-8 mt-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Motion workshop · private</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.055em]">{exercise.exercise_content?.name}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Pose the anatomical figure at key moments, then preview the movement. These controls describe the demo; your anatomy classifications stay in exercise details.</p>
        </div>
        <MotionWorkshop privateId={id} initialScene={initial} equipmentOptions={equipmentOptions} jointActions={jointActions} />
      </div>
    </main>
  );
}
