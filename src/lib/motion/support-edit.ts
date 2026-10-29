import { studioLayoutSchema } from "./scene-schema";
import type { AnatomyRig } from "./anatomy";
import { bakeLegacySupportScene, bakeSupportRelease, evaluateSupportScene, supportRegionLabels } from "./support-contacts";
import { identityTransform, type BenchFacing, type JointSlug, type SupportContact, type SupportRegion, type WorkshopScene } from "./workshop";

export function supportRegionForJoint(joint: JointSlug): SupportRegion {
  if (joint === "torso") return "chest";
  const side = joint.startsWith("left") ? "left" : "right";
  if (joint.endsWith("wrist") || joint.endsWith("shoulder")) return `${side}-hand`;
  if (joint.endsWith("ankle")) return `${side}-foot`;
  if (joint.endsWith("hip")) return "pelvis";
  return joint as SupportRegion;
}

/** Support placement changes the setup across the rep, never the current pose. */
export function changeSupportContact(scene: WorkshopScene, contact: SupportContact): WorkshopScene {
  const studio = scene.studio ?? { body: identityTransform, objects: [] };
  const supports = [...(studio.supports ?? [])];
  const index = supports.findIndex(item => item.region === contact.region);
  if (index < 0) supports.push(contact);
  else supports[index] = contact;
  const layout = { ...studio, supports };
  const result = studioLayoutSchema.safeParse(layout);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(issue?.path[0] === "supports" && issue.path[2] === "point"
      ? "That support point is outside the workspace. Choose a closer surface."
      : issue?.message ?? "This body part cannot use that support.");
  }
  return { ...scene, studio: layout };
}

export function pickSupportContact(scene: WorkshopScene, contact: SupportContact, rig: AnatomyRig, timeMs: number): WorkshopScene {
  const previous = scene.studio?.supports?.find(item => item.region === contact.region);
  const next = changeSupportContact(scene, { ...contact, turn: previous?.turn ?? contact.turn });
  const unreachable = evaluateSupportScene(next, rig, timeMs).find(report => !report.reachable);
  if (unreachable) {
    throw new Error(unreachable.region === contact.region
      ? "This support is beyond reach. Reposition the body or move the contact closer."
      : `${supportRegionLabels[unreachable.region]} support is beyond reach. Adjust or release it in Body part before adding this support.`);
  }
  return next;
}

export function changeBenchSupport(scene: WorkshopScene, benchId: string, facing: BenchFacing | undefined, rig: AnatomyRig): WorkshopScene {
  const studio = scene.studio;
  if (!studio?.objects.some(item => item.id === benchId && item.slug === "bench")) throw new Error("Select a bench in this scene.");
  const rootRegions = new Set<SupportRegion>(["pelvis", "chest", "back"]);
  if (!facing) {
    return (studio.supports ?? []).filter(contact => contact.objectId === benchId && rootRegions.has(contact.region))
      .reduce((next, contact) => bakeSupportRelease(next, contact.region, rig), scene);
  }
  const converted = bakeLegacySupportScene({ ...scene, studio: { ...studio, supports: undefined, seating: { benchId, facing } } }, rig);
  const supports = [...(studio.supports ?? []).filter(contact => !rootRegions.has(contact.region)), ...converted.studio!.supports!];
  return { ...converted, studio: { ...converted.studio!, supports } };
}
