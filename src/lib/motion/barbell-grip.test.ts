import { describe, expect, it } from "vitest";
import { Euler, Group, Quaternion, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { alignBarbellHand, barbellWristPose, solveBarbellGrip } from "./barbell-grip";
import { studioGripOffset } from "./studio-grip";

describe("barbell hand orientation", () => {
  it.each(["left", "right"] as const)("retains the %s supinated grip when aligning a horizontal shaft", side => {
    const rig = createAnatomyRig(new Group());
    try {
      for (let step = 0; step <= 16; step++) {
        poseAnatomyRig(rig, { [`${side}-shoulder`]: { x: 10, y: 5, z: side === "left" ? -12 : 12 }, [`${side}-elbow`]: { x: step * 7.5, y: 0, z: 0 }, [`${side}-wrist`]: { x: -90, y: 0, z: 0 } }, true);
        alignBarbellHand(rig, side, new Vector3(1, 0, 0));
        expect(barbellWristPose(rig, side).x).toBeLessThan(-75);
      }
    } finally { rig.dispose(); }
  });
  it.each(["left", "right"] as const)("aligns the %s hand without moving the elbow or wrist and replays the solved grip", side => {
    const rig = createAnatomyRig(new Group());
    try {
      for (const bend of [0, 20, 50, 85, 120]) {
        const pose = { [`${side}-shoulder`]: { x: 10, y: 5, z: side === "left" ? -12 : 12 }, [`${side}-elbow`]: { x: bend, y: 0, z: 0 }, [`${side}-wrist`]: { x: 0, y: 0, z: 0 } };
        poseAnatomyRig(rig, pose, side);
        const elbow = rig.bones[`${side}-elbow`].quaternion.clone();
        const wrist = rig.handBones[side].getWorldPosition(new Vector3());
        const shaft = new Vector3(1, .1, .05).normalize();
        alignBarbellHand(rig, side, shaft);
        const orientation = rig.handBones[side].getWorldQuaternion(new Quaternion());
        const palm = rig.handBones[side].localToWorld(studioGripOffset(side));
        expect(Math.abs(new Vector3(1, 0, 0).applyQuaternion(orientation).dot(shaft))).toBeCloseTo(1, 7);
        expect(rig.bones[`${side}-elbow`].quaternion.angleTo(elbow)).toBeLessThan(.000001);
        expect(rig.handBones[side].getWorldPosition(new Vector3()).distanceTo(wrist)).toBeLessThan(.000001);
        const saved = barbellWristPose(rig, side);
        expect(Math.abs(saved.x)).toBeLessThanOrEqual(90);
        expect(Math.abs(saved.y)).toBeLessThanOrEqual(70);
        expect(Math.abs(saved.z)).toBeLessThanOrEqual(30);
        poseAnatomyRig(rig, { ...pose, [`${side}-wrist`]: saved }, side);
        expect(rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(palm)).toBeLessThan(.000001);
        expect(rig.handBones[side].getWorldQuaternion(new Quaternion()).angleTo(orientation)).toBeLessThan(.000001);
      }
    } finally { rig.dispose(); }
  });
  it("keeps extreme shaft directions inside wrist limits", () => {
    const rig = createAnatomyRig(new Group());
    try {
      for (const side of ["left", "right"] as const) for (const shaft of [new Vector3(0, 1, 0), new Vector3(0, 0, 1), new Vector3(1, -1, 1).normalize()]) {
        poseAnatomyRig(rig, { [`${side}-shoulder`]: { x: 100, y: 45, z: 50 }, [`${side}-elbow`]: { x: 120, y: 0, z: 0 } }, true);
        alignBarbellHand(rig, side, shaft);
        const saved = barbellWristPose(rig, side);
        expect(Math.abs(saved.x)).toBeLessThanOrEqual(90);
        expect(Math.abs(saved.y)).toBeLessThanOrEqual(70);
        expect(Math.abs(saved.z)).toBeLessThanOrEqual(30);
      }
    } finally { rig.dispose(); }
  });
  it("retains a reachable custom grip on a single-hand barbell", () => {
    const rig = createAnatomyRig(new Group());
    try {
      poseAnatomyRig(rig, {}, "left");
      const rotation = new Euler(Math.PI / 2, -78 * Math.PI / 180, Math.PI / 2);
      const shaft = new Vector3(1, 0, 0).applyEuler(rotation);
      const target = new Vector3(-.08, .2, 0).applyEuler(rotation).add(new Vector3(.41617119433215516, 1.03246544113173, .08));
      const solved = solveBarbellGrip(rig, "left", {}, target, shaft);
      const distance = rig.handBones.left.localToWorld(studioGripOffset("left")).distanceTo(target);
      const alignment = Math.abs(new Vector3(1, 0, 0).applyQuaternion(rig.handBones.left.getWorldQuaternion(new Quaternion())).dot(shaft));
      expect(solved.limited, JSON.stringify({ distance, alignment, wrist: barbellWristPose(rig, "left") })).toBe(false);
    } finally { rig.dispose(); }
  });
});
