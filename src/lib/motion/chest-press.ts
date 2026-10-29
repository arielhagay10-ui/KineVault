import { Plane, Quaternion, Vector3 } from "three";
import type { AnatomyRig } from "./anatomy";
import type { RigPose, StudioObject } from "./workshop";
import { gripOffset } from "./grip-edit";
import { studioPointToWorld } from "./studio";
import { reachStudioGrip, studioGripOffset } from "./studio-grip";
import { reachHingedMachineGrip } from "./machine-grip";

// Metres/Y-up, shared with the original Blender model.
export const chestPress = {
  "seat": { "center": [0, 0.59, 0], "size": [0.48, 0.13, 0.48] },
  "back": { "center": [0, 1.22, -0.23], "size": [0.40, 1.04, 0.13], "degrees": -8 },
  "pivot": [0.70, 0.43, 0.67], "arm": [-0.28, 1.02, 0], "axisSlope": 0.4,
  "startDegrees": -10, "endDegrees": 20,
  "handle": [[-0.16, 0, 0], [0.10, 0, 0], [0.14, 0.04, 0], [0.14, 0.21, 0], [0.09, 0.25, 0.06], [-0.16, 0.16, 0.06]],
  "grips": { "wide": { "segment": 0, "fraction": 0.85 }, "neutral": { "segment": 2, "fraction": 0.4 }, "angled": { "segment": 4, "fraction": 0.5 } }
} as const;

export function chestPressLever(object: StudioObject, side: "left" | "right") {
  const sign = side === "left" ? 1 : -1;
  const travel = (side === "left" ? object.machinePositionLeft : object.machinePositionRight) ?? object.machinePosition ?? .5;
  return { pivot: new Vector3(sign * chestPress.pivot[0], chestPress.pivot[1], chestPress.pivot[2]),
    grip: new Vector3(sign * chestPress.arm[0], chestPress.arm[1], chestPress.arm[2]),
    axis: new Vector3(1, 0, sign * chestPress.axisSlope).normalize(),
    angle: (chestPress.startDegrees + Math.max(0, Math.min(1, travel)) * (chestPress.endDegrees - chestPress.startDegrees)) * Math.PI / 180 };
}

export function chestPressGripSegment(side: "left" | "right", grip: NonNullable<StudioObject["pressGrip"]> = "wide") {
  const sign = side === "left" ? 1 : -1, choice = chestPress.grips[grip];
  const point = (index: number) => { const p = chestPress.handle[index]; return new Vector3(sign * p[0], p[1], p[2]); };
  return { from: point(choice.segment), to: point(choice.segment + 1), fraction: choice.fraction };
}

function handleOffset(object: StudioObject, side: "left" | "right") {
  const segment = chestPressGripSegment(side, object.pressGrip);
  return segment.from.lerp(segment.to, segment.fraction).add(gripOffset(object, side));
}

export function chestPressGripPoint(object: StudioObject, side: "left" | "right") {
  const lever = chestPressLever(object, side);
  return lever.grip.applyAxisAngle(lever.axis, lever.angle).add(lever.pivot).add(handleOffset(object, side));
}

export function chestPressPositionAtPoint(object: StudioObject, side: "left" | "right", point: Vector3) {
  const lever = chestPressLever(object, side);
  const rest = lever.grip.clone().projectOnPlane(lever.axis);
  const moved = point.clone().sub(lever.pivot).sub(handleOffset(object, side)).projectOnPlane(lever.axis);
  const angle = Math.atan2(lever.axis.dot(rest.clone().cross(moved)), rest.dot(moved)) * 180 / Math.PI;
  return Math.max(0, Math.min(1, (angle - chestPress.startDegrees) / (chestPress.endDegrees - chestPress.startDegrees)));
}

export function reachChestPressGrip(rig: AnatomyRig, object: StudioObject, side: "left" | "right", facing: Quaternion, pose: RigPose = {}) {
  const sign = side === "left" ? 1 : -1, segment = chestPressGripSegment(side, object.pressGrip);
  const shaft = segment.to.clone().sub(segment.from).normalize().multiplyScalar(sign).applyQuaternion(facing);
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), shaft);
  rotation.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2));
  const target = studioPointToWorld(chestPressGripPoint(object, side), object);
  const pole = new Vector3(sign, -.6, -.25).applyQuaternion(facing);
  reachStudioGrip(rig, side, target, rotation, pose[`${side}-wrist`], undefined, studioGripOffset(side), pole);
  const shoulder = rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3());
  const normal = target.clone().sub(shoulder).cross(pole).normalize();
  const elbowPlane = new Plane().setFromNormalAndCoplanarPoint(normal, shoulder);
  return reachHingedMachineGrip(rig, side, pose, target, shaft, { torsoClearance: true, elbowPlane });
}
