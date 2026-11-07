import { Quaternion, Vector3 } from "three";
import type { AnatomyRig } from "./anatomy";
import type { StudioObject } from "./workshop";
import { gripOffset } from "./grip-edit";
import { studioPointToWorld } from "./studio";
import { reachStudioGrip } from "./studio-grip";
import { solveBarbellContact } from "./barbell-contact";

// Metres/Y-up, shared with the original Blender model. The lever turns about the seated knee axis.
export const kneeLever = {
  "pelvis": [0, 0.92, 0], "reclineDegrees": -10,
  "seat": { "center": [0, 0.705, 0.215], "size": [0.5, 0.1, 0.74] },
  "back": { "center": [0, 1.295, -0.281], "size": [0.46, 0.8, 0.12] },
  "pivot": [0.817, 0.794], "shank": 0.5525,
  "pad": { "along": 0.43, "offset": 0.058, "radius": 0.055, "width": 0.6 },
  "handle": [0.4, 0.82, 0.05],
  "startDegrees": 7, "endDegrees": -75, "dorsiflexionDegrees": 10,
  "weights": 0.3
} as const;

export const kneeLeverSlugs = ["leg-extension-machine"] as const;
export const isKneeLever = (slug: string) => kneeLeverSlugs.some(item => item === slug);
const xAxis = new Vector3(1, 0, 0);

export function kneeLeverLever(object: StudioObject) {
  const travel = Math.max(0, Math.min(1, object.machinePosition ?? 0));
  return { pivot: new Vector3(0, kneeLever.pivot[0], kneeLever.pivot[1]),
    grip: new Vector3(0, -kneeLever.pad.along, kneeLever.pad.offset),
    angle: (kneeLever.startDegrees + travel * (kneeLever.endDegrees - kneeLever.startDegrees)) * Math.PI / 180 };
}

/** Ankle joint target: the shank turns with the lever about the knee axis. */
export function kneeLeverAnkle(object: StudioObject, side: "left" | "right") {
  const lever = kneeLeverLever(object);
  return new Vector3(0, -kneeLever.shank, 0).applyAxisAngle(xAxis, lever.angle).add(lever.pivot).setX(side === "left" ? .17 : -.17);
}

export function kneeLeverFootRotation(object: StudioObject, facing: Quaternion) {
  const angle = kneeLeverLever(object).angle - kneeLever.dorsiflexionDegrees * Math.PI / 180;
  return facing.clone().multiply(new Quaternion().setFromAxisAngle(xAxis, angle));
}

export function kneeLeverHandle(side: "left" | "right") {
  return new Vector3(side === "left" ? kneeLever.handle[0] : -kneeLever.handle[0], kneeLever.handle[1], kneeLever.handle[2]);
}

/** Close a neutral hand around the forward-pointing seat handle. */
export function reachKneeLeverHandle(rig: AnatomyRig, object: StudioObject, side: "left" | "right", facing: Quaternion) {
  const sign = side === "left" ? 1 : -1;
  const target = studioPointToWorld(kneeLeverHandle(side).add(gripOffset(object, side)), object);
  const rotation = facing.clone().multiply(new Quaternion().setFromAxisAngle(xAxis, Math.PI / 2))
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), sign * Math.PI / 2));
  reachStudioGrip(rig, side, target, rotation, undefined, undefined, undefined, new Vector3(sign * .2, 0, -1).applyQuaternion(facing));
  return solveBarbellContact(rig, side, {}, target, new Vector3(1, 0, 0).applyQuaternion(rotation), false,
    { wristLimits: { flexion: 0, deviation: 0 }, constrainShoulder: true });
}
