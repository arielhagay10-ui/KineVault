import { Quaternion, Vector3 } from "three";
import { bendAnatomyToes, pivots, toeAxis, type AnatomyRig } from "./anatomy";
import type { StudioObject } from "./workshop";
import { gripOffset } from "./grip-edit";
import { clamp, studioPointToWorld } from "./studio";
import { reachStudioGrip } from "./studio-grip";
import { solveBarbellContact } from "./barbell-contact";

// Metres/Y-up, shared with the original Blender model. The figure's root stays at x = z = 0 and
// only rises; pad and handle heights are measured from that root.
export const calfRaise = {
  "platform": { "top": 0.16, "edge": 0.115, "front": 0.5, "width": 0.76 },
  "pad": { "x": 0.21, "back": -0.17, "front": 0.1, "radius": 0.05, "rise": 2.346 },
  "handle": { "x": 0.28, "drop": 0.5, "z": 0.52, "length": 0.18, "radius": 0.022 },
  "guide": { "x": 0.27, "z": -0.46 },
  "startDegrees": -16, "endDegrees": 26,
  "weights": 0.12
} as const;

const scale = .85, xAxis = new Vector3(1, 0, 0);
const sideSign = (side: "left" | "right") => side === "left" ? 1 : -1;
// Resting joint positions relative to the figure's root, in machine metres.
const atlasPoint = (point: readonly number[], side: "left" | "right") => new Vector3(sideSign(side) * point[0], point[1], point[2]).multiplyScalar(scale);
const ankleRest = (side: "left" | "right") => atlasPoint([pivots["left-knee"][0], pivots["left-knee"][1] - .65, pivots["left-knee"][2]], side);
const hipRest = (side: "left" | "right") => atlasPoint(pivots["left-hip"], side);

/** Ankle plantarflexion (+) or dorsiflexion (-) relative to a flat foot, in radians. */
export function calfRaiseAngle(object: StudioObject) {
  const travel = clamp(object.machinePosition ?? 0, 0, 1);
  return (calfRaise.startDegrees + travel * (calfRaise.endDegrees - calfRaise.startDegrees)) * Math.PI / 180;
}

/** The foot pivots on the ball (the toe pivot): about the MTP line when rising, edge-parallel when stretching. */
export function calfRaiseFoot(object: StudioObject, side: "left" | "right") {
  const angle = calfRaiseAngle(object), sign = sideSign(side);
  const axis = angle >= 0 ? new Vector3(toeAxis.direction[0], sign * toeAxis.direction[1], sign * toeAxis.direction[2]).normalize() : xAxis.clone();
  const rotation = new Quaternion().setFromAxisAngle(axis, angle);
  const ball = atlasPoint(toeAxis.point, side).setY(calfRaise.platform.top + toeAxis.point[1] * scale);
  const ankle = ankleRest(side).setY(calfRaise.platform.top + ankleRest(side).y).sub(ball).applyQuaternion(rotation).add(ball);
  return { ankle, rotation };
}

/** Root height keeping both knees straight above the turned feet. */
export function calfRaiseRootHeight(object: StudioObject) {
  let total = 0;
  for (const side of ["left", "right"] as const) {
    const ankle = calfRaiseFoot(object, side).ankle, hip = hipRest(side), length = hip.distanceTo(ankleRest(side));
    total += ankle.y + Math.sqrt(length ** 2 - (hip.x - ankle.x) ** 2 - (hip.z - ankle.z) ** 2) - hip.y;
  }
  return total / 2;
}

export function calfRaisePelvisPoint(object: StudioObject) {
  return atlasPoint(pivots.pelvis, "left").add(new Vector3(0, calfRaiseRootHeight(object), 0));
}

/** Pad axis height at the yoke's center; the carriage moves only vertically. */
export function calfRaiseCarriagePoint(object: StudioObject) {
  return new Vector3(0, calfRaiseRootHeight(object) + calfRaise.pad.rise, 0);
}

export function calfRaiseHandle(object: StudioObject, side: "left" | "right") {
  const { x, drop, z } = calfRaise.handle;
  return calfRaiseCarriagePoint(object).add(new Vector3(sideSign(side) * x, -drop, z));
}

/** Travel for a carriage height, inverting the monotonic lift. */
export function calfRaisePositionAtHeight(object: StudioObject, height: number) {
  let low = 0, high = 1;
  for (let step = 0; step < 30; step++) {
    const middle = (low + high) / 2;
    if (calfRaiseCarriagePoint({ ...object, machinePosition: middle }).y < height) low = middle; else high = middle;
  }
  return (low + high) / 2;
}

/** Keep the toes flat on the platform while the foot turns. Call after the foot is planted. */
export function flattenCalfRaiseToes(rig: AnatomyRig, object: StudioObject, side: "left" | "right") {
  bendAnatomyToes(rig, side, calfRaiseFoot(object, side).rotation.invert());
}

/** Close a neutral grip around the upright handle hanging in front of each pad, elbows down. */
export function reachCalfRaiseHandle(rig: AnatomyRig, object: StudioObject, side: "left" | "right", facing: Quaternion) {
  const target = studioPointToWorld(calfRaiseHandle(object, side).add(gripOffset(object, side)), object);
  const upright = facing.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2));
  reachStudioGrip(rig, side, target, upright, undefined, undefined, undefined, new Vector3(sideSign(side) * .3, -1, 0).applyQuaternion(facing));
  return solveBarbellContact(rig, side, {}, target, new Vector3(0, 1, 0).applyQuaternion(facing), false,
    { wristLimits: { flexion: 0, deviation: 0 }, constrainShoulder: true });
}
