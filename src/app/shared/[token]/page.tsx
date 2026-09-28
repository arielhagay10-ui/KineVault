import { createHash } from "node:crypto";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { SharedMotion } from "@/components/character/shared-motion";
import { decodeSharedScene } from "@/lib/motion/load-scene";
import { createClient } from "@/lib/supabase/server";
import { reviewPatchSchema, reviewFieldLabels, formatReviewValue } from "@/lib/moderation/schema";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

const sharedExercise = z.object({
  name: z.string(),
  description: z.string().nullable(),
  family: z.string().nullable(),
  muscles: z.array(z.object({ name: z.string(), role: z.string() })),
  joints: z.array(z.string()),
  joint_actions: z.array(z.object({ name: z.string(), joint: z.string() })),
  equipment: z.array(z.string()),
  resistance_profile: z.string().nullable(),
  body_position: z.string().nullable(),
});

export default async function SharedExercisePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) notFound();
  const hash = createHash("sha256").update(token).digest("hex");
  const supabase = await createClient();
  const [{ data, error }, { data: sceneData }, { data: metadataData }] = await Promise.all([
    supabase.rpc("read_shared_private_exercise", { p_token_hash: hash }),
    supabase.rpc("read_shared_private_scene", { p_token_hash: hash }),
    supabase.rpc("read_shared_private_metadata", { p_token_hash: hash }),
  ]);
  if (error || !data) notFound();
  const parsed = sharedExercise.safeParse(data);
  if (!parsed.success) notFound();
  const exercise = parsed.data;
  const scene = sceneData ? decodeSharedScene(sceneData) : null;
  const details = reviewPatchSchema.safeParse(metadataData);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-6 pb-20 pt-8">
        <header className="flex items-center justify-between border-b border-border pb-6">
          <Link href="/" className="text-xl font-bold tracking-[-0.05em]">KineVault</Link>
          <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">Private shared exercise</span>
        </header>
        <div className="pt-12">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Shared by link</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">{exercise.name}</h1>
          {exercise.description && <p className="mt-5 text-lg leading-8 text-muted-foreground">{exercise.description}</p>}
          <p className="mt-5 text-sm text-muted-foreground">This is its owner’s private draft. Classifications can change as they refine it.</p>
        </div>
        {scene && <SharedMotion scene={scene} />}
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <InfoCard title="Movement">
            {details.success && <InfoRow label="Aliases" value={details.data.aliases.join(", ")} />}
            <InfoRow label="Family" value={exercise.family} />
            <InfoRow label="Body position" value={exercise.body_position} />
            <InfoRow label="Resistance profile" value={exercise.resistance_profile?.replaceAll("_", " ")} />
          </InfoCard>
          <InfoCard title="Anatomy">
            <InfoRow label="Muscles" value={exercise.muscles.map((item) => `${item.name} (${item.role})`).join(", ")} />
            <InfoRow label="Joints" value={exercise.joints.join(", ")} />
            <InfoRow label="Joint actions" value={exercise.joint_actions.map((item) => `${item.joint} ${item.name}`).join(", ")} />
          </InfoCard>
          <InfoCard title="Equipment"><InfoRow label="Used" value={exercise.equipment.join(", ")} /></InfoCard>
          {details.success && <InfoCard title="Detailed classifications">
            {(["attachments", "movement_patterns", "grip", "stance", "plane", "resistance_source", "peak_resistance_position",
              "classification_confidence", "difficulty", "exercise_type", "mechanic", "force_type", "laterality"] as const)
              .map((field) => <InfoRow key={field} label={reviewFieldLabels[field]} value={formatReviewValue(details.data[field])} />)}
          </InfoCard>}
          {details.success && <InfoCard title="Instructions">
            {(["setup_instructions", "execution_instructions", "form_cues", "common_mistakes", "safety_notes", "range_of_motion_notes", "reviewer_notes"] as const)
              .map((field) => <InfoRow key={field} label={field === "reviewer_notes" ? "Classification notes" : reviewFieldLabels[field]} value={details.data[field]} />)}
          </InfoCard>}
        </div>
      </div>
    </main>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-border bg-card p-6"><h2 className="text-xl font-semibold">{title}</h2><div className="mt-5 space-y-4">{children}</div></section>;
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</p><p className="mt-1 text-sm leading-6 text-primary">{value}</p></div>;
}
