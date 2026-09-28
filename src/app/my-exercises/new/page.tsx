import Link from "next/link";
import { redirect } from "next/navigation";
import { PrivateExerciseForm } from "@/components/private-exercises/private-exercise-form";
import { getIdentity } from "@/lib/auth";
import { loadReviewOptions } from "@/lib/moderation/content";
import type { PrivateExerciseInput } from "@/lib/private-exercises/schema";

export const dynamic = "force-dynamic";

const initial: PrivateExerciseInput = {
  privateId: null, name: "", shortDescription: "", familySlug: null,
  primaryMuscles: [], secondaryMuscles: [], stabilizerMuscles: [],
  joints: [], jointActions: [], equipment: [],
  resistanceProfile: "unknown", bodyPositionSlug: null,
};

export default async function NewPrivateExercisePage() {
  if (!await getIdentity()) redirect("/sign-in?next=/my-exercises/new");
  const options = await loadReviewOptions();
  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-5xl">
        <Link href="/my-exercises" className="text-sm font-medium text-primary hover:underline">← My exercises</Link>
        <h1 className="mt-8 text-4xl font-semibold tracking-[-0.055em]">Create a private exercise</h1>
        <p className="mb-8 mt-3 text-muted-foreground">Start with what you know. You can refine the draft later.</p>
        <PrivateExerciseForm initial={initial} options={options} />
      </div>
    </main>
  );
}
