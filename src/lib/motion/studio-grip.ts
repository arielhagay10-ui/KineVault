import { Quaternion, Vector3 } from "three";
import type { AnatomyRig } from "./anatomy";
import type { JointAngles, StudioObject } from "./workshop";

export function weightGripPoint(object: StudioObject, side: "left" | "right") {
  const half = object.slug === "barbell" ? 0.4 : object.slug === "kettlebell" && object.attachment === "both" ? 0.12 : 0;
  return new Vector3(side === "left" ? half : -half, 0.2, 0);
}

export const studioGripOffset = (side: "left" | "right") => new Vector3(side === "left" ? 0.03 : -0.03, -0.15, 0.13);

export function studioForearmReach(rig: AnatomyRig, side: "left" | "right") {
  return rig.handBones[side].position.clone().add(studioGripOffset(side).applyQuaternion(rig.handBones[side].quaternion)).length()
    * rig.root.getWorldScale(new Vector3()).x;
}

// Each locked elbow describes a sphere of reachable handle positions. Project
// interpolated weight placement onto their intersection to keep contact even
// between keyframes. Two locks use the common circle of a rigid bar's grips.
export function constrainSupportedWeight(position: Vector3, supports: { center: Vector3; radius: number }[]): Vector3 {
  if (!supports.length) return position.clone();
  const first = supports[0];
  const radial = position.clone().sub(first.center);
  if (radial.lengthSq() < 1e-10) radial.set(0, 0, 1);
  const single = first.center.clone().add(radial.normalize().multiplyScalar(first.radius));
  if (supports.length < 2) return single;
  const second = supports[1], direction = second.center.clone().sub(first.center);
  const distance = direction.length();
  if (distance < 1e-6 || distance > first.radius + second.radius || distance < Math.abs(first.radius - second.radius)) return single;
  direction.divideScalar(distance);
  const along = (first.radius ** 2 - second.radius ** 2 + distance ** 2) / (2 * distance);
  const center = first.center.clone().addScaledVector(direction, along);
  const circleRadius = Math.sqrt(Math.max(0, first.radius ** 2 - along ** 2));
  const projected = position.clone().sub(center);
  projected.addScaledVector(direction, -projected.dot(direction));
  if (projected.lengthSq() < 1e-10) {
    projected.set(0, 0, 1).addScaledVector(direction, -direction.z);
    if (projected.lengthSq() < 1e-10) projected.set(0, 1, 0).addScaledVector(direction, -direction.y);
  }
  return center.add(projected.normalize().multiplyScalar(circleRadius));
}

function alignedGrip(origin: Vector3, target: Vector3, lower: Vector3, upperLength: number, shaftRotation: Quaternion, elbowPole?: Vector3) {
  const local = target.clone().sub(origin).applyQuaternion(shaftRotation.clone().invert());
  const a = local.y * lower.y + local.z * lower.z, b = -local.y * lower.z + local.z * lower.y;
  const radius = Math.hypot(a, b);
  const projection = (local.lengthSq() + lower.lengthSq() - upperLength ** 2) / 2 - local.x * lower.x;
  const opening = Math.acos(Math.max(-1, Math.min(1, projection / Math.max(radius, 1e-8))));
  const bearing = Math.atan2(b, a);
  const candidates = [bearing - opening, bearing + opening].map(angle => {
    const rotation = shaftRotation.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), angle));
    return { rotation, elbow: target.clone().sub(lower.clone().applyQuaternion(rotation)) };
  });
  // Vertical shafts put both solutions at the same height. Choose an outward
  // elbow consistently instead of letting rounding switch the IK branch.
  if (elbowPole) return candidates[0].elbow.clone().sub(origin).dot(elbowPole) > candidates[1].elbow.clone().sub(origin).dot(elbowPole) ? candidates[0] : candidates[1];
  return candidates[0].elbow.y < candidates[1].elbow.y ? candidates[0] : candidates[1];
}

// Solve the elbow and palm together, preserving both arm lengths.
export function reachStudioGrip(rig: AnatomyRig, side: "left" | "right", target: Vector3, shaftRotation: Quaternion, wrist?: JointAngles, elbowLock?: Vector3, gripOffset = studioGripOffset(side), elbowPole?: Vector3): number {
  rig.root.updateWorldMatrix(true, true);
  const shoulder = rig.bones[`${side}-shoulder`], elbow = rig.bones[`${side}-elbow`], forearm = rig.forearmBones[side];
  const scale = rig.root.getWorldScale(new Vector3()).x;
  const origin = shoulder.getWorldPosition(new Vector3());
  const upperLength = elbow.position.length() * scale;
  const hand = rig.handBones[side];
  const handRotation = wrist ? hand.quaternion.clone() : new Quaternion();
  const lower = hand.position.clone().add(gripOffset.clone().applyQuaternion(handRotation)).multiplyScalar(scale);
  let choice = alignedGrip(origin, target, lower, upperLength, shaftRotation, elbowPole);
  if (wrist) {
    // Both end grips align with the shaft. Travel on the elbow's reach circle
    // between them so intermediate turns retain contact without an IK branch jump.
    const down = alignedGrip(origin, target, lower, upperLength, shaftRotation.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI)));
    const blend = (wrist.x + 90) / 180;
    const lowerLength = lower.length();
    const direction = target.clone().sub(origin);
    const distance = Math.max(Math.abs(upperLength - lowerLength) + 1e-6, Math.min(direction.length(), upperLength + lowerLength - 1e-6));
    direction.normalize();
    const along = (upperLength ** 2 - lowerLength ** 2 + distance ** 2) / (2 * distance);
    const center = origin.clone().addScaledVector(direction, along);
    const poleUp = choice.elbow.clone().sub(center), poleDown = down.elbow.clone().sub(center);
    for (const pole of [poleUp, poleDown]) {
      pole.addScaledVector(direction, -pole.dot(direction));
      if (pole.lengthSq() < 1e-8) pole.set(side === "left" ? 1 : -1, 0, 0).addScaledVector(direction, -(side === "left" ? 1 : -1) * direction.x);
      pole.normalize();
    }
    const pole = poleUp.clone().applyQuaternion(new Quaternion().slerp(new Quaternion().setFromUnitVectors(poleUp, poleDown), blend));
    const elbowTarget = center.addScaledVector(pole, Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2)));
    const rotation = choice.rotation.clone().slerp(down.rotation, blend);
    const correction = new Quaternion().setFromUnitVectors(lower.clone().applyQuaternion(rotation).normalize(), target.clone().sub(elbowTarget).normalize());
    choice = { elbow: elbowTarget, rotation: correction.multiply(rotation) };
  }
  if (elbowLock) {
    // Keep the supported upper arm fixed. Unreachable targets produce a gap
    // warning instead of stretching a bone or moving the supported elbow.
    const direction = elbowLock.clone().sub(origin);
    if (direction.lengthSq() < 1e-10) direction.set(0, -1, 0);
    const fixedElbow = origin.clone().add(direction.normalize().multiplyScalar(upperLength));
    const forearmDirection = target.clone().sub(fixedElbow);
    if (forearmDirection.lengthSq() < 1e-10) forearmDirection.copy(lower).applyQuaternion(choice.rotation);
    const correction = new Quaternion().setFromUnitVectors(lower.clone().applyQuaternion(choice.rotation).normalize(), forearmDirection.normalize());
    choice = { elbow: fixedElbow, rotation: correction.multiply(choice.rotation) };
  }
  const parentInverse = shoulder.parent!.getWorldQuaternion(new Quaternion()).invert();
  shoulder.quaternion.setFromUnitVectors(elbow.position.clone().normalize(), choice.elbow.clone().sub(origin).normalize().applyQuaternion(parentInverse));
  rig.root.updateWorldMatrix(true, true);
  elbow.quaternion.copy(shoulder.getWorldQuaternion(new Quaternion()).invert()).multiply(choice.rotation).multiply(forearm.quaternion.clone().invert());
  hand.quaternion.copy(handRotation);
  rig.shoulderCaps[side].quaternion.identity().slerp(shoulder.quaternion, 0.82);
  rig.root.updateWorldMatrix(true, true); rig.skeleton.update();
  return Math.max(rig.handBones[side].localToWorld(gripOffset.clone()).distanceTo(target),
    elbowLock ? elbow.getWorldPosition(new Vector3()).distanceTo(elbowLock) : 0);
}
