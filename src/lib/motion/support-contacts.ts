import { Euler, Group, Matrix3, Quaternion, Vector3 } from "three";
import { correctAuthoredArmPath, plantAnatomyFeet, poseAnatomyRig, type AnatomyRig } from "./anatomy";
import { forearmRotationForScene } from "./equipment-motion";
import { solveBarbellContact } from "./barbell-contact";
import { sampleHeldWeightPose } from "./held-weight-pose";
import { constrainFrontalPose } from "./studio-constraints";
import { supportSurfaceFromWorld, supportSurfaceToWorld } from "./support-surfaces";
import { applyStudioSeating } from "./studio-seat";
import { clamp, sampleStudioObject } from "./studio";
import { identityTransform, jointLimits, sampleWorkshopPose, type JointSlug, type RigPose, type StudioLayout, type SupportRegion, type WorkshopScene } from "./workshop";

export type SupportSolveReport = { region: SupportRegion; error: number; reachable: boolean; orientationErrorDegrees?: number; orientationLimited?: boolean };
export const supportRegionLabels: Record<SupportRegion, string> = {
  "left-hand": "Left hand", "right-hand": "Right hand", "left-forearm": "Left forearm", "right-forearm": "Right forearm",
  "left-elbow": "Left elbow", "right-elbow": "Right elbow", "left-knee": "Left knee", "right-knee": "Right knee",
  "left-foot": "Left foot", "right-foot": "Right foot", pelvis: "Pelvis", chest: "Chest", back: "Back of torso",
};
const up = new Vector3(0, 1, 0), radians = Math.PI / 180;
const emptyReports: SupportSolveReport[] = [];
// The atlas's open fingers curve toward the palm; this frame rests the palm heel and keeps them above the surface.
const palmSupportRotation = {
  left: new Quaternion().setFromEuler(new Euler(Math.PI / 6, .15, 0)),
  right: new Quaternion().setFromEuler(new Euler(Math.PI / 6, -.15, 0)),
};

function supportCenter(rig: AnatomyRig, region: SupportRegion, target: Vector3) {
  const side = region.startsWith("left") ? "left" : "right";
  if (region === "pelvis") return rig.bones.pelvis.localToWorld(target.set(0, -.27, 0));
  if (region === "chest" || region === "back") return rig.bones.torso.localToWorld(target.set(0, .62, region === "chest" ? .315 : -.175));
  if (region.endsWith("forearm")) return rig.bones[`${side}-elbow`].getWorldPosition(target).lerp(rig.handBones[side].getWorldPosition(new Vector3()), .55);
  // Contact the intrinsic palm tissue, excluding the forearm's long flexor tendons.
  if (region.endsWith("hand")) return rig.handBones[side].localToWorld(target.set(0, -.09, .085));
  if (region.endsWith("foot")) return rig.footBones[side].localToWorld(target.set(0, -.105, .10));
  return rig.bones[`${side}-${region.endsWith("knee") ? "knee" : "elbow"}`].getWorldPosition(target);
}

function supportRadius(region: SupportRegion) {
  return region.endsWith("knee") ? .02 : region.endsWith("elbow") || region.endsWith("forearm") ? .055 : region.endsWith("hand") ? .025 : region.endsWith("foot") ? .035 : 0;
}

export function supportContactPoint(rig: AnatomyRig, region: SupportRegion, normal = up) {
  return supportCenter(rig, region, new Vector3()).addScaledVector(normal, -supportRadius(region) * rig.root.getWorldScale(new Vector3()).x);
}

export function supportElbowTarget(rig: AnatomyRig, studio: StudioLayout | undefined, side: "left" | "right", timeMs = 0) {
  const contact = studio?.supports?.find(contact => contact.region === `${side}-elbow`);
  const frame = contact && studio ? supportSurfaceToWorld(contact, studio, timeMs, rig) : undefined;
  return frame?.point.addScaledVector(frame.normal, supportRadius(`${side}-elbow`) * rig.root.getWorldScale(new Vector3()).x);
}

function applyAngles(rig: AnatomyRig, slug: JointSlug, values: number[]) {
  rig.bones[slug].rotation.set(values[0] * radians * (slug.endsWith("elbow") || slug.endsWith("knee") ? -1 : 1), values[1] * radians, -values[2] * radians);
}

function orientSupportEndpoint(rig: AnatomyRig, region: SupportRegion, normal: Vector3, turn: number, surfaceRotation: Quaternion, localNormal: { x: number; y: number; z: number }) {
  if (!region.endsWith("hand") && !region.endsWith("foot")) return;
  const side = region.startsWith("left") ? "left" : "right", hand = region.endsWith("hand");
  const endpoint = hand ? rig.handBones[side] : rig.footBones[side];
  const outward = new Vector3(0, hand ? 0 : -1, hand ? 1 : 0);
  const desired = surfaceRotation.clone().multiply(new Quaternion().setFromUnitVectors(outward, new Vector3(localNormal.x, localNormal.y, localNormal.z).normalize().negate()));
  if (hand) desired.multiply(palmSupportRotation[side]);
  if (turn) desired.premultiply(new Quaternion().setFromAxisAngle(normal, turn * radians));
  if (!hand) {
    endpoint.quaternion.copy(endpoint.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(desired));
    const limits = jointLimits[`${side}-ankle`];
    endpoint.rotation.set(Math.max(-limits.x[1] * radians, Math.min(-limits.x[0] * radians, endpoint.rotation.x)),
      Math.max(limits.y[0] * radians, Math.min(limits.y[1] * radians, endpoint.rotation.y)),
      Math.max(-limits.z[1] * radians, Math.min(-limits.z[0] * radians, endpoint.rotation.z)));
    return;
  }
  // Wrist turn belongs to the forearm bone; never add an unsaveable hand Y rotation.
  const forearm = rig.forearmBones[side], axis = endpoint.position.clone().normalize(), sign = side === "left" ? 1 : -1;
  const initial = [2 * Math.atan2(new Vector3(forearm.quaternion.x, forearm.quaternion.y, forearm.quaternion.z).dot(axis), forearm.quaternion.w) / radians / sign - 90,
    endpoint.rotation.x / radians, -endpoint.rotation.z / radians];
  const limits = jointLimits[`${side}-wrist`], ranges = [limits.x, limits.y, limits.z];
  const set = (angles: number[]) => {
    forearm.quaternion.setFromAxisAngle(axis, sign * (angles[0] + 90) * radians);
    endpoint.rotation.set(angles[1] * radians, 0, -angles[2] * radians);
    return endpoint.getWorldQuaternion(new Quaternion()).angleTo(desired);
  };
  const values = initial.map((value, index) => Math.max(ranges[index][0], Math.min(ranges[index][1], value)));
  let error = set(values);
  for (const step of [20, 8, 3, 1]) for (let iteration = 0; iteration < 3; iteration++) {
    let changed = false;
    for (let index = 0; index < 3; index++) {
      const original = values[index]; let best = original;
      for (const direction of [-1, 1]) {
        values[index] = Math.max(ranges[index][0], Math.min(ranges[index][1], original + direction * step));
        const next = set(values);
        if (next < error) { error = next; best = values[index]; changed = true; }
      }
      values[index] = best;
    }
    if (!changed) break;
  }
  set(values);
}

function solveTorsoSupport(rig: AnatomyRig, region: SupportRegion, target: Vector3, normal: Vector3) {
  const torso = rig.bones.torso, values = [torso.rotation.x / radians, torso.rotation.y / radians, torso.rotation.z / radians];
  const ranges = [jointLimits.torso.x, jointLimits.torso.y, jointLimits.torso.z];
  const evaluate = () => { torso.rotation.set(values[0] * radians, values[1] * radians, values[2] * radians); return supportContactPoint(rig, region, normal).distanceTo(target); };
  let error = evaluate();
  for (const step of [12, 5, 2, .5, .1]) for (let iteration = 0; iteration < 8 && error > .001; iteration++) {
    let changed = false;
    for (let axis = 0; axis < 3; axis++) {
      const initial = values[axis]; let best = initial;
      for (const direction of [-1, 1]) {
        values[axis] = Math.max(ranges[axis][0], Math.min(ranges[axis][1], initial + direction * step));
        const next = evaluate();
        if (next < error) { best = values[axis]; error = next; changed = true; }
      }
      values[axis] = best;
    }
    if (!changed) break;
  }
  evaluate();
}

/** Small bounded least-squares solve; only the supported limb is changed. */
function solveSupportLimb(rig: AnatomyRig, region: SupportRegion, target: Vector3, normal: Vector3) {
  const side = region.startsWith("left") ? "left" : "right", leg = region.endsWith("foot") || region.endsWith("knee");
  const upper: JointSlug = `${side}-${leg ? "hip" : "shoulder"}`, hinge: JointSlug = `${side}-${leg ? "knee" : "elbow"}`;
  const distal = !region.endsWith("elbow") && !region.endsWith("knee");
  const a = rig.bones[upper].rotation, b = rig.bones[hinge].rotation;
  const base = [a.x / radians, a.y / radians, -a.z / radians, -b.x / radians];
  const limits = [jointLimits[upper].x, jointLimits[upper].y, jointLimits[upper].z, distal ? jointLimits[hinge].x : [base[3], base[3]]];
  const hand = region.endsWith("hand"), axis = rig.handBones[side].position.clone().normalize(), sign = side === "left" ? 1 : -1;
  if (hand) {
    const q = rig.forearmBones[side].quaternion, wrist = rig.handBones[side].rotation, ranges = jointLimits[`${side}-wrist`];
    base.push(2 * Math.atan2(new Vector3(q.x, q.y, q.z).dot(axis), q.w) / radians / sign - 90, wrist.x / radians, -wrist.z / radians);
    limits.push(ranges.x, ranges.y, ranges.z);
  }
  const bound = (values: number[]) => values.map((value, i) => Math.max(limits[i][0], Math.min(limits[i][1], value)));
  const hingeYZ = [b.y / radians, -b.z / radians];
  const evaluate = (values: number[]) => {
    applyAngles(rig, upper, values); applyAngles(rig, hinge, [values[3], ...hingeYZ]);
    if (hand) {
      rig.forearmBones[side].quaternion.setFromAxisAngle(axis, sign * (values[4] + 90) * radians);
      rig.handBones[side].rotation.set(values[5] * radians, 0, -values[6] * radians);
    }
    // Endpoint world queries update ancestors only; do not traverse anatomy meshes per trial.
    return supportContactPoint(rig, region, normal);
  };
  let values = bound(base), best = values.slice(), bestError = evaluate(values).distanceTo(target);
  if (bestError < .001) return;
  if (distal && Math.abs(values[3]) < 2) values[3] = leg ? -12 : 12;
  for (let iteration = 0; iteration < 48; iteration++) {
    const at = evaluate(values), delta = target.clone().sub(at), error = delta.length();
    if (error < bestError) { best = values.slice(); bestError = error; }
    if (error < .001) break;
    const derivatives = values.map((value, axis) => {
      if (limits[axis][0] === limits[axis][1]) return new Vector3();
      const next = values.slice(); next[axis] = value + .1;
      return evaluate(next).sub(at).multiplyScalar(10);
    });
    const matrix = new Matrix3();
    const elements = new Array<number>(9).fill(0);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) elements[row * 3 + col] = derivatives.reduce((sum, derivative) => sum + derivative.getComponent(row) * derivative.getComponent(col), row === col ? .00001 : 0);
    matrix.set(...elements as [number, number, number, number, number, number, number, number, number]).invert();
    const correction = delta.applyMatrix3(matrix);
    const step = derivatives.map(derivative => Math.max(-12, Math.min(12, derivative.dot(correction))));
    let accepted = false;
    for (const fraction of [1, .5, .25, .1]) {
      const next = bound(values.map((value, axis) => value + step[axis] * fraction));
      if (evaluate(next).distanceTo(target) < error) { values = next; accepted = true; break; }
    }
    if (!accepted) break;
  }
  if (evaluate(values).distanceTo(target) < bestError) best = values;
  evaluate(best);
}

export function applyStudioSupports(rig: AnatomyRig, studio: StudioLayout | undefined, timeMs: number, pose: RigPose): SupportSolveReport[] {
  if (!studio?.supports?.length) return emptyReports;
  const self = studio.supports.some(contact => contact.surface.startsWith("self:"));
  const body = self ? studio.supports.filter(contact => !/-(hand|forearm|elbow)$/.test(contact.region)) : [];
  if (body.length) {
    // Settle the body and legs before solving arms anchored to them.
    const arms = studio.supports.filter(contact => /-(hand|forearm|elbow)$/.test(contact.region));
    const reports = [...applyStudioSupports(rig, { ...studio, supports: body }, timeMs, pose),
      ...applyStudioSupports(rig, { ...studio, supports: arms }, timeMs, pose)];
    return studio.supports.map(contact => reports.find(report => report.region === contact.region)!);
  }
  // Authored pose remains the source of free joints; supported chains only override their own bones.
  void pose;
  const contacts = studio.supports.map(contact => ({ contact, frame: supportSurfaceToWorld(contact, studio, timeMs, rig) }));
  const endpoints = contacts.map(({ contact }) => {
    const side = contact.region.startsWith("left") ? "left" : "right";
    if (!contact.region.endsWith("hand") && !contact.region.endsWith("foot")) return;
    const endpoint = contact.region.endsWith("hand") ? rig.handBones[side] : rig.footBones[side];
    return { endpoint, rotation: endpoint.quaternion.clone(), forearm: rig.forearmBones[side], forearmRotation: rig.forearmBones[side].quaternion.clone() };
  });
  const root = contacts.find(({ contact, frame }) => frame && contact.region === "pelvis")
    ?? contacts.find(({ contact, frame }) => frame && ["chest", "back"].includes(contact.region));
  if (root?.frame) {
    const region = root.contact.region, normal = root.frame.normal;
    const localNormal = region === "pelvis" ? new Vector3(0, -1, 0) : new Vector3(0, 0, region === "chest" ? 1 : -1);
    const localTarget = new Vector3(root.contact.normal.x, root.contact.normal.y, root.contact.normal.z).normalize().negate();
    const world = root.frame.rotation.clone().multiply(new Quaternion().setFromUnitVectors(localNormal.normalize(), localTarget));
    // Remove the authored torso rotation after facing the surface, so chest bracing cannot choose an upside-down half-turn.
    if (region !== "pelvis") world.multiply(rig.bones.torso.quaternion.clone().invert());
    if (root.contact.turn) world.premultiply(new Quaternion().setFromAxisAngle(normal, root.contact.turn * radians));
    const parent = rig.root.parent?.getWorldQuaternion(new Quaternion()) ?? new Quaternion();
    rig.root.quaternion.copy(parent.invert().multiply(world)); rig.root.updateWorldMatrix(true, true);
    const displacement = root.frame.point.clone().sub(supportContactPoint(rig, region, normal));
    const origin = rig.root.getWorldPosition(new Vector3()).add(displacement);
    rig.root.position.copy(rig.root.parent ? rig.root.parent.worldToLocal(origin) : origin); rig.root.updateWorldMatrix(true, true);
  }
  for (const item of contacts) if (item !== root && item.frame && ["chest", "back"].includes(item.contact.region)) {
    solveTorsoSupport(rig, item.contact.region, item.frame.point, item.frame.normal);
  }
  for (const { contact, frame } of contacts) {
    if (!frame || !contact.surface.startsWith("self:") || !contact.region.endsWith("hand")) continue;
    const side = contact.region.startsWith("left") ? "left" : "right";
    const raised = rig.bones.torso.worldToLocal(frame.point.clone()).y > .1;
    // Start in front of the body; the straight-arm solve can fold through the torso.
    rig.bones[`${side}-shoulder`].rotation.set((raised ? -20 : 0) * radians, 0, (side === "left" ? 15 : -15) * radians);
    rig.bones[`${side}-elbow`].rotation.set(-(raised ? 110 : 15) * radians, 0, 0);
  }
  // Repeat once for compatible forearm/hand contacts sharing one chain.
  for (let pass = 0; pass < 3; pass++) for (const entry of contacts) {
    const { contact } = entry;
    if (contact.surface.startsWith("self:")) entry.frame = supportSurfaceToWorld(contact, studio, timeMs, rig);
    const { frame } = entry;
    if (frame && !["pelvis", "chest", "back"].includes(contact.region)) {
      if (contact.surface.startsWith("self:") && contact.region.endsWith("hand")) {
        const side = contact.region.startsWith("left") ? "left" : "right";
        // The first fit establishes a natural heading; turn it on the second fit.
        const palmHeading = pass === 1 && contact.turn ? new Vector3(1, 0, 0)
          .applyQuaternion(rig.handBones[side].getWorldQuaternion(new Quaternion()))
          .applyAxisAngle(frame.normal, contact.turn * radians) : undefined;
        if (pass < 2) solveBarbellContact(rig, side, { ...pose, [`${side}-elbow`]: { x: 0, y: 0, z: 0 } },
          frame.point.clone().addScaledVector(frame.normal, supportRadius(contact.region) * rig.root.getWorldScale(new Vector3()).x), new Vector3(1, 0, 0), false,
          { palmNormal: frame.normal.clone().negate(), palmHeading, palmOffset: new Vector3(0, -.09, .085) });
        if (contact.surface !== "self:torso" && supportContactPoint(rig, contact.region, frame.normal).distanceTo(frame.point) > .005 * studio.body.scale) {
          solveSupportLimb(rig, contact.region, frame.point, frame.normal);
        }
        continue;
      }
      if (pass < 2) orientSupportEndpoint(rig, contact.region, frame.normal, contact.turn, frame.rotation, contact.normal);
      solveSupportLimb(rig, contact.region, frame.point, frame.normal);
    }
  }
  // A bounded wrist/ankle cannot always lie flat. Preserve contact before sacrificing reach.
  for (let index = 0; index < contacts.length; index++) {
    const { contact, frame } = contacts[index], saved = endpoints[index];
    if (contact.surface.startsWith("self:") && contact.region.endsWith("hand")) continue;
    if (!frame || !saved || supportContactPoint(rig, contact.region, frame.normal).distanceTo(frame.point) <= .005 * studio.body.scale) continue;
    const rotation = saved.endpoint.quaternion.clone(), forearmRotation = saved.forearm.quaternion.clone();
    const upperSide = contact.region.startsWith("left") ? "left" : "right", leg = contact.region.endsWith("foot");
    const upper = rig.bones[`${upperSide}-${leg ? "hip" : "shoulder"}`], hinge = rig.bones[`${upperSide}-${leg ? "knee" : "elbow"}`];
    const upperRotation = upper.quaternion.clone(), hingeRotation = hinge.quaternion.clone();
    const previousError = supportContactPoint(rig, contact.region, frame.normal).distanceTo(frame.point);
    saved.endpoint.quaternion.copy(saved.rotation); saved.forearm.quaternion.copy(saved.forearmRotation);
    solveSupportLimb(rig, contact.region, frame.point, frame.normal);
    if (supportContactPoint(rig, contact.region, frame.normal).distanceTo(frame.point) > previousError) {
      saved.endpoint.quaternion.copy(rotation); saved.forearm.quaternion.copy(forearmRotation); upper.quaternion.copy(upperRotation); hinge.quaternion.copy(hingeRotation);
    }
  }
  rig.root.updateWorldMatrix(true, true); rig.skeleton.update();
  return contacts.map(({ contact, frame }) => {
    const error = frame ? supportContactPoint(rig, contact.region, frame.normal).distanceTo(frame.point) : Infinity;
    const hand = contact.region.endsWith("hand"), foot = contact.region.endsWith("foot"), side = contact.region.startsWith("left") ? "left" : "right";
    const orientationErrorDegrees = frame && (hand || foot)
      ? (hand ? contact.surface.startsWith("self:") ? new Vector3(0, 0, 1) : new Vector3(0, 0, 1).applyQuaternion(palmSupportRotation[side].clone().invert()) : new Vector3(0, -1, 0)).applyQuaternion((hand ? rig.handBones[side] : rig.footBones[side]).getWorldQuaternion(new Quaternion())).angleTo(frame.normal.clone().negate()) / radians : undefined;
    return { region: contact.region, error, reachable: error <= .005 * studio.body.scale,
      ...(orientationErrorDegrees !== undefined ? { orientationErrorDegrees, orientationLimited: orientationErrorDegrees > 25 } : {}) };
  });
}

/** Explicit bounded preview. The caller commits only a fully reachable result. */
export function previewSupportReposition(rig: AnatomyRig, studio: StudioLayout, timeMs: number, pose: RigPose) {
  const originalPosition = rig.root.position.clone(), originalRotation = rig.root.quaternion.clone();
  const rotations = Object.values(rig.bones).map(bone => [bone, bone.quaternion.clone()] as const);
  let reports = applyStudioSupports(rig, studio, timeMs, pose);
  const delta = new Vector3();
  if (!studio.supports?.some(contact => ["pelvis", "chest", "back"].includes(contact.region))) {
    for (let iteration = 0; iteration < 8 && reports.some(report => !report.reachable); iteration++) {
      const correction = new Vector3(); let count = 0;
      for (const contact of studio.supports ?? []) {
        const frame = supportSurfaceToWorld(contact, studio, timeMs, rig);
        if (frame && !contact.surface.startsWith("self:")) { correction.add(frame.point.clone().sub(supportContactPoint(rig, contact.region, frame.normal))); count++; }
      }
      if (!count) break;
      correction.divideScalar(count).clampLength(0, .12);
      const next = delta.clone().add(correction).clampLength(0, .75);
      const world = rig.root.getWorldPosition(new Vector3()).add(next.clone().sub(delta)); delta.copy(next);
      rig.root.position.copy(rig.root.parent ? rig.root.parent.worldToLocal(world) : world);
      reports = applyStudioSupports(rig, studio, timeMs, pose);
    }
  }
  const body = { ...studio.body, x: studio.body.x + delta.x, y: studio.body.y + delta.y, z: studio.body.z + delta.z };
  rig.root.position.copy(originalPosition); rig.root.quaternion.copy(originalRotation);
  for (const [bone, rotation] of rotations) bone.quaternion.copy(rotation);
  rig.root.updateWorldMatrix(true, true); rig.skeleton.update();
  return { body, reachable: reports.every(report => report.reachable), reports };
}

export function supportPoseFromRig(rig: AnatomyRig): RigPose {
  const pose: RigPose = {};
  for (const slug of Object.keys(jointLimits) as JointSlug[]) {
    if (slug.endsWith("wrist")) {
      const side = slug.startsWith("left") ? "left" : "right", hand = rig.handBones[side], forearm = rig.forearmBones[side], axis = hand.position.clone().normalize();
      pose[slug] = { x: 2 * Math.atan2(new Vector3(forearm.quaternion.x, forearm.quaternion.y, forearm.quaternion.z).dot(axis), forearm.quaternion.w) / radians / (side === "left" ? 1 : -1) - 90,
        y: hand.rotation.x / radians, z: -hand.rotation.z / radians };
    } else {
      const rotation = new Euler().setFromQuaternion(rig.bones[slug].quaternion);
      pose[slug] = { x: rotation.x / radians * (slug.endsWith("elbow") || slug.endsWith("knee") || slug.endsWith("ankle") ? -1 : 1), y: rotation.y / radians, z: rotation.z / radians * (slug === "torso" ? 1 : -1) };
    }
    for (const axis of ["x", "y", "z"] as const) {
      const bounded = clamp(pose[slug]![axis], ...jointLimits[slug][axis]);
      if (Math.abs(pose[slug]![axis] - bounded) < 1e-8) pose[slug]![axis] = bounded;
    }
  }
  return pose;
}

function withSupportScene<T>(scene: WorkshopScene, rig: AnatomyRig, timeMs: number, operation: (pose: RigPose) => T): T {
  const parent = rig.root.parent, position = rig.root.position.clone(), rotation = rig.root.quaternion.clone(), scale = rig.root.scale.clone();
  const bones = [...new Set([...Object.values(rig.bones), ...Object.values(rig.forearmBones), ...Object.values(rig.handBones), ...Object.values(rig.footBones), ...Object.values(rig.shoulderCaps), ...rig.fingerSegments.map(segment => segment.bone)])].map(bone => [bone, bone.quaternion.clone()] as const);
  const body = new Group(), transform = scene.studio?.body ?? identityTransform;
  body.position.set(transform.x, transform.y, transform.z); body.rotation.set(transform.rotationX * radians, transform.rotationY * radians, transform.rotationZ * radians); body.scale.setScalar(transform.scale); body.add(rig.root);
  try {
    const pose = constrainFrontalPose(sampleWorkshopPose(scene.keyframes, timeMs), scene.studio?.frontalPlane);
    poseAnatomyRig(rig, pose, false, forearmRotationForScene(scene)); plantAnatomyFeet(rig, scene.motionStyle, pose); correctAuthoredArmPath(rig, scene.motionStyle, pose);
    return operation(pose);
  } finally {
    body.remove(rig.root); parent?.add(rig.root); rig.root.position.copy(position); rig.root.quaternion.copy(rotation); rig.root.scale.copy(scale);
    for (const [bone, quaternion] of bones) bone.quaternion.copy(quaternion);
    rig.root.updateWorldMatrix(true, true); rig.skeleton.update();
  }
}

export function evaluateSupportScene(scene: WorkshopScene, rig: AnatomyRig, timeMs: number) {
  return withSupportScene(scene, rig, timeMs, pose => applyStudioSupports(rig, scene.studio, timeMs, pose));
}

export function previewSupportSceneReposition(scene: WorkshopScene, rig: AnatomyRig, timeMs: number) {
  return withSupportScene(scene, rig, timeMs, pose => previewSupportReposition(rig, scene.studio!, timeMs, pose));
}

/** Bake affected joints before removing their constraint so release never snaps a limb. */
export function bakeSupportRelease(scene: WorkshopScene, region: SupportRegion, rig: AnatomyRig): WorkshopScene {
  if (!scene.studio?.supports?.some(contact => contact.region === region)) return scene;
  let body = scene.studio.body;
  const rootSupport = ["pelvis", "chest", "back"].includes(region);
  const released = scene.studio.supports.find(contact => contact.region === region)!;
  if (rootSupport && scene.studio.objects.find(object => object.id === released.objectId)?.frames?.length) {
    throw new Error("Stop the supporting equipment's animation before releasing this body support; body placement cannot store an animated path.");
  }
  let rootPosition: Vector3 | undefined, rootRotation: Quaternion | undefined;
  const keyframes = scene.keyframes.map((frame, index) => withSupportScene(scene, rig, frame.timeMs, () => {
    const pose = sampleHeldWeightPose(scene, frame.timeMs);
    poseAnatomyRig(rig, pose, false, forearmRotationForScene(scene));
    const reports = applyStudioSupports(rig, scene.studio, frame.timeMs, pose);
    // A failed anchor must not replace the authored limb pose when removed.
    if (!rootSupport && reports.some(report => report.region === region && !report.reachable)) return frame;
    if (rootSupport) {
      const position = rig.root.getWorldPosition(new Vector3()), rotation = rig.root.getWorldQuaternion(new Quaternion());
      if (rootPosition && rootRotation && (position.distanceTo(rootPosition) > .001 || rotation.angleTo(rootRotation) > .001)) {
        throw new Error("Keep this body support attached while the torso moves; releasing it would require an animated body path.");
      }
      rootPosition ??= position; rootRotation ??= rotation;
    }
    if (rootSupport && index === 0) {
      const position = rig.root.getWorldPosition(new Vector3()), rotation = new Euler().setFromQuaternion(rig.root.getWorldQuaternion(new Quaternion()));
      body = { x: position.x, y: position.y, z: position.z, rotationX: rotation.x / radians, rotationY: rotation.y / radians, rotationZ: rotation.z / radians, scale: rig.root.getWorldScale(new Vector3()).x / .85 };
    }
    return { ...frame, poses: { ...pose, ...supportPoseFromRig(rig) } };
  }));
  const side = region.startsWith("left") ? "left" : "right";
  const objects = scene.studio.objects.map(object => region.endsWith("elbow") && ["dumbbell", "barbell", "kettlebell"].includes(object.slug) && (object.attachment === side || object.attachment === "both")
    ? { ...object, poseDriver: object.attachment === "both" ? side === "left" ? "left-arm" as const : "right-arm" as const : "arm" as const } : object);
  return { ...scene, motionStyle: "free", keyframes, studio: { ...scene.studio, body, objects, supports: scene.studio.supports.filter(contact => contact.region !== region) } };
}

export function bakeLegacySupportScene(scene: WorkshopScene, rig: AnatomyRig): WorkshopScene {
  const studio = scene.studio, seating = studio?.seating;
  const bench = studio?.objects.find(object => object.id === seating?.benchId);
  if (!studio || !seating || !bench || studio.supports?.length) return scene;
  const region: SupportRegion = seating.facing === "supine" ? "back" : seating.facing === "prone" || seating.facing === "back" ? "chest" : "pelvis";
  const surface = region === "pelvis" ? "seat" : "pad";
  const supports = withSupportScene(scene, rig, 0, pose => {
    applyStudioSeating(rig, studio, 0, pose);
    const originalRotation = rig.root.getWorldQuaternion(new Quaternion());
    const sampled = sampleStudioObject(bench, 0);
    const seed = supportSurfaceFromWorld(region, sampled, surface, supportContactPoint(rig, region));
    const normal = supportSurfaceToWorld({ ...seed, normal: { x: 0, y: 0, z: 1 } }, studio)!.normal;
    const contact = supportSurfaceFromWorld(region, sampled, surface, supportContactPoint(rig, region, normal), normal);
    applyStudioSupports(rig, { ...studio, seating: undefined, supports: [contact] }, 0, pose);
    const difference = originalRotation.multiply(rig.root.getWorldQuaternion(new Quaternion()).invert());
    contact.turn = 2 * Math.atan2(new Vector3(difference.x, difference.y, difference.z).dot(normal), difference.w) / radians;
    if (contact.turn > 180) contact.turn -= 360;
    if (contact.turn < -180) contact.turn += 360;
    return [contact];
  });
  const keyframes = scene.keyframes.map(frame => withSupportScene(scene, rig, frame.timeMs, pose => {
    applyStudioSeating(rig, studio, frame.timeMs, pose);
    return { ...frame, poses: { ...pose, ...supportPoseFromRig(rig) } };
  }));
  return { ...scene, motionStyle: "free", keyframes, studio: { ...studio, seating: undefined, supports } };
}







