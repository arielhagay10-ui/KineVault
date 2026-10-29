import { Quaternion, Vector3 } from "three";
import type { AnatomyRig } from "./anatomy";
import type { RigPose, StudioObject } from "./workshop";
import { studioPointToWorld } from "./studio";
import { reachStudioGrip, studioGripOffset } from "./studio-grip";
import { gripOffset } from "./grip-edit";
import { reachHingedMachineGrip } from "./machine-grip";

export const plateRow = {
  seat: { min: .56, max: .78, standard: .66, z: -.17 },
  pad: { y: 1.29, z: .168 },
  foot: { x: .25, y: .17, z: .55, width: .28, depth: .40, thickness: .06, angle: -Math.PI / 15 },
  pivot: { x: .55, y: .62, z: .55 },
  load: { y: -.11, z: .42, radius: .22, hornLength: .46 },
  // Starting stops match straight-arm reach at the standard seat height.
  startDegrees: { neutral: 16.06, wide: 16.73 }, endDegrees: -24,
};

export function plateRowFootPoint(side: "left" | "right") {
  return new Vector3(0, .119 + plateRow.foot.thickness / 2, -.065 * .85)
    .applyAxisAngle(new Vector3(1, 0, 0), plateRow.foot.angle)
    .add(new Vector3((side === "left" ? 1 : -1) * plateRow.foot.x, plateRow.foot.y, plateRow.foot.z));
}

export function rowUsesHand(object: StudioObject, side: "left" | "right") {
  return object.attachment === "both" || object.attachment === side
    || !!object.machineUse && object.rowGrip === undefined && object.attachment === "none";
}

export function rowLeverPosition(object: StudioObject, side: "left" | "right") {
  return (side === "left" ? object.machinePositionLeft : object.machinePositionRight)
    ?? (rowUsesHand(object, side) || !object.machineUse ? object.machinePosition ?? 0 : 0);
}

export function plateRowLever(object: StudioObject, side: "left" | "right") {
  const sign = side === "left" ? 1 : -1;
  const start = plateRow.startDegrees[object.rowGrip ?? "neutral"];
  return {
    pivot: new Vector3(sign * plateRow.pivot.x, plateRow.pivot.y, plateRow.pivot.z),
    grip: object.rowGrip === "wide" ? new Vector3(sign * -.10, .94, .02) : new Vector3(sign * -.25, .89, .08),
    angle: (start + rowLeverPosition(object, side) * (plateRow.endDegrees - start)) * Math.PI / 180,
  };
}

export function plateRowGripPoint(object: StudioObject, side: "left" | "right") {
  const lever = plateRowLever(object, side);
  return lever.grip.add(gripOffset(object, side)).applyAxisAngle(new Vector3(1, 0, 0), lever.angle).add(lever.pivot);
}

export function plateRowPositionAtPoint(object: StudioObject, side: "left" | "right", point: Vector3) {
  const lever = plateRowLever(object, side), grip = lever.grip.add(gripOffset(object, side));
  const angle = Math.atan2(point.z - lever.pivot.z, point.y - lever.pivot.y) - Math.atan2(grip.z, grip.y);
  const degrees = Math.atan2(Math.sin(angle), Math.cos(angle)) * 180 / Math.PI;
  const start = plateRow.startDegrees[object.rowGrip ?? "neutral"];
  return Math.max(0, Math.min(1, (start - degrees) / (start - plateRow.endDegrees)));
}

export function reachPlateRowGrip(rig: AnatomyRig, object: StudioObject, side: "left" | "right", facing: Quaternion, pose: RigPose) {
  const sign = side === "left" ? 1 : -1;
  const wide = object.rowGrip === "wide";
  const lever = plateRowLever(object, side);
  const gripRotation = facing.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), lever.angle));
  // Neutral handles run vertically; upper-back handles run across the machine.
  if (!wide) gripRotation.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), sign * Math.PI / 2));
  const shoulder = rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3());
  const authored = pose[`${side}-shoulder`];
  const pole = authored && (Math.abs(authored.x) + Math.abs(authored.y) + Math.abs(authored.z) > 1)
    ? rig.bones[`${side}-elbow`].getWorldPosition(new Vector3()).sub(shoulder)
    : new Vector3(sign * (wide ? 1 : .15), wide ? -.1 : -1, -.4).applyQuaternion(facing);
  const target = studioPointToWorld(plateRowGripPoint(object, side), object);
  reachStudioGrip(rig, side, target, gripRotation, pose[`${side}-wrist`], undefined, studioGripOffset(side), pole);
  return reachHingedMachineGrip(rig, side, pose, target, new Vector3(1, 0, 0).applyQuaternion(gripRotation));
}
