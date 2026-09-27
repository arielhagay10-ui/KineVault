import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DeletePrivateButton } from "@/components/private-exercises/delete-private-button";
import { PrivateExerciseForm } from "@/components/private-exercises/private-exercise-form";
import { SharePanel } from "@/components/private-exercises/share-panel";
import { getIdentity } from "@/lib/auth";
import { loadPrivateExerciseOptions } from "@/lib/private-exercises/options";
import type { PrivateExerciseInput } from "@/lib/private-exercises/schema";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> };

export default async function EditPrivateExercisePage({ params, searchParams }: Props) {
  const identity = await getIdentity();
  if (!identity) redirect("/sign-in?next=/my-exercises");
  const { id } = await params;
  const supabase = await createClient();
  const { data: record } = await supabase.from("private_exercises")
    .select("id,content_id").eq("id", id).eq("owner_id", identity.userId).maybeSingle();
  if (!record) notFound();

  const contentId = record.content_id;
  const [content, family, muscles, joints, actions, equipment, biomechanics, shares, options] = await Promise.all([
    supabase.from("exercise_content").select("name,short_description,family_id").eq("id", contentId).single(),
    supabase.from("exercise_families").select("id,slug"),
    supabase.from("exercise_muscles").select("role,muscles(slug)").eq("content_id", contentId),
    supabase.from("exercise_joints").select("joints(slug)").eq("content_id", contentId),
    supabase.from("exercise_joint_actions").select("joint_actions(slug)").eq("content_id", contentId),
    supabase.from("exercise_equipment").select("equipment(slug)").eq("content_id", contentId),
    supabase.from("exercise_biomechanics").select("resistance_profile,body_positions(slug)").eq("content_id", contentId).maybeSingle(),
    supabase.from("private_exercise_shares").select("id").eq("private_exercise_id", record.id).is("revoked_at", null),
    loadPrivateExerciseOptions(),
  ]);
  if (!content.data) notFound();
  const selected = (role: "primary" | "secondary" | "stabilizer") =>
    (muscles.data ?? []).filter((item) => item.role === role && item.muscles).map((item) => item.muscles!.slug);
  const initial: PrivateExerciseInput = {
    privateId: record.id,
    name: content.data.name,
    shortDescription: content.data.short_description ?? "",
    familySlug: family.data?.find((item) => item.id === content.data.family_id)?.slug ?? null,
    primaryMuscles: selected("primary"),
    secondaryMuscles: selected("secondary"),
    stabilizerMuscles: selected("stabilizer"),
    joints: (joints.data ?? []).filter((item) => item.joints).map((item) => item.joints!.slug),
    jointActions: (actions.data ?? []).filter((item) => item.joint_actions).map((item) => item.joint_actions!.slug),
    equipment: (equipment.data ?? []).filter((item) => item.equipment).map((item) => item.equipment!.slug),
    resistanceProfile: biomechanics.data?.resistance_profile ?? "unknown",
    bodyPositionSlug: biomechanics.data?.body_positions?.slug ?? null,
  };
  const saved = (await searchParams).saved === "1";

  return (
    <main className="min-h-screen bg-[#f7f8f5] px-6 py-10 text-[#172a27]">
      <div className="mx-auto max-w-5xl">
        <Link href="/my-exercises" className="text-sm font-medium text-[#34735b] hover:underline">← My exercises</Link>
        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#28785f]">Private draft</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.055em]">Edit exercise</h1>
          </div>
          <DeletePrivateButton privateId={record.id} />
        </div>
        {saved && <p role="status" className="my-6 rounded-xl border border-[#b8dfc3] bg-[#e9f6eb] px-4 py-3 text-sm text-[#276448]">Saved privately.</p>}
        <Link href={`/my-exercises/${record.id}/workshop`} className="mt-7 inline-flex rounded-xl bg-[#174a3e] px-5 py-3 text-sm font-semibold text-white hover:bg-[#246a53]">Open motion workshop →</Link>
        <div className="mt-8"><PrivateExerciseForm initial={initial} options={options} /></div>
        <SharePanel privateId={record.id} active={(shares.data?.length ?? 0) > 0} />
      </div>
    </main>
  );
}
