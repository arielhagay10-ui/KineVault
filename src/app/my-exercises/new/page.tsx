import Link from "next/link";
import { redirect } from "next/navigation";
import { MotionWorkshop } from "@/components/character/motion-workshop";
import { getIdentity } from "@/lib/auth";
import { blankWorkshopScene } from "@/lib/motion/workshop";

export const dynamic = "force-dynamic";

export default async function NewPrivateExercisePage() {
  const identity = await getIdentity();
  if (!identity) redirect("/sign-in?next=/my-exercises/new");
  return <main className="min-h-screen bg-background px-4 py-5 text-foreground sm:px-6">
    <div className="mx-auto max-w-[1600px]">
      <Link href="/my-exercises" className="text-sm font-medium text-primary">← My exercises</Link>
      <div className="mb-5 mt-5"><h1 className="text-2xl font-semibold">Create an exercise</h1>
        <p className="mt-1 text-base text-muted-foreground">Start with an example or equipment. Anatomy details are optional.</p></div>
      <MotionWorkshop privateId={null} ownerId={identity.userId} initialName="" initialScene={blankWorkshopScene} equipmentOptions={[]} jointActions={[]} />
    </div>
  </main>;
}
