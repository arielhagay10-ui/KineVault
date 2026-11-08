import { Euler, Quaternion, Vector3 } from "three";
import type { AnatomyRig } from "./anatomy";
import { gripOffset } from "./grip-edit";
import { poseMachineArm } from "./machine-grip";
import { sampleStudioObject, studioPointToWorld } from "./studio";
import { studioGripOffset } from "./studio-grip";
import type { StudioLayout, StudioObject } from "./workshop";

// Metres/Y-up, shared with the original Blender model. The straight bar runs along x between two uprights.
export const pullUpBar = {
  "height": 3.42, "grip": 0.42, "radius": 0.022,
  "upright": { "x": 0.95, "size": 0.08, "top": 3.52 },
  "base": { "front": 0.62, "back": -0.62 }
} as const;

const sides = ["left", "right"] as const, radians = Math.PI / 180;
// Overhand: fingers up and over the bar, palms facing forward, as on the pronated pulldown.
const overhand = new Quaternion().setFromEuler(new Euler(Math.PI, Math.PI, 0, "YXZ"));

export function pullUpBarGrip(side: "left" | "right") {
  return new Vector3((side === "left" ? 1 : -1) * pullUpBar.grip, pullUpBar.height, 0);
}

/** Holding the bar with both hands hangs the figure from it. */
export function hangingBar(studio: StudioLayout | undefined) {
  return studio?.objects.find(object => object.slug === "pull-up-bar" && object.attachment === "both");
}

/**
 * The hands carry the body. The authored shoulders and elbows set where the wrists sit relative
 * to the trunk, so the body moves until both closed hands meet their grips. Each arm then reaches
 * its grip exactly, bending toward the authored elbow. Legs and torso stay authored.
 */
export function hangFromBar(rig: AnatomyRig, raw: StudioObject, timeMs: number) {
  const bar = sampleStudioObject(raw, timeMs);
  const facing = new Quaternion().setFromEuler(new Euler(bar.rotationX * radians, bar.rotationY * radians, bar.rotationZ * radians));
  const parent = rig.root.parent?.getWorldQuaternion(new Quaternion()) ?? new Quaternion();
  rig.root.quaternion.copy(parent.invert().multiply(facing));
  rig.root.updateWorldMatrix(true, true);
  const scale = rig.root.getWorldScale(new Vector3()).x, hand = facing.clone().multiply(overhand);
  const wrists = sides.map(side => studioPointToWorld(pullUpBarGrip(side).add(gripOffset(bar, side)), bar)
    .sub(studioGripOffset(side).multiplyScalar(scale).applyQuaternion(hand)));
  const shift = wrists[0].clone().add(wrists[1]);
  for (const side of sides) shift.sub(rig.handBones[side].getWorldPosition(new Vector3()));
  const origin = rig.root.getWorldPosition(new Vector3()).addScaledVector(shift, .5);
  rig.root.position.copy(rig.root.parent ? rig.root.parent.worldToLocal(origin) : origin);
  rig.root.updateWorldMatrix(true, true);
  for (const [index, side] of sides.entries()) {
    const shoulder = rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3()), elbow = rig.bones[`${side}-elbow`];
    const upper = elbow.position.length() * scale, lower = rig.handBones[side].position.length() * scale;
    const direction = wrists[index].clone().sub(shoulder);
    const distance = Math.max(Math.abs(upper - lower) + 1e-6, Math.min(direction.length(), upper + lower - 1e-6));
    direction.normalize();
    const along = (upper ** 2 - lower ** 2 + distance ** 2) / (2 * distance), center = shoulder.clone().addScaledVector(direction, along);
    const pole = elbow.getWorldPosition(new Vector3()).sub(center);
    pole.addScaledVector(direction, -pole.dot(direction));
    if (pole.lengthSq() < 1e-10) pole.set(side === "left" ? 1 : -1, -1, 0).applyQuaternion(facing).addScaledVector(direction, -direction.dot(pole));
    poseMachineArm(rig, side, center.addScaledVector(pole.normalize(), Math.sqrt(Math.max(0, upper ** 2 - along ** 2))), wrists[index], hand);
  }
}
