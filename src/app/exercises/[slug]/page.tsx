import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Heart, Info } from "lucide-react";
import { MediaGallery, type MediaGroup } from "@/components/catalog/media-gallery";
import { MotionInspector } from "@/components/character/motion-inspector";
import { loadWorkshopScene } from "@/lib/motion/load-scene";
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
    relationsResult, scene] = await Promise.all([
    supabase.from("exercise_content").select("*").eq("id", contentId).single(),
    supabase.from("exercise_muscles").select("role,muscles(name,slug)").eq("content_id", contentId),
    supabase.from("exercise_joints").select("role,joints(name,slug)").eq("content_id", contentId),
    supabase.from("exercise_joint_actions").select("role,joint_actions(name,slug,joints(name))").eq("content_id", contentId),
    supabase.from("exercise_equipment").select("role,equipment(name,slug)").eq("content_id", contentId),
    supabase.from("exercise_attachments").select("attachments(name,slug)").eq("content_id", contentId),
    supabase.from("exercise_movement_patterns").select("movement_patterns(name,slug)").eq("content_id", contentId),
    supabase.from("exercise_aliases").select("alias").eq("content_id", contentId),
    supabase.from("exercise_biomechanics").select("resistance_profile,peak_resistance_position,classification_confidence,reviewer_notes,body_positions(name),grips(name),stances(name),planes_of_motion(name),resistance_sources(name)").eq("content_id", contentId).maybeSingle(),
    supabase.from("exercise_media").select("kind,storage_bucket,storage_path,asset_group_id,camera_angle,character_presentation,license_name,source_credit").eq("content_id", contentId),
    supabase.from("exercise_relations").select("source_exercise_id,target_exercise_id,relation_type")
      .or(`source_exercise_id.eq.${exercise.id},target_exercise_id.eq.${exercise.id}`),
    loadWorkshopScene(contentId),
  ]);
  if ([contentResult, musclesResult, jointsResult, actionsResult, equipmentResult, attachmentsResult,
    patternsResult, aliasesResult, biomechanicsResult, mediaResult, relationsResult].some((result) => result.error)) {
    throw new Error("The exercise details could not be loaded");
  }

  const content = contentResult.data;
  if (!content) notFound();
  const biomech = biomechanicsResult.data;
  const media = mediaResult.data ?? [];
  const signedMedia = await signMediaObjects(media);
  const urlFor = (item: (typeof media)[number]) => signedMedia.get(mediaObjectKey(item));
  const groups = new Map<string, MediaGroup>();
  for (const item of media) {
    if (!["webm", "mp4", "poster"].includes(item.kind)) continue;
    const group = groups.get(item.asset_group_id) ?? { id: item.asset_group_id, presentation: item.character_presentation,
      angle: item.camera_angle, license: item.license_name, credit: item.source_credit };
    if (item.kind === "webm" || item.kind === "mp4" || item.kind === "poster") group[item.kind] = urlFor(item);
    groups.set(group.id, group);
  }
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
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link href="/" className="text-xl font-bold tracking-[-0.05em]">KineVault</Link>
          <Link href="/exercises" className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><ArrowLeft size={16} /> Explore</Link>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-6 pb-20 pt-10 lg:px-10">
        <Link href="/exercises" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={16} /> Back to Explore</Link>
        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div>
            <MediaGallery groups={[...groups.values()]} annotations={scene?.annotations} />
            {scene && <MotionInspector scene={scene} />}
            <section className="mt-8 rounded-2xl border border-border bg-card p-6">
              <h2 className="text-xl font-semibold">How to perform it</h2>
              <InfoBlock title="Setup" value={content.setup_instructions} />
              <InfoBlock title="Execution" value={content.execution_instructions} />
              <InfoBlock title="Form cues" value={content.form_cues} />
              <InfoBlock title="Common mistakes" value={content.common_mistakes} />
              <InfoBlock title="Safety notes" value={content.safety_notes} />
              <InfoBlock title="Range of motion" value={content.range_of_motion_notes} />
            </section>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Exercise detail</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">{content.name}</h1>
            {content.short_description && <p className="mt-5 text-lg leading-8 text-muted-foreground">{content.short_description}</p>}
            {family && <Link href={`/families/${family.slug}`} className="mt-4 inline-flex rounded-full bg-muted px-3 py-1.5 text-sm font-semibold text-primary">{family.name} family</Link>}
            {(aliasesResult.data?.length ?? 0) > 0 && <p className="mt-4 text-sm text-muted-foreground">Also known as: {aliasesResult.data?.map((item) => item.alias).join(", ")}</p>}
            <div className="mt-6 flex items-center gap-4">
              {identity ? <form action={toggleFavorite}>
                <input type="hidden" name="exerciseId" value={exercise.id} />
                <input type="hidden" name="slug" value={exercise.slug} />
                <button type="submit" aria-pressed={Boolean(savedFavorite)} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-primary hover:bg-muted">
                  <Heart size={17} fill={savedFavorite ? "currentColor" : "none"} /> {savedFavorite ? "Saved" : "Save favorite"}
                </button>
              </form> : <Link href={`/sign-in?next=${encodeURIComponent(`/exercises/${exercise.slug}`)}`}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-primary hover:bg-muted">
                <Heart size={17} /> Sign in to save
              </Link>}
              <span className="text-sm text-muted-foreground">{exercise.favorite_count} saved</span>
            </div>
            {identity && <form action={copyPublicExercise} className="mt-4">
              <input type="hidden" name="exerciseId" value={exercise.id} />
              <button type="submit" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary">Copy to my exercises</button>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">Make an independent private copy of the reviewed classifications. The motion is included when its creator allowed reuse.</p>
            </form>}

            <section className="mt-9 space-y-6 rounded-2xl border border-border bg-card p-6">
              <TagSection title="Primary muscles" items={(musclesResult.data ?? []).filter((item) => item.role === "primary" && item.muscles).map((item) => ({ name: item.muscles!.name, href: `/muscles/${item.muscles!.slug}` }))} />
              <TagSection title="Secondary muscles" items={(musclesResult.data ?? []).filter((item) => item.role === "secondary" && item.muscles).map((item) => ({ name: item.muscles!.name, href: `/muscles/${item.muscles!.slug}` }))} />
              <TagSection title="Stabilizers" items={(musclesResult.data ?? []).filter((item) => item.role === "stabilizer" && item.muscles).map((item) => ({ name: item.muscles!.name, href: `/muscles/${item.muscles!.slug}` }))} />
              <TagSection title="Joints" items={(jointsResult.data ?? []).filter((item) => item.joints).map((item) => ({ name: item.joints!.name, href: `/joints/${item.joints!.slug}` }))} />
              <div>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">Joint actions</h2>
                <div className="flex flex-wrap gap-2">
                  {(actionsResult.data ?? []).map((item) => item.joint_actions && (
                    <Link key={item.joint_actions.slug} href={`/joint-actions/${item.joint_actions.slug}`}
                      className="rounded-full bg-muted px-3 py-1.5 text-sm font-medium text-primary hover:bg-muted">
                      {item.joint_actions.joints?.name} {item.joint_actions.name}
                    </Link>
                  ))}
                </div>
              </div>
              <TagSection title="Equipment" items={(equipmentResult.data ?? []).filter((item) => item.equipment).map((item) => ({ name: item.equipment!.name, href: `/equipment/${item.equipment!.slug}` }))} />
              <TagSection title="Attachments" items={(attachmentsResult.data ?? []).filter((item) => item.attachments).map((item) => ({ name: item.attachments!.name }))} />
              <TagSection title="Movement patterns" items={(patternsResult.data ?? []).filter((item) => item.movement_patterns).map((item) => ({ name: item.movement_patterns!.name }))} />
            </section>

            <section className="mt-6 rounded-2xl border border-border bg-card p-6">
              <h2 className="flex items-center gap-2 text-xl font-semibold"><Info size={19} /> Biomechanics</h2>
              <dl className="mt-5 grid grid-cols-2 gap-5 text-sm">
                <InfoField title="Resistance profile" value={label(biomech?.resistance_profile)} />
                <InfoField title="Peak resistance" value={label(biomech?.peak_resistance_position)} />
                <InfoField title="Resistance source" value={biomech?.resistance_sources?.name} />
                <InfoField title="Body position" value={biomech?.body_positions?.name} />
                <InfoField title="Plane of motion" value={biomech?.planes_of_motion?.name} />
                <InfoField title="Grip" value={biomech?.grips?.name} />
                <InfoField title="Stance" value={biomech?.stances?.name} />
                <InfoField title="Classification confidence" value={label(biomech?.classification_confidence)} />
                <InfoField title="Difficulty" value={label(content.difficulty)} />
                <InfoField title="Exercise type" value={label(content.exercise_type)} />
                <InfoField title="Mechanic" value={label(content.mechanic)} />
                <InfoField title="Force type" value={label(content.force_type)} />
                <InfoField title="Laterality" value={label(content.laterality)} />
              </dl>
              {biomech?.reviewer_notes && <p className="mt-5 border-t border-border pt-4 text-sm leading-6 text-muted-foreground">{biomech.reviewer_notes}</p>}
            </section>
            {(parentExercise || variations.length > 0) && <section className="mt-6 rounded-2xl border border-border bg-card p-6">
              <h2 className="text-xl font-semibold">Exercise family links</h2>
              {parentExercise && <div className="mt-4"><h3 className="mb-2 text-sm font-semibold text-muted-foreground">Parent movement</h3><Link className="text-primary underline" href={`/exercises/${parentExercise.slug}`}>{parentExercise.name}</Link></div>}
              {variations.length > 0 && <div className="mt-4"><h3 className="mb-2 text-sm font-semibold text-muted-foreground">Variations</h3><ul className="space-y-2">{variations.map((item) => <li key={item.slug}><Link className="text-primary underline" href={`/exercises/${item.slug}`}>{item.name}</Link></li>)}</ul></div>}
            </section>}
            {relations.some((item) => item.relation_type !== "variation_of") && <section className="mt-6 rounded-2xl border bg-card p-6">
              <h2 className="text-xl font-semibold">Related exercises</h2>
              <ul className="mt-4 space-y-3">{relations.filter((item) => item.relation_type !== "variation_of").map((relation) => {
                const isSource = relation.source_exercise_id === exercise.id;
                const related = relatedById.get(isSource ? relation.target_exercise_id : relation.source_exercise_id);
                const direction = relation.relation_type === "progression_of" ? (isSource ? "Easier variation" : "Harder variation")
                  : relation.relation_type === "regression_of" ? (isSource ? "Harder variation" : "Easier variation") : label(relation.relation_type);
                return related && <li key={`${relation.source_exercise_id}-${relation.target_exercise_id}-${relation.relation_type}`}>
                  <span className="block text-xs capitalize text-muted-foreground">{direction}</span>
                  <Link className="text-sm font-medium text-primary underline" href={`/exercises/${related.slug}`}>{related.name}</Link>
                </li>;
              })}</ul>
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
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => item.href
          ? <Link key={item.href} href={item.href} className="rounded-full bg-muted px-3 py-1.5 text-sm text-primary hover:bg-muted">{item.name}</Link>
          : <span key={item.name} className="rounded-full bg-muted px-3 py-1.5 text-sm text-primary">{item.name}</span>)}
      </div>
    </div>
  );
}

function InfoBlock({ title, value }: { title: string; value: string | null }) {
  if (!value) return null;
  return <div className="mt-6"><h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3><p className="mt-2 whitespace-pre-line leading-7 text-muted-foreground">{value}</p></div>;
}

function InfoField({ title, value }: { title: string; value: string | null | undefined }) {
  return <div><dt className="text-muted-foreground">{title}</dt><dd className="mt-1 font-semibold capitalize text-primary">{value ?? "Not classified"}</dd></div>;
}
