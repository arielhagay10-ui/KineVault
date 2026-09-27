import { createHash } from "node:crypto";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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
  const { data, error } = await supabase.rpc("read_shared_private_exercise", { p_token_hash: hash });
  if (error || !data) notFound();
  const parsed = sharedExercise.safeParse(data);
  if (!parsed.success) notFound();
  const exercise = parsed.data;

  return (
    <main className="min-h-screen bg-[#f7f8f5] text-[#172a27]">
      <div className="mx-auto max-w-4xl px-6 pb-20 pt-8">
        <header className="flex items-center justify-between border-b border-[#dce5de] pb-6">
          <Link href="/" className="text-xl font-bold tracking-[-0.05em]">KineVault</Link>
          <span className="rounded-full bg-[#e8efe9] px-3 py-1.5 text-xs font-semibold text-[#476c54]">Private shared exercise</span>
        </header>
        <div className="pt-12">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#28785f]">Shared by link</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">{exercise.name}</h1>
          {exercise.description && <p className="mt-5 text-lg leading-8 text-[#5f7365]">{exercise.description}</p>}
          <p className="mt-5 text-sm text-[#748578]">This is its owner’s private draft. Classifications can change as they refine it.</p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <InfoCard title="Movement">
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
        </div>
      </div>
    </main>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-[#dce5de] bg-white p-6"><h2 className="text-xl font-semibold">{title}</h2><div className="mt-5 space-y-4">{children}</div></section>;
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-[#7c8c80]">{label}</p><p className="mt-1 text-sm leading-6 text-[#344f3b]">{value}</p></div>;
}
