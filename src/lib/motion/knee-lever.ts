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
  "pad": { "radius": 0.055, "width": 0.6 },
  "handle": [0.4, 0.82, 0.05],
  "dorsiflexionDegrees": 10, "weights": 0.3,
  "machines": {
    "leg-extension-machine": { "along": 0.43, "offset": 0.058, "startDegrees": 7, "endDegrees": -75 },
    "leg-curl-machine": { "along": 0.45, "offset": -0.158, "startDegrees": -73, "endDegrees": 7, "thighPad": [1.028, 0.55] }
  }
} as const;

export type KneeLeverSlug = keyof typeof kneeLever.machines;
export const kneeLeverSlugs = Object.keys(kneeLever.machines) as KneeLeverSlug[];
export const isKneeLever = (slug: string): slug is KneeLeverSlug => slug in kneeLever.machines;
const xAxis = new Vector3(1, 0, 0);

/** Static roller centre (y, z) holding the thighs down, when the machine has one. */
export function kneeLeverThighPad(slug: string): readonly [number, number] | undefined {
  const machine = kneeLever.machines[slug as KneeLeverSlug];
  return machine && "thighPad" in machine ? machine.thighPad : undefined;
}

/** Roller centre is `grip` from the pivot at zero degrees; positive offset is in front of the shin. */
export function kneeLeverLever(object: StudioObject) {
  const machine = kneeLever.machines[object.slug as KneeLeverSlug];
  const travel = Math.max(0, Math.min(1, object.machinePosition ?? 0));
  return { pivot: new Vector3(0, kneeLever.pivot[0], kneeLever.pivot[1]),
    grip: new Vector3(0, -machine.along, machine.offset),
    angle: (machine.startDegrees + travel * (machine.endDegrees - machine.startDegrees)) * Math.PI / 180 };
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
