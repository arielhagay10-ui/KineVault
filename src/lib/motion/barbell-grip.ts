import { Euler, Quaternion, Vector3 } from "three";
import type { AnatomyRig } from "./anatomy";
import { solveLimbPose } from "./limb-pose";
import { studioGripOffset } from "./studio-grip";
import type { JointAngles, RigPose } from "./workshop";

export function barbellWristPose(rig: AnatomyRig, side: "left" | "right"): JointAngles {
  const roll = rig.forearmBones[side].quaternion, hand = rig.handBones[side];
  const axis = hand.position.clone().normalize();
  const angle = 2 * Math.atan2(new Vector3(roll.x, roll.y, roll.z).dot(axis), roll.w) * 180 / Math.PI;
  return { x: Math.max(-90, Math.min(90, (side === "left" ? angle : -angle) - 90)), y: hand.rotation.x * 180 / Math.PI, z: -hand.rotation.z * 180 / Math.PI };
}

/** Align the closed hand's handle axis using forearm roll and wrist swing.
 * The elbow hinge and wrist position are untouched by this orientation step.
 */
export function alignBarbellHand(rig: AnatomyRig, side: "left" | "right", shaft: Vector3, target?: Vector3, preferredRoll = rig.forearmBones[side].quaternion.clone()) {
  const hand = rig.handBones[side], forearm = rig.forearmBones[side];
  const current = hand.getWorldQuaternion(new Quaternion());
  const axis = new Vector3(1, 0, 0).applyQuaternion(current);
  const rollAxis = hand.position.clone().normalize();
  const inverse = rig.bones[`${side}-elbow`].getWorldQuaternion(new Quaternion()).invert();
  const shoulder = rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3());
  const elbow = rig.bones[`${side}-elbow`].getWorldPosition(new Vector3());
  const reach = shoulder.distanceTo(elbow) + elbow.distanceTo(hand.getWorldPosition(new Vector3())) - .0001;
  const scale = hand.getWorldScale(new Vector3());
  const choices = [1, -1].flatMap(sign => Array.from({ length: 24 }, (_, index) => {
    const desired = shaft.clone().normalize().multiplyScalar(sign);
    // A grip can roll around the shaft. Use that freedom to keep the wrist
    // inside its anatomical range instead of forcing the shortest rotation.
    const world = new Quaternion().setFromAxisAngle(desired, index * Math.PI / 12)
      .multiply(new Quaternion().setFromUnitVectors(axis, desired)).multiply(current);
    const local = inverse.clone().multiply(world);
    const projection = new Vector3(local.x, local.y, local.z).dot(rollAxis);
    let turn = 2 * Math.atan2(projection, local.w);
    // Remove wrist Euler Y: forearm roll owns this rotation in saved poses.
    for (let iteration = 0; iteration < 8; iteration++) {
      const swingAt = (angle: number) => new Euler().setFromQuaternion(new Quaternion().setFromAxisAngle(rollAxis, -angle).multiply(local)).y;
      const error = swingAt(turn);
      if (Math.abs(error) < 1e-10) break;
      const derivative = (swingAt(turn + .0001) - error) / .0001;
      if (Math.abs(derivative) < 1e-8) break;
      turn -= Math.max(-.3, Math.min(.3, error / derivative));
    }
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    if (Math.abs(Math.abs(turn) - Math.PI) < 1e-8) turn = side === "left" ? Math.PI : -Math.PI;
    turn = side === "left" ? Math.max(0, Math.min(Math.PI, turn)) : Math.max(-Math.PI, Math.min(0, turn));
    const roll = new Quaternion().setFromAxisAngle(rollAxis, turn);
    const parentWorld = inverse.clone().invert().multiply(roll);
    // Fit swing after bounding roll, then score the orientation actually used.
    const localAxis = desired.clone().applyQuaternion(parentWorld.clone().invert());
    if (localAxis.x < 0) localAxis.negate();
    const swings = [1, -1].map(sign => {
      const x = Math.max(-70 * Math.PI / 180, Math.min(70 * Math.PI / 180, Math.atan2(sign * localAxis.z, sign * localAxis.y)));
      const z = sign * Math.min(30 * Math.PI / 180, Math.atan2(Math.hypot(localAxis.y, localAxis.z), localAxis.x));
      const angles = new Euler(x, 0, z), actual = parentWorld.clone().multiply(new Quaternion().setFromEuler(angles));
      const alignmentError = new Vector3(1, 0, 0).applyEuler(angles).distanceToSquared(localAxis);
      return { angles, actual, cost: alignmentError * 1000000 + current.angleTo(actual) };
    });
    const { angles, actual, cost } = swings.reduce((a, b) => a.cost < b.cost ? a : b);
    const wristTarget = target?.clone().sub(studioGripOffset(side).multiply(scale).applyQuaternion(actual));
    const reachExcess = wristTarget ? Math.max(0, wristTarget.distanceTo(shoulder) - reach) : 0;
    const preferredTurn = 2 * Math.atan2(new Vector3(preferredRoll.x, preferredRoll.y, preferredRoll.z).dot(rollAxis), preferredRoll.w);
    const flipped = Math.abs(preferredTurn) < Math.PI / 4 && Math.abs(turn) > Math.PI / 2 || Math.abs(preferredTurn) > 3 * Math.PI / 4 && Math.abs(turn) < Math.PI / 2;
    return { turn, angles, cost: 100000 * reachExcess + cost + (flipped ? 10000 : 0) + 8 * preferredRoll.angleTo(roll) + .1 * (Math.abs(angles.x) + Math.abs(angles.z)) };
  }));
  const best = choices.reduce((best, choice) => choice.cost < best.cost ? choice : best);
  const turn = side === "left" ? Math.max(0, Math.min(Math.PI, best.turn)) : Math.max(-Math.PI, Math.min(0, best.turn));
  forearm.quaternion.setFromAxisAngle(rollAxis, turn);
  hand.rotation.set(Math.max(-70, Math.min(70, best.angles.x * 180 / Math.PI)) * Math.PI / 180, 0,
    Math.max(-30, Math.min(30, best.angles.z * 180 / Math.PI)) * Math.PI / 180);
  rig.root.updateWorldMatrix(true, true);
}

/** Alternate bounded arm position and hand orientation until both contacts agree. */
export function solveBarbellGrip(rig: AnatomyRig, side: "left" | "right", pose: RigPose, target: Vector3, shaft: Vector3, frontalPlane = false) {
  let working = pose, error = Infinity, alignment = 0;
  const preferredRoll = rig.forearmBones[side].quaternion.clone();
  for (let iteration = 0; iteration < 24; iteration++) {
    alignBarbellHand(rig, side, shaft, target, preferredRoll);
    const solved = solveLimbPose(rig, `${side}-hand`, working, target, frontalPlane, studioGripOffset(side), .000001);
    working = { ...working, ...solved.poses };
    for (const joint of [`${side}-shoulder`, `${side}-elbow`] as const) {
      const angles = working[joint]!;
      rig.bones[joint].rotation.set(angles.x * Math.PI / 180 * (joint.endsWith("elbow") ? -1 : 1), angles.y * Math.PI / 180, -angles.z * Math.PI / 180);
    }
    rig.root.updateWorldMatrix(true, true);
    error = rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(target);
    alignment = Math.abs(new Vector3(1, 0, 0).applyQuaternion(rig.handBones[side].getWorldQuaternion(new Quaternion())).dot(shaft));
    if (error < .00001 && alignment > .99999) break;
  }
  rig.shoulderCaps[side].quaternion.identity().slerp(rig.bones[`${side}-shoulder`].quaternion, .82);
  rig.root.updateWorldMatrix(true, true); rig.skeleton.update();
  return { limited: error >= .005 || alignment < .985 };
}
