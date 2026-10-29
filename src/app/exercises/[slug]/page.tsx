import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Heart, Info } from "@/components/ui/icons";
import { MediaGallery, type MediaGroup } from "@/components/catalog/media-gallery";
import { MotionInspector } from "@/components/character/motion-inspector";
import { loadWorkshopScene } from "@/lib/motion/load-scene";
import { toggleFavorite } from "@/app/favorites/actions";
import { copyPublicExercise } from "@/app/exercises/actions";
import { getIdentity } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { mediaObjectKey, signResolvedMediaObjects } from "@/lib/media/signed-media";
import { resolveRenderReplacements } from "@/lib/media/render-replacements";
import { PublicationBadge } from "@/components/catalog/publication-badge";
import { ExerciseReport } from "@/components/catalog/exercise-report";
import { ExerciseViewTracker } from "@/components/catalog/exercise-view-tracker";
import { primaryActionClass, secondaryActionClass } from "@/components/ui/page-layout";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

function label(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "Not classified";
}

export default async function ExercisePage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const identityPromise = getIdentity();
  const { data: exercise, error: exerciseError } = await supabase.from("exercises")
    .select("id,slug,current_content_id,status,favorite_count,verified_at")
    .eq("slug", slug).eq("status", "published").maybeSingle();
  if (exerciseError) throw new Error("The exercise could not be loaded");
  if (!exercise) notFound();
  const favoritePromise = identityPromise.then(async identity => {
    const result = identity ? await supabase.from("favorites").select("exercise_id")
      .eq("exercise_id", exercise.id).eq("user_id", identity.userId).maybeSingle() : { data: null, error: null };
    if (result.error) throw new Error("Your saved exercise could not be loaded");
    return result.data;
  });

  const contentId = exercise.current_content_id;
  const [contentResult, musclesResult, jointsResult, actionsResult, equipmentResult,
    attachmentsResult, patternsResult, aliasesResult, biomechanicsResult, mediaResult,
    relationsResult, scene, savedFavorite, identity] = await Promise.all([
    supabase.from("exercise_content").select("*,exercise_families(name,slug)").eq("id", contentId).single(),
    supabase.from("exercise_muscles").select("role,muscles(name,slug)").eq("content_id", contentId),
    supabase.from("exercise_joints").select("role,joints(name,slug)").eq("content_id", contentId),
    supabase.from("exercise_joint_actions").select("role,joint_actions(name,slug,joints(name))").eq("content_id", contentId),
    supabase.from("exercise_equipment").select("role,equipment(name,slug)").eq("content_id", contentId),
    supabase.from("exercise_attachments").select("attachments(name,slug)").eq("content_id", contentId),
    supabase.from("exercise_movement_patterns").select("movement_patterns(name,slug)").eq("content_id", contentId),
    supabase.from("exercise_aliases").select("alias").eq("content_id", contentId),
    supabase.from("exercise_biomechanics").select("resistance_profile,peak_resistance_position,classification_confidence,reviewer_notes,body_positions(name),grips(name),stances(name),planes_of_motion(name),resistance_sources(name)").eq("content_id", contentId).maybeSingle(),
    supabase.from("exercise_media").select("kind,storage_bucket,storage_path,asset_group_id,camera_angle,character_presentation,license_name,source_credit").eq("content_id", contentId),
    supabase.from("exercise_relations").select("source_exercise_id,target_exercise_id,relation_type,source:exercises!exercise_relations_source_exercise_id_fkey(id,slug,status,exercise_content(name)),target:exercises!exercise_relations_target_exercise_id_fkey(id,slug,status,exercise_content(name))")
      .or(`source_exercise_id.eq.${exercise.id},target_exercise_id.eq.${exercise.id}`),
    loadWorkshopScene(contentId),
    favoritePromise,
    identityPromise,
  ]);
  if ([contentResult, musclesResult, jointsResult, actionsResult, equipmentResult, attachmentsResult,
    patternsResult, aliasesResult, biomechanicsResult, mediaResult, relationsResult].some((result) => result.error)) {
    throw new Error("The exercise details could not be loaded");
  }

  const content = contentResult.data;
  if (!content) notFound();
  const biomech = biomechanicsResult.data;
  const media = await resolveRenderReplacements(mediaResult.data ?? []);
  const signedMedia = await signResolvedMediaObjects(media);
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
  const relatedById = new Map<string, { slug: string; name: string }>();
  for (const relation of relations) for (const related of [relation.source, relation.target]) {
    if (related && related.id !== exercise.id && related.status === "published") {
      relatedById.set(related.id, { slug: related.slug, name: related.exercise_content?.name ?? related.slug });
    }
  }
  const variations = relations.filter((item) => item.relation_type === "variation_of" && item.target_exercise_id === exercise.id)
    .map((item) => relatedById.get(item.source_exercise_id)).filter((item) => item !== undefined);
  const parent = relations.find((item) => item.relation_type === "variation_of" && item.source_exercise_id === exercise.id);
  const parentExercise = parent ? relatedById.get(parent.target_exercise_id) : undefined;
  const family = content.exercise_families;
  const hasInstructions = [content.setup_instructions, content.execution_instructions, content.form_cues,
    content.common_mistakes, content.safety_notes, content.range_of_motion_notes].some(value => value?.trim());

  return (
    <main className="min-h-screen bg-background text-foreground">
      {identity && <ExerciseViewTracker exerciseId={exercise.id} />}
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-10">
        <Link href="/exercises" className="inline-flex min-h-11 items-center gap-2 text-sm text-primary underline-offset-4 hover:underline"><ArrowLeft size={16} /> Back to Explore</Link>
        <header className="mb-8 mt-6 min-w-0">
          <PublicationBadge verifiedAt={exercise.verified_at} />
          <h1 className="mt-3 break-words text-[1.75rem] font-semibold leading-tight sm:text-[2rem]">{content.name}</h1>
          {family && <Link href={`/families/${family.slug}`} className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline">{family.name} family</Link>}
          {content.short_description && <p className="mt-3 max-w-prose text-base leading-7 text-muted-foreground">{content.short_description}</p>}
          {(aliasesResult.data?.length ?? 0) > 0 && <p className="mt-4 text-sm text-muted-foreground">Also known as: {aliasesResult.data?.map((item) => item.alias).join(", ")}</p>}
        </header>
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.88fr)_minmax(300px,1fr)] lg:gap-x-12">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <MediaGallery groups={[...groups.values()]} annotations={scene?.annotations} />
          </div>
          <div className="min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2">
            <div className="space-y-3">
              {identity ? <form action={toggleFavorite}>
                <input type="hidden" name="exerciseId" value={exercise.id} />
                <input type="hidden" name="slug" value={exercise.slug} />
                <button type="submit" aria-pressed={Boolean(savedFavorite)} className={`${primaryActionClass} w-full`}>
                  <Heart size={17} fill={savedFavorite ? "currentColor" : "none"} /> {savedFavorite ? "Saved" : "Save favorite"}
                </button>
              </form> : <Link href={`/sign-in?next=${encodeURIComponent(`/exercises/${exercise.slug}`)}`}
                className={`${primaryActionClass} w-full`}>
                <Heart size={17} /> Sign in to save
              </Link>}
              <p className="text-xs text-muted-foreground">{exercise.favorite_count} saved</p>
            </div>
            {identity && <form action={copyPublicExercise} className="mt-4">
              <input type="hidden" name="exerciseId" value={exercise.id} />
              <button type="submit" className={`${secondaryActionClass} w-full`}>Copy to my exercises</button>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">Make an independent private copy of this exercise. The motion is included when its creator allowed reuse.</p>
            </form>}
            {scene && <MotionInspector scene={scene} />}
            <section aria-label="Anatomy and equipment" className="mt-6 divide-y divide-border border-t border-border">
              <h2 className="py-6 text-xl font-semibold">Anatomy and equipment</h2>
              <TagSection title="Primary muscles" items={(musclesResult.data ?? []).filter((item) => item.role === "primary" && item.muscles).map((item) => ({ name: item.muscles!.name, href: `/muscles/${item.muscles!.slug}` }))} />
              <TagSection title="Secondary muscles" items={(musclesResult.data ?? []).filter((item) => item.role === "secondary" && item.muscles).map((item) => ({ name: item.muscles!.name, href: `/muscles/${item.muscles!.slug}` }))} />
              <TagSection title="Stabilizers" items={(musclesResult.data ?? []).filter((item) => item.role === "stabilizer" && item.muscles).map((item) => ({ name: item.muscles!.name, href: `/muscles/${item.muscles!.slug}` }))} />
              <TagSection title="Joints" items={(jointsResult.data ?? []).filter((item) => item.joints).map((item) => ({ name: item.joints!.name, href: `/joints/${item.joints!.slug}` }))} />
              <div className="py-5">
                <h3 className="mb-2 text-xs text-muted-foreground">Joint actions</h3>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {(actionsResult.data ?? []).map((item) => item.joint_actions && (
                    <Link key={item.joint_actions.slug} href={`/joint-actions/${item.joint_actions.slug}`}
                      className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline">
                      {item.joint_actions.joints?.name} {item.joint_actions.name}
                    </Link>
                  ))}
                </div>
              </div>
              <TagSection title="Equipment" items={(equipmentResult.data ?? []).filter((item) => item.equipment).map((item) => ({ name: item.equipment!.name, href: `/equipment/${item.equipment!.slug}` }))} />
              <TagSection title="Attachments" items={(attachmentsResult.data ?? []).filter((item) => item.attachments).map((item) => ({ name: item.attachments!.name }))} />
              <TagSection title="Movement patterns" items={(patternsResult.data ?? []).filter((item) => item.movement_patterns).map((item) => ({ name: item.movement_patterns!.name }))} />
            </section>

            <details className="border-y border-border py-4">
              <summary className="min-h-11 cursor-pointer text-sm font-medium text-primary"><span className="inline-flex items-center gap-2"><Info size={17} aria-hidden /> Biomechanics</span></summary>
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
            </details>
            {(parentExercise || variations.length > 0) && <section className="mt-6 border-b border-border pb-6">
              <h2 className="text-xl font-semibold">Exercise family links</h2>
              {parentExercise && <div className="mt-4"><h3 className="mb-2 text-sm font-semibold text-muted-foreground">Parent movement</h3><Link className="text-primary underline" href={`/exercises/${parentExercise.slug}`}>{parentExercise.name}</Link></div>}
              {variations.length > 0 && <div className="mt-4"><h3 className="mb-2 text-sm font-semibold text-muted-foreground">Variations</h3><ul className="space-y-2">{variations.map((item) => <li key={item.slug}><Link className="text-primary underline" href={`/exercises/${item.slug}`}>{item.name}</Link></li>)}</ul></div>}
            </section>}
            {relations.some((item) => item.relation_type !== "variation_of") && <section className="mt-6 border-b border-border pb-6">
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
          {hasInstructions && <section className="min-w-0 border-t border-border pt-6 lg:col-start-1 lg:row-start-2">
            <h2 className="text-xl font-semibold">How to perform it</h2>
            <InfoBlock title="Setup" value={content.setup_instructions} />
            <InfoBlock title="Execution" value={content.execution_instructions} />
            <InfoBlock title="Form cues" value={content.form_cues} />
            <InfoBlock title="Common mistakes" value={content.common_mistakes} />
            <InfoBlock title="Safety notes" value={content.safety_notes} />
            <InfoBlock title="Range of motion" value={content.range_of_motion_notes} />
          </section>}
        </div>
        <div className="mt-8 border-t border-border pt-4">
          {identity ? <ExerciseReport exerciseId={exercise.id} /> : <Link href={`/sign-in?next=${encodeURIComponent(`/exercises/${exercise.slug}`)}`} className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline">Sign in to report</Link>}
          {identity && identity.role !== "user" && <Link href={`/admin/exercises/${exercise.id}`} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">Moderate exercise</Link>}
        </div>
      </div>
    </main>
  );
}

function TagSection({ title, items }: { title: string; items: { name: string; href?: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="py-5">
      <h3 className="mb-2 text-xs text-muted-foreground">{title}</h3>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {items.map((item) => item.href
          ? <Link key={item.href} href={item.href} className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline">{item.name}</Link>
          : <span key={item.name} className="inline-flex min-h-11 items-center text-sm">{item.name}</span>)}
      </div>
    </div>
  );
}

function InfoBlock({ title, value }: { title: string; value: string | null }) {
  if (!value?.trim()) return null;
  return <div className="mt-6 border-t border-border pt-5"><h3 className="text-base font-semibold">{title}</h3><p className="mt-2 max-w-prose whitespace-pre-line leading-7 text-muted-foreground">{value}</p></div>;
}

function InfoField({ title, value }: { title: string; value: string | null | undefined }) {
  return <div><dt className="text-muted-foreground">{title}</dt><dd className="mt-1 font-semibold capitalize text-primary">{value ?? "Not classified"}</dd></div>;
}
