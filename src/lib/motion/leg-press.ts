import { Euler, Quaternion, Vector3 } from "three";
import type { AnatomyRig } from "./anatomy";
import { studioPointToWorld } from "./studio";
import type { StudioObject } from "./workshop";

// Calibrate the plate and working stroke together; the old parallel pads required impossible ankle flexion.
export const legPress = {
  "footDegrees": -70,
  "plateDegrees": 110,
  "plateCenter": [0, -0.05318, -0.05318],
  "plateSize": [1.03, 0.09, 0.68],
  "back": { "center": [0, 0.93636039, -1.04363961], "size": [0.55, 1.12, 0.14], "degrees": -45 },
  "carriage": { "y": 1.26, "z": 0.4, "stroke": 0.32 }
} as const;

export function legPressCarriagePoint(object: StudioObject) {
  const travel = object.machinePosition ?? .5;
  return new Vector3(0, legPress.carriage.y + travel * legPress.carriage.stroke, legPress.carriage.z + travel * legPress.carriage.stroke);
}

export function legPressSolePoint(object: StudioObject, side: "left" | "right") {
  const normal = new Vector3(0, -1, 0).applyAxisAngle(new Vector3(1, 0, 0), legPress.footDegrees * Math.PI / 180);
  return legPressCarriagePoint(object).add(new Vector3(...legPress.plateCenter))
    .addScaledVector(normal, -legPress.plateSize[1] / 2).setX(side === "left" ? .17 : -.17);
}

export function legPressFootPoint(object: StudioObject, side: "left" | "right") {
  const offset = new Vector3(0, -.14, .065).multiplyScalar(.85)
    .applyAxisAngle(new Vector3(1, 0, 0), legPress.footDegrees * Math.PI / 180);
  return legPressSolePoint(object, side).sub(offset);
}

export function legPressFootContact(rig: AnatomyRig, object: StudioObject, side: "left" | "right") {
  const rotation = new Quaternion().setFromEuler(new Euler(object.rotationX * Math.PI / 180, object.rotationY * Math.PI / 180, object.rotationZ * Math.PI / 180));
  const normal = new Vector3(0, -1, 0).applyAxisAngle(new Vector3(1, 0, 0), legPress.footDegrees * Math.PI / 180).applyQuaternion(rotation);
  const foot = rig.footBones[side], sole = foot.localToWorld(new Vector3(0, -.14, .065));
  const local = sole.sub(studioPointToWorld(legPressSolePoint(object, side).setX(0), object))
    .applyQuaternion(rotation.clone().invert()).divideScalar(object.scale)
    .applyAxisAngle(new Vector3(1, 0, 0), -legPress.plateDegrees * Math.PI / 180);
  return {
    distance: Math.hypot(local.y, Math.max(Math.abs(local.x) - legPress.plateSize[0] / 2, 0), Math.max(Math.abs(local.z) - legPress.plateSize[2] / 2, 0)) * object.scale,
    alignment: new Vector3(0, -1, 0).applyQuaternion(foot.getWorldQuaternion(new Quaternion())).dot(normal),
  };
}
