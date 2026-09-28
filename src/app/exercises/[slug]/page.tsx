import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Dumbbell, Heart, Info } from "lucide-react";
import { toggleFavorite } from "@/app/favorites/actions";
import { copyPublicExercise } from "@/app/exercises/actions";
import { getIdentity } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { mediaObjectKey, signMediaObjects } from "@/lib/media/signed-media";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

function label(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "Not classified";
}

export default async function ExercisePage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const identity = await getIdentity();
  const { data: exercise } = await supabase.from("exercises")
    .select("id,slug,current_content_id,status,favorite_count")
    .eq("slug", slug).eq("status", "published").maybeSingle();
  if (!exercise) notFound();
  const { data: savedFavorite } = identity
    ? await supabase.from("favorites").select("exercise_id")
      .eq("exercise_id", exercise.id).eq("user_id", identity.userId).maybeSingle()
    : { data: null };

  const contentId = exercise.current_content_id;
  const [contentResult, musclesResult, jointsResult, actionsResult, equipmentResult,
    attachmentsResult, patternsResult, aliasesResult, biomechanicsResult, mediaResult,
    relationsResult] = await Promise.all([
    supabase.from("exercise_content").select("*").eq("id", contentId).single(),
    supabase.from("exercise_muscles").select("role,muscles(name,slug)").eq("content_id", contentId),
    supabase.from("exercise_joints").select("role,joints(name,slug)").eq("content_id", contentId),
    supabase.from("exercise_joint_actions").select("role,joint_actions(name,slug,joints(name))").eq("content_id", contentId),
    supabase.from("exercise_equipment").select("role,equipment(name,slug)").eq("content_id", contentId),
    supabase.from("exercise_attachments").select("attachments(name,slug)").eq("content_id", contentId),
    supabase.from("exercise_movement_patterns").select("movement_patterns(name,slug)").eq("content_id", contentId),
    supabase.from("exercise_aliases").select("alias").eq("content_id", contentId),
    supabase.from("exercise_biomechanics").select("resistance_profile,peak_resistance_position,reviewer_notes,body_positions(name),planes_of_motion(name),resistance_sources(name)").eq("content_id", contentId).maybeSingle(),
    supabase.from("exercise_media").select("kind,storage_bucket,storage_path,asset_group_id").eq("content_id", contentId),
    supabase.from("exercise_relations").select("source_exercise_id,target_exercise_id,relation_type")
      .or(`source_exercise_id.eq.${exercise.id},target_exercise_id.eq.${exercise.id}`),
  ]);

  const content = contentResult.data;
  if (!content) notFound();
  const biomech = biomechanicsResult.data;
  const media = mediaResult.data ?? [];
  const webm = media.find((item) => item.kind === "webm");
  const mp4 = media.find((item) => item.kind === "mp4");
  const poster = media.find((item) => item.kind === "poster");
  const signedMedia = await signMediaObjects(media);
  const urlFor = (item: (typeof media)[number]) => signedMedia.get(mediaObjectKey(item));
  const relations = relationsResult.data ?? [];
  const relatedIds = relations.map((relation) => relation.source_exercise_id === exercise.id
    ? relation.target_exercise_id : relation.source_exercise_id);
  const { data: relatedExercises } = relatedIds.length
    ? await supabase.from("exercises").select("id,slug,current_content_id").in("id", relatedIds).eq("status", "published")
    : { data: [] };
  const { data: relatedContent } = (relatedExercises?.length ?? 0) > 0
    ? await supabase.from("exercise_content").select("id,name").in("id", relatedExercises!.map((item) => item.current_content_id))
    : { data: [] };
  const relatedNames = new Map((relatedContent ?? []).map((item) => [item.id, item.name]));
  const relatedById = new Map((relatedExercises ?? []).map((item) => [item.id, {
    slug: item.slug, name: relatedNames.get(item.current_content_id) ?? item.slug,
  }]));
  const variations = relations.filter((item) => item.relation_type === "variation_of" && item.target_exercise_id === exercise.id)
    .map((item) => relatedById.get(item.source_exercise_id)).filter((item) => item !== undefined);
  const parent = relations.find((item) => item.relation_type === "variation_of" && item.source_exercise_id === exercise.id);
  const parentExercise = parent ? relatedById.get(parent.target_exercise_id) : undefined;
  const { data: family } = content.family_id
    ? await supabase.from("exercise_families").select("name,slug").eq("id", content.family_id).maybeSingle()
    : { data: null };

  return (
    <main className="min-h-screen bg-[#f7f8f5] text-[#172a27]">
      <header className="border-b border-[#dce5de] bg-white/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link href="/" className="text-xl font-bold tracking-[-0.05em]">KineVault</Link>
          <Link href="/exercises" className="flex items-center gap-2 text-sm font-medium text-[#526b5b]"><ArrowLeft size={16} /> Explore</Link>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-6 pb-20 pt-10 lg:px-10">
        <Link href="/exercises" className="inline-flex items-center gap-2 text-sm text-[#4b785c]"><ArrowLeft size={16} /> Back to Explore</Link>
        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div>
            <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-3xl bg-[#e8eee9]">
              {webm || mp4 ? (
                <video autoPlay muted loop playsInline controls poster={poster ? urlFor(poster) : undefined} className="h-full w-full object-contain">
                  {webm && <source src={urlFor(webm)} type="video/webm" />}
                  {mp4 && <source src={urlFor(mp4)} type="video/mp4" />}
                </video>
              ) : <Dumbbell size={64} strokeWidth={1.2} className="text-[#87a792]" aria-label="Demonstration unavailable" />}
            </div>
            <section className="mt-8 rounded-2xl border border-[#dce5de] bg-white p-6">
              <h2 className="text-xl font-semibold">How to perform it</h2>
              <InfoBlock title="Setup" value={content.setup_instructions} />
              <InfoBlock title="Execution" value={content.execution_instructions} />
              <InfoBlock title="Form cues" value={content.form_cues} />
              <InfoBlock title="Common mistakes" value={content.common_mistakes} />
              <InfoBlock title="Safety notes" value={content.safety_notes} />
            </section>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#28785f]">Exercise detail</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">{content.name}</h1>
            {content.short_description && <p className="mt-5 text-lg leading-8 text-[#5d7164]">{content.short_description}</p>}
            {family && <Link href={`/families/${family.slug}`} className="mt-4 inline-flex rounded-full bg-[#e4f0e7] px-3 py-1.5 text-sm font-semibold text-[#28785f]">{family.name} family</Link>}
            {(aliasesResult.data?.length ?? 0) > 0 && <p className="mt-4 text-sm text-[#748477]">Also known as: {aliasesResult.data?.map((item) => item.alias).join(", ")}</p>}
            <div className="mt-6 flex items-center gap-4">
              {identity ? <form action={toggleFavorite}>
                <input type="hidden" name="exerciseId" value={exercise.id} />
                <input type="hidden" name="slug" value={exercise.slug} />
                <button type="submit" aria-pressed={Boolean(savedFavorite)} className="inline-flex items-center gap-2 rounded-xl border border-[#cbdace] bg-white px-4 py-2.5 text-sm font-semibold text-[#2f6347] hover:bg-[#eef6ef]">
                  <Heart size={17} fill={savedFavorite ? "currentColor" : "none"} /> {savedFavorite ? "Saved" : "Save favorite"}
                </button>
              </form> : <Link href={`/sign-in?next=${encodeURIComponent(`/exercises/${exercise.slug}`)}`}
                className="inline-flex items-center gap-2 rounded-xl border border-[#cbdace] bg-white px-4 py-2.5 text-sm font-semibold text-[#2f6347] hover:bg-[#eef6ef]">
                <Heart size={17} /> Sign in to save
              </Link>}
              <span className="text-sm text-[#788a7c]">{exercise.favorite_count} saved</span>
            </div>
            {identity && <form action={copyPublicExercise} className="mt-4">
              <input type="hidden" name="exerciseId" value={exercise.id} />
              <button type="submit" className="rounded-xl bg-[#174a3e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#246a53]">Copy to my exercises</button>
              <p className="mt-2 text-xs leading-5 text-[#748477]">Make an independent private copy of the reviewed classifications. The motion is included when its creator allowed reuse.</p>
            </form>}

            <section className="mt-9 space-y-6 rounded-2xl border border-[#dce5de] bg-white p-6">
              <TagSection title="Primary muscles" items={(musclesResult.data ?? []).filter((item) => item.role === "primary" && item.muscles).map((item) => ({ name: item.muscles!.name, href: `/muscles/${item.muscles!.slug}` }))} />
              <TagSection title="Secondary muscles" items={(musclesResult.data ?? []).filter((item) => item.role === "secondary" && item.muscles).map((item) => ({ name: item.muscles!.name, href: `/muscles/${item.muscles!.slug}` }))} />
              <TagSection title="Stabilizers" items={(musclesResult.data ?? []).filter((item) => item.role === "stabilizer" && item.muscles).map((item) => ({ name: item.muscles!.name, href: `/muscles/${item.muscles!.slug}` }))} />
              <TagSection title="Joints" items={(jointsResult.data ?? []).filter((item) => item.joints).map((item) => ({ name: item.joints!.name, href: `/joints/${item.joints!.slug}` }))} />
              <div>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.1em] text-[#617869]">Joint actions</h2>
                <div className="flex flex-wrap gap-2">
                  {(actionsResult.data ?? []).map((item) => item.joint_actions && (
                    <Link key={item.joint_actions.slug} href={`/joint-actions/${item.joint_actions.slug}`}
                      className="rounded-full bg-[#e7f2e9] px-3 py-1.5 text-sm font-medium text-[#27664c] hover:bg-[#d3ead8]">
                      {item.joint_actions.joints?.name} {item.joint_actions.name}
                    </Link>
                  ))}
                </div>
              </div>
              <TagSection title="Equipment" items={(equipmentResult.data ?? []).filter((item) => item.equipment).map((item) => ({ name: item.equipment!.name, href: `/equipment/${item.equipment!.slug}` }))} />
              <TagSection title="Attachments" items={(attachmentsResult.data ?? []).filter((item) => item.attachments).map((item) => ({ name: item.attachments!.name }))} />
              <TagSection title="Movement patterns" items={(patternsResult.data ?? []).filter((item) => item.movement_patterns).map((item) => ({ name: item.movement_patterns!.name }))} />
            </section>

            <section className="mt-6 rounded-2xl border border-[#dce5de] bg-white p-6">
              <h2 className="flex items-center gap-2 text-xl font-semibold"><Info size={19} /> Biomechanics</h2>
              <dl className="mt-5 grid grid-cols-2 gap-5 text-sm">
                <InfoField title="Resistance profile" value={label(biomech?.resistance_profile)} />
                <InfoField title="Peak resistance" value={label(biomech?.peak_resistance_position)} />
                <InfoField title="Resistance source" value={biomech?.resistance_sources?.name} />
                <InfoField title="Body position" value={biomech?.body_positions?.name} />
                <InfoField title="Plane of motion" value={biomech?.planes_of_motion?.name} />
                <InfoField title="Mechanic" value={label(content.mechanic)} />
                <InfoField title="Force type" value={label(content.force_type)} />
                <InfoField title="Laterality" value={label(content.laterality)} />
              </dl>
              {biomech?.reviewer_notes && <p className="mt-5 border-t border-[#edf1eb] pt-4 text-sm leading-6 text-[#66796b]">{biomech.reviewer_notes}</p>}
            </section>
            {(parentExercise || variations.length > 0) && <section className="mt-6 rounded-2xl border border-[#dce5de] bg-white p-6">
              <h2 className="text-xl font-semibold">Exercise family links</h2>
              {parentExercise && <div className="mt-4"><h3 className="mb-2 text-sm font-semibold text-[#66796b]">Parent movement</h3><Link className="text-[#28785f] underline" href={`/exercises/${parentExercise.slug}`}>{parentExercise.name}</Link></div>}
              {variations.length > 0 && <div className="mt-4"><h3 className="mb-2 text-sm font-semibold text-[#66796b]">Variations</h3><ul className="space-y-2">{variations.map((item) => <li key={item.slug}><Link className="text-[#28785f] underline" href={`/exercises/${item.slug}`}>{item.name}</Link></li>)}</ul></div>}
            </section>}
          </div>
        </div>
      </div>
    </main>
  );
}

function TagSection({ title, items }: { title: string; items: { name: string; href?: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.1em] text-[#617869]">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => item.href
          ? <Link key={item.href} href={item.href} className="rounded-full bg-[#edf3ed] px-3 py-1.5 text-sm text-[#355b45] hover:bg-[#d8ebdd]">{item.name}</Link>
          : <span key={item.name} className="rounded-full bg-[#edf3ed] px-3 py-1.5 text-sm text-[#355b45]">{item.name}</span>)}
      </div>
    </div>
  );
}

function InfoBlock({ title, value }: { title: string; value: string | null }) {
  if (!value) return null;
  return <div className="mt-6"><h3 className="text-sm font-semibold uppercase tracking-wider text-[#617869]">{title}</h3><p className="mt-2 whitespace-pre-line leading-7 text-[#53665b]">{value}</p></div>;
}

function InfoField({ title, value }: { title: string; value: string | null | undefined }) {
  return <div><dt className="text-[#7a897e]">{title}</dt><dd className="mt-1 font-semibold capitalize text-[#234532]">{value ?? "Not classified"}</dd></div>;
}
