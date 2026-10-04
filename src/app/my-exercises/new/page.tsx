import { redirect } from "next/navigation";
import { MotionWorkshop } from "@/components/character/motion-workshop";
import { getIdentity } from "@/lib/auth";
import { blankWorkshopScene } from "@/lib/motion/workshop";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewPrivateExercisePage() {
  const identity = await getIdentity();
  if (!identity) redirect("/sign-in?next=/my-exercises/new");
  const supabase = await createClient();
  const { count, error } = await supabase.from("private_exercises")
    .select("id", { count: "exact", head: true }).eq("owner_id", identity.userId);
  return <main className="min-h-screen bg-background text-foreground">
      <h1 className="sr-only">Create an exercise</h1>
      <MotionWorkshop tutorialEligible={!error && count === 0} privateId={null} ownerId={identity.userId} initialName="" initialScene={blankWorkshopScene} equipmentOptions={[]} jointActions={[]} />
  </main>;
}
