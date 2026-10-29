import { Plane, Quaternion, Vector3 } from "three";
import type { AnatomyRig } from "./anatomy";
import type { RigPose, StudioObject } from "./workshop";
import { studioPointToWorld } from "./studio";
import { gripOffset } from "./grip-edit";
import { reachStudioGrip, studioGripOffset } from "./studio-grip";
import { reachHingedMachineGrip } from "./machine-grip";

// Keep this JSON-compatible: the Blender generator reads the same dimensions.
export const shoulderPress = {
  "seat": { "center": [0, 0.59, 0], "size": [0.48, 0.13, 0.48], "pelvis": [0, 0.82, 0] },
  "back": { "center": [0, 1.22, -0.23], "size": [0.40, 1.04, 0.13], "degrees": -8 },
  "base": { "width": 0.58, "front": 0.70, "back": -1.44 },
  "pivot": { "x": 0.62, "y": 2.21, "z": -1.25 },
  "arm": [0, -0.41, 1.25],
  "wide": { "center": [-0.10, -0.41, 1.25], "halfLength": 0.06, "degrees": 15, "palmDegrees": 20 },
  "neutral": { "center": [-0.15795555, -0.42552914, 1.37], "halfLength": 0.12, "palmDegrees": 0 },
  "load": { "y": -0.04, "z": 0.38, "radius": 0.18, "hornLength": 0.34 },
  "axisSlope": 0.24,
  "startDegrees": -6, "endDegrees": -37.5
} as const;

export function shoulderPressGripSegment(side: "left" | "right", grip: "wide" | "neutral") {
  const sign = side === "left" ? 1 : -1, handle = shoulderPress[grip];
  const center = new Vector3(sign * handle.center[0], handle.center[1], handle.center[2]);
  const angle = shoulderPress.wide.degrees * Math.PI / 180;
  const axis = grip === "wide" ? new Vector3(Math.cos(angle), sign * Math.sin(angle), 0) : new Vector3(0, 0, 1);
  return { from: center.clone().addScaledVector(axis, -handle.halfLength).toArray(), to: center.addScaledVector(axis, handle.halfLength).toArray() };
}

export function shoulderPressLever(object: StudioObject, side: "left" | "right") {
  const sign = side === "left" ? 1 : -1;
  const center = shoulderPress[object.pressGrip === "neutral" ? "neutral" : "wide"].center;
  const travel = (side === "left" ? object.machinePositionLeft : object.machinePositionRight) ?? object.machinePosition ?? .5;
  return {
    pivot: new Vector3(sign * shoulderPress.pivot.x, shoulderPress.pivot.y, shoulderPress.pivot.z),
    grip: new Vector3(sign * center[0], center[1], center[2]),
    axis: new Vector3(1, sign * shoulderPress.axisSlope, 0).normalize(),
    angle: (shoulderPress.startDegrees + travel * (shoulderPress.endDegrees - shoulderPress.startDegrees)) * Math.PI / 180,
  };
}

export function shoulderPressGripPoint(object: StudioObject, side: "left" | "right") {
  const lever = shoulderPressLever(object, side);
  return new Vector3(...shoulderPress.arm).applyAxisAngle(lever.axis, lever.angle)
    .add(lever.pivot).add(fixedGripOffset(object, side));
}

function fixedGripOffset(object: StudioObject, side: "left" | "right") {
  const center = shoulderPress[object.pressGrip === "neutral" ? "neutral" : "wide"].center;
  return new Vector3((side === "left" ? 1 : -1) * center[0], center[1] - shoulderPress.wide.center[1], center[2] - shoulderPress.wide.center[2]).add(gripOffset(object, side));
}

export function shoulderPressGripRotation(object: StudioObject, side: "left" | "right", facing = new Quaternion()) {
  const rotation = facing.clone();
  if (object.pressGrip === "neutral") rotation.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), (side === "left" ? 1 : -1) * Math.PI / 2));
  else rotation.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), (side === "left" ? 1 : -1) * shoulderPress.wide.degrees * Math.PI / 180))
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI));
  return rotation.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), (180 + shoulderPress[object.pressGrip === "neutral" ? "neutral" : "wide"].palmDegrees) * Math.PI / 180));
}

export function shoulderPressPositionAtPoint(object: StudioObject, side: "left" | "right", point: Vector3) {
  const lever = shoulderPressLever(object, side), offset = fixedGripOffset(object, side);
  const rest = new Vector3(...shoulderPress.arm).projectOnPlane(lever.axis);
  const moved = point.clone().sub(lever.pivot).sub(offset).projectOnPlane(lever.axis);
  const angle = Math.atan2(lever.axis.dot(rest.clone().cross(moved)), rest.dot(moved));
  const degrees = Math.atan2(Math.sin(angle), Math.cos(angle)) * 180 / Math.PI;
  return Math.max(0, Math.min(1, (degrees - shoulderPress.startDegrees) / (shoulderPress.endDegrees - shoulderPress.startDegrees)));
}

export function shoulderPressElbowPlane(rig: AnatomyRig, side: "left" | "right", grip: "wide" | "neutral" = "wide") {
  // Neutral elbows follow one forward/outward plane rather than switching near extension.
  const normal = grip === "wide" ? new Vector3(0, 0, 1) : new Vector3(side === "left" ? 1 : -1, 0, -1).normalize();
  return new Plane().setFromNormalAndCoplanarPoint(normal.applyQuaternion(rig.bones.torso.getWorldQuaternion(new Quaternion())),
    rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3()));
}

export function reachShoulderPressGrip(rig: AnatomyRig, object: StudioObject, side: "left" | "right", facing: Quaternion, pose: RigPose = {}) {
  const sign = side === "left" ? 1 : -1;
  const shoulder = rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3());
  const authored = pose[`${side}-shoulder`];
  const authoredShoulder = authored && Object.values(authored).some(value => Math.abs(value) > 1);
  const pole = authoredShoulder
    ? rig.bones[`${side}-elbow`].getWorldPosition(new Vector3()).sub(shoulder)
    : new Vector3(sign, -.3, object.pressGrip === "neutral" ? .35 : 0).applyQuaternion(facing);
  const target = studioPointToWorld(shoulderPressGripPoint(object, side), object);
  const rotation = shoulderPressGripRotation(object, side, facing);
  reachStudioGrip(rig, side, target, rotation, pose[`${side}-wrist`], undefined, studioGripOffset(side), pole);
  const elbowPlane = shoulderPressElbowPlane(rig, side, object.pressGrip === "neutral" ? "neutral" : "wide");
  return reachHingedMachineGrip(rig, side, pose, target, new Vector3(1, 0, 0).applyQuaternion(rotation), { torsoClearance: object.pressGrip === "neutral", elbowPlane, palmRotation: rotation });
}
