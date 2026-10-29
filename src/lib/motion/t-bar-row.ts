import { Quaternion, Vector3 } from "three";
import type { AnatomyRig } from "./anatomy";
import type { StudioObject } from "./workshop";
import { gripOffset } from "./grip-edit";
import { studioPointToWorld } from "./studio";
import { reachStudioGrip } from "./studio-grip";
import { solveBarbellContact } from "./barbell-contact";

export const tBarRow = {
  pad: new Vector3(0, 1.24, .18), padAngle: Math.PI / 4, padThickness: .14, handleAngle: 70 * Math.PI / 180,
  pivot: new Vector3(0, .35, -.85),
  handle: { x: .28, y: .34, z: 1.35 },
  foot: { x: .24, y: .26, z: -.79, angle: -Math.PI / 12, thickness: .04 },
};

export function tBarRowLever(object: StudioObject, side: "left" | "right") {
  const wide = object.rowGrip === "wide";
  return { pivot: tBarRow.pivot.clone(), grip: new Vector3((side === "left" ? 1 : -1) * (wide ? .43 : tBarRow.handle.x), wide ? .38 : tBarRow.handle.y, wide ? 1.4 : tBarRow.handle.z),
    angle: -(object.machinePosition ?? 0) * 22 * Math.PI / 180 };
}

export function tBarRowFootPoint(side: "left" | "right") {
  return new Vector3(0, .119 + tBarRow.foot.thickness / 2, -.065 * .85)
    .applyAxisAngle(new Vector3(1, 0, 0), tBarRow.foot.angle)
    .add(new Vector3(side === "left" ? tBarRow.foot.x : -tBarRow.foot.x, tBarRow.foot.y, tBarRow.foot.z));
}

export function reachTBarRowGrip(rig: AnatomyRig, object: StudioObject, side: "left" | "right", facing: Quaternion) {
  const lever = tBarRowLever(object, side), axis = new Vector3(1, 0, 0);
  const target = studioPointToWorld(lever.grip.add(gripOffset(object, side)).applyAxisAngle(axis, lever.angle).add(lever.pivot), object);
  const wide = object.rowGrip === "wide";
  const rotation = facing.clone().multiply(new Quaternion().setFromAxisAngle(axis, lever.angle + (wide ? 0 : tBarRow.handleAngle)));
  if (!wide) rotation.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), (side === "left" ? 1 : -1) * Math.PI / 2));
  reachStudioGrip(rig, side, target, rotation, undefined, undefined, undefined,
    new Vector3((side === "left" ? 1 : -1) * (wide ? 1 : .2), .2, -1).applyQuaternion(facing));
  return solveBarbellContact(rig, side, {}, target, new Vector3(1, 0, 0).applyQuaternion(rotation), false,
    { wristLimits: { flexion: 0, deviation: 0 }, constrainShoulder: true });
}
