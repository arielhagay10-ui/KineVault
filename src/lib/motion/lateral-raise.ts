import { Quaternion, Vector3 } from "three";
import type { AnatomyRig } from "./anatomy";
import type { StudioObject } from "./workshop";
import { gripOffset } from "./grip-edit";
import { studioPointToWorld } from "./studio";
import { reachStudioGrip } from "./studio-grip";
import { solveBarbellContact } from "./barbell-contact";

// Metres/Y-up, shared with the original Blender model. Each arm lever turns about a
// front-to-back axis through the seated shoulder joint; the left side is +x.
export const lateralRaise = {
  "seat": { "center": [0, 0.59, 0.02], "size": [0.5, 0.13, 0.46] },
  "back": { "center": [0, 1.32, -0.222], "size": [0.46, 0.96, 0.14] },
  "pivot": [0.289, 1.594, 0],
  "handle": [0.3, 1.1, 0.55],
  "pad": { "lateral": 0.103, "along": -0.4, "radius": 0.05, "front": 0.12, "back": -0.1 },
  "startDegrees": 12, "endDegrees": 88,
  "weights": 0.3
} as const;

const zAxis = new Vector3(0, 0, 1);

export function lateralRaiseLever(object: StudioObject, side: "left" | "right") {
  const sign = side === "left" ? 1 : -1, travel = Math.max(0, Math.min(1, object.machinePosition ?? 0));
  return { pivot: new Vector3(sign * lateralRaise.pivot[0], lateralRaise.pivot[1], lateralRaise.pivot[2]), axis: zAxis.clone(),
    grip: new Vector3(sign * (lateralRaise.handle[0] - lateralRaise.pivot[0]), lateralRaise.handle[1] - lateralRaise.pivot[1], lateralRaise.handle[2] - lateralRaise.pivot[2]),
    angle: sign * (lateralRaise.startDegrees + travel * (lateralRaise.endDegrees - lateralRaise.startDegrees)) * Math.PI / 180 };
}

export function lateralRaiseGripPoint(object: StudioObject, side: "left" | "right") {
  const lever = lateralRaiseLever(object, side);
  return lever.grip.add(gripOffset(object, side)).applyAxisAngle(zAxis, lever.angle).add(lever.pivot);
}

/** Grip the handle with the lever at rest, then carry the whole arm about the lever axis. */
export function reachLateralRaiseHandle(rig: AnatomyRig, object: StudioObject, side: "left" | "right", facing: Quaternion) {
  const sign = side === "left" ? 1 : -1, lever = lateralRaiseLever(object, side);
  const target = studioPointToWorld(lever.grip.clone().add(gripOffset(object, side)).add(lever.pivot), object);
  const rotation = facing.clone().multiply(new Quaternion().setFromAxisAngle(zAxis, sign * Math.PI / 2));
  reachStudioGrip(rig, side, target, rotation, undefined, undefined, undefined, new Vector3(sign * .3, 0, -1).applyQuaternion(facing));
  solveBarbellContact(rig, side, {}, target, new Vector3(1, 0, 0).applyQuaternion(rotation), false,
    { wristLimits: { flexion: 0, deviation: 0 }, constrainShoulder: true });
  const shoulder = rig.bones[`${side}-shoulder`];
  const world = shoulder.getWorldQuaternion(new Quaternion()).premultiply(new Quaternion().setFromAxisAngle(zAxis.clone().applyQuaternion(facing), lever.angle));
  shoulder.quaternion.copy(shoulder.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(world));
  rig.shoulderCaps[side].quaternion.identity().slerp(shoulder.quaternion, .82);
  rig.root.updateWorldMatrix(true, true);
}
