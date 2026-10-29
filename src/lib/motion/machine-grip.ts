import { Euler, Quaternion, Vector3, type Plane } from "three";
import type { AnatomyRig } from "./anatomy";
import { clampJointControlAngles, jointLimits, type RigPose } from "./workshop";
import { armTorsoClearance, solveBarbellContact } from "./barbell-contact";
import { studioGripOffset } from "./studio-grip";

export function reachHingedMachineGrip(rig: AnatomyRig, side: "left" | "right", pose: RigPose, target: Vector3, shaft: Vector3, { torsoClearance = false, elbowPlane, palmRotation }: { torsoClearance?: boolean; elbowPlane?: Plane; palmRotation?: Quaternion } = {}) {
  if (![...target.toArray(), ...shaft.toArray()].every(Number.isFinite) || shaft.lengthSq() < 1e-10) return Infinity;
  const shoulder = rig.bones[`${side}-shoulder`], elbow = rig.bones[`${side}-elbow`];
  const forearm = rig.forearmBones[side], hand = rig.handBones[side];
  const origin = shoulder.getWorldPosition(new Vector3());
  const upperWorld = elbow.getWorldPosition(new Vector3()).sub(origin).normalize();
  const lowerWorld = hand.getWorldPosition(new Vector3()).sub(elbow.getWorldPosition(new Vector3())).normalize();
  const upper = elbow.position.clone().normalize(), lower = hand.position;
  const a = upper.y * lower.y + upper.z * lower.z, b = upper.y * lower.z - upper.z * lower.y;
  // Reassign the analytic seed's elbow twist to humeral rotation without moving its wrist.
  const projection = (upperWorld.dot(lowerWorld) * lower.length() - upper.x * lower.x) / Math.hypot(a, b);
  if (Math.abs(projection) <= 1 + 1e-8) {
    const opening = Math.acos(Math.max(-1, Math.min(1, projection))), bearing = Math.atan2(b, a);
    const flexion = [bearing - opening, bearing + opening].map(angle => (angle + Math.PI * 2) % (Math.PI * 2))
      .find(angle => angle <= 155 * Math.PI / 180);
    if (flexion !== undefined) {
      const before = [shoulder.quaternion.clone(), elbow.quaternion.clone(), forearm.quaternion.clone()];
      const forearmWorld = forearm.getWorldQuaternion(new Quaternion());
      const rotation = new Quaternion().setFromUnitVectors(upper, upperWorld);
      const bentLower = lower.clone().applyAxisAngle(new Vector3(1, 0, 0), -flexion).applyQuaternion(rotation);
      bentLower.addScaledVector(upperWorld, -bentLower.dot(upperWorld)).normalize();
      const desired = lowerWorld.clone().addScaledVector(upperWorld, -lowerWorld.dot(upperWorld)).normalize();
      rotation.premultiply(new Quaternion().setFromAxisAngle(upperWorld,
        Math.atan2(upperWorld.dot(bentLower.clone().cross(desired)), bentLower.dot(desired))));
      shoulder.quaternion.copy(shoulder.parent!.getWorldQuaternion(new Quaternion()).invert()).multiply(rotation);
      elbow.rotation.set(-flexion, 0, 0);
      rig.root.updateWorldMatrix(true, true);
      forearm.quaternion.copy(elbow.getWorldQuaternion(new Quaternion()).invert()).multiply(forearmWorld);
      const limits = jointLimits[`${side}-shoulder`];
      const bounded = (["x", "y", "z"] as const).every(axis => {
        const angle = shoulder.rotation[axis] * 180 / Math.PI * (axis === "z" ? -1 : 1);
        return angle >= limits[axis][0] - 1e-6 && angle <= limits[axis][1] + 1e-6;
      });
      if (!bounded) {
        shoulder.quaternion.copy(before[0]); elbow.quaternion.copy(before[1]); forearm.quaternion.copy(before[2]);
      }
      rig.root.updateWorldMatrix(true, true); rig.skeleton.update();
    }
  }
  const error = hand.localToWorld(studioGripOffset(side)).distanceTo(target);
  const wrist = new Vector3(0, -1, 0).applyQuaternion(hand.getWorldQuaternion(new Quaternion())).angleTo(lowerWorld) * 180 / Math.PI;
  const aligned = Math.abs(new Vector3(1, 0, 0).applyQuaternion(hand.getWorldQuaternion(new Quaternion())).dot(shaft.clone().normalize()));
  const radians = Math.PI / 180;
  const rollAxis = hand.position.clone().normalize();
  let turn = (side === "left" ? 1 : -1) * 2 * Math.atan2(new Vector3(forearm.quaternion.x, forearm.quaternion.y, forearm.quaternion.z).dot(rollAxis), forearm.quaternion.w);
  if (turn < -1e-6 || turn > Math.PI + 1e-6) {
    const canonicalTurn = ((turn % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const canonical = new Quaternion().setFromAxisAngle(rollAxis, (side === "left" ? 1 : -1) * canonicalTurn);
    // Quaternion signs describe the same pose, but persisted forearm turn must use its bounded representation.
    if (canonicalTurn <= Math.PI + 1e-6 && forearm.quaternion.angleTo(canonical) < 1e-6) {
      forearm.quaternion.copy(canonical); turn = canonicalTurn;
    }
  }
  const forearmBounded = turn >= -1e-6 && turn <= Math.PI + 1e-6;
  const allowed = clampJointControlAngles(`${side}-shoulder`, { x: shoulder.rotation.x / radians, y: shoulder.rotation.y / radians, z: -shoulder.rotation.z / radians });
  const shoulderBounded = shoulder.quaternion.angleTo(new Quaternion().setFromEuler(new Euler(allowed.x * radians, allowed.y * radians, -allowed.z * radians))) < 1e-6;
  const torsoClear = !torsoClearance || armTorsoClearance(rig, side).every(distance => distance < .001);
  const elbowInPlane = !elbowPlane || Math.abs(elbowPlane.distanceToPoint(elbow.getWorldPosition(new Vector3()))) < .001;
  const palmAligned = !palmRotation || hand.getWorldQuaternion(new Quaternion()).angleTo(palmRotation) < .001;
  if (palmAligned && elbowInPlane && torsoClear && shoulderBounded && forearmBounded && elbow.rotation.x <= 1e-6 && elbow.rotation.x >= -155 * Math.PI / 180
    && Math.abs(elbow.rotation.y) < 1e-6 && Math.abs(elbow.rotation.z) < 1e-6 && error < .004 && wrist < 43 && aligned > .999) {
    rig.shoulderCaps[side].quaternion.identity().slerp(shoulder.quaternion, .82);
    return error;
  }
  // Machine contact must use elbow flexion, with palm turn supplied by the forearm.
  const hingePose = { ...pose, [`${side}-elbow`]: { x: pose[`${side}-elbow`]?.x ?? 0, y: 0, z: 0 } };
  solveBarbellContact(rig, side, hingePose, target, shaft, false, { wristLimits: { flexion: elbowPlane ? 25 : 30, deviation: 20 }, localFirst: true, constrainShoulder: true, torsoClearance, elbowPlane, palmRotation });
  if (palmRotation && hand.getWorldQuaternion(new Quaternion()).angleTo(palmRotation) > 2 * Math.PI / 180) return Infinity;
  return rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(target);
}
