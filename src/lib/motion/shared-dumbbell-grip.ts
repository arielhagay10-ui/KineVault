import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import type { AnatomyRig } from "./anatomy";
import { solveBarbellContact } from "./barbell-contact";
import { studioPointToWorld } from "./studio";
import { studioGripOffset, weightGripPoint } from "./studio-grip";
import type { RigPose, StudioObject } from "./workshop";

export const isSharedDumbbell = (object: StudioObject) => object.slug === "dumbbell" && object.attachment === "both";

/** Local X is the dumbbell shaft; local Z separates the palms under its head. */
export function sharedDumbbellRotation(yaw = 0) {
  const upright = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(
    new Vector3(0, 1, 0), new Vector3(0, 0, 1), new Vector3(1, 0, 0)));
  return new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw * Math.PI / 180).multiply(upright);
}

/** Reorient only the wrist after an authored shoulder/elbow edit. */
export function supportDumbbellPalm(rig: AnatomyRig, object: StudioObject, pose: RigPose, side: "left" | "right") {
  const rotation = new Quaternion().setFromEuler(new Euler(object.rotationX * Math.PI / 180, object.rotationY * Math.PI / 180, object.rotationZ * Math.PI / 180));
  solveBarbellContact(rig, side, pose, rig.handBones[side].localToWorld(studioGripOffset(side)), new Vector3(0, 0, 1).applyQuaternion(rotation), false,
    { palmNormal: new Vector3(1, 0, 0).applyQuaternion(rotation), preserveArm: true });
}

function seedSupportingArm(rig: AnatomyRig, side: "left" | "right", target: Vector3) {
  if (!target.toArray().every(Number.isFinite)) return;
  const shoulder = rig.bones[`${side}-shoulder`], elbow = rig.bones[`${side}-elbow`], hand = rig.handBones[side];
  const upper = elbow.position.clone();
  const lower = studioGripOffset(side).applyQuaternion(hand.quaternion).add(hand.position).applyQuaternion(rig.forearmBones[side].quaternion)
    .applyEuler(new Euler(0, elbow.rotation.y, elbow.rotation.z));
  const direction = target.clone().sub(shoulder.getWorldPosition(new Vector3()))
    .applyQuaternion(shoulder.parent!.getWorldQuaternion(new Quaternion()).invert()).divideScalar(rig.root.getWorldScale(new Vector3()).x);
  // Include the atlas's lateral offsets when solving the hinge's reachable distance.
  const a = upper.y * lower.y + upper.z * lower.z, b = upper.y * lower.z - upper.z * lower.y;
  const radius = Math.hypot(a, b);
  if (radius < 1e-10 || direction.lengthSq() < 1e-10) return;
  const phase = Math.atan2(b, a), spread = Math.acos(Math.max(-1, Math.min(1,
    (direction.lengthSq() - upper.lengthSq() - lower.lengthSq() - 2 * upper.x * lower.x) / (2 * radius))));
  const reference = -elbow.rotation.x, maximum = 155 * Math.PI / 180;
  const candidates = [phase - spread, phase + spread].flatMap(angle => [-2 * Math.PI, 0, 2 * Math.PI].map(turn => Math.max(0, Math.min(maximum, angle + turn))));
  const reach = (bend: number) => lower.clone().applyAxisAngle(new Vector3(1, 0, 0), -bend).add(upper);
  const bend = candidates.reduce((best, value) => {
    const cost = (angle: number) => Math.abs(reach(angle).length() - direction.length()) + 1e-6 * Math.abs(angle - reference);
    return cost(value) < cost(best) ? value : best;
  });
  const current = reach(bend).applyQuaternion(shoulder.quaternion).normalize();
  shoulder.quaternion.premultiply(new Quaternion().setFromUnitVectors(current, direction.normalize()));
  elbow.rotation.x = -bend;
  rig.root.updateWorldMatrix(true, true);
}

export function solveSharedDumbbellGrip(rig: AnatomyRig, object: StudioObject, pose: RigPose, frontalPlane = false, drivingSide?: "left" | "right") {
  const rotation = new Quaternion().setFromEuler(new Euler(object.rotationX * Math.PI / 180, object.rotationY * Math.PI / 180, object.rotationZ * Math.PI / 180));
  let limited = false;
  for (const side of ["left", "right"] as const) {
    const target = studioPointToWorld(weightGripPoint(object, side), object);
    if (side !== drivingSide) {
      if (object.poseDriver !== "arm" && !frontalPlane) seedSupportingArm(rig, side, target);
      const solved = solveBarbellContact(rig, side, pose, target, new Vector3(0, 0, 1).applyQuaternion(rotation), frontalPlane,
        { palmNormal: new Vector3(1, 0, 0).applyQuaternion(rotation), preserveFlexion: object.poseDriver === "arm" });
      limited = solved.clearanceLimited || limited;
      rig.shoulderCaps[side].quaternion.identity().slerp(rig.bones[`${side}-shoulder`].quaternion, .82);
    }
    // Cupping a plate permits some palm turn; a cylindrical shaft's strict
    // alignment threshold would report false reach warnings on this grip.
    limited = rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(target) >= .005 || limited;
  }
  // Cup the head with partly bent fingers rather than closing around empty air.
  for (const segment of rig.fingerSegments) {
    const bend = segment.thumb ? 30 : segment.part === "Proximal" ? 25 : segment.part === "Middle" ? 35 : 20;
    segment.bone.rotation.x = -bend * Math.PI / 180;
  }
  rig.root.updateWorldMatrix(true, true); rig.skeleton.update();
  return { transform: object, limited };
}
