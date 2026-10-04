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
    <main className="min-h-screen bg-background text-foreground">
        <h1 className="sr-only">{exercise.exercise_content?.name}</h1>
        <MotionWorkshop privateId={id} ownerId={identity.userId} initialName={exercise.exercise_content?.name ?? "Untitled exercise"} initialScene={initial} equipmentOptions={equipmentOptions} jointActions={jointActions} />
    </main>
  );
}
