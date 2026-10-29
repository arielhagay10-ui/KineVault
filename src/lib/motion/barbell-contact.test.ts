import { describe, expect, it } from "vitest";
import { Group, Quaternion, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { solveBarbellContact } from "./barbell-contact";
import { studioGripOffset } from "./studio-grip";
import { clampJointControlAngles } from "./workshop";

describe("bounded barbell contact", () => {
  it("honors tighter machine wrist bounds while retaining a reachable grip", () => {
    const rig = createAnatomyRig(new Group());
    const pose = { "left-shoulder": { x: -40, y: 20, z: -60 }, "left-elbow": { x: 80, y: 0, z: 0 }, "left-wrist": { x: 0, y: 20, z: 15 } };
    try {
      poseAnatomyRig(rig, pose, true);
      const target = rig.handBones.left.localToWorld(studioGripOffset("left"));
      const shaft = new Vector3(1, 0, 0).applyQuaternion(rig.handBones.left.getWorldQuaternion(new Quaternion()));
      rig.handBones.left.rotation.set(70 * Math.PI / 180, 0, 30 * Math.PI / 180);
      const result = solveBarbellContact(rig, "left", pose, target, shaft, false, { wristLimits: { flexion: 35, deviation: 25 }, constrainShoulder: true, localFirst: true });
      expect(result.limited).toBe(false);
      expect(rig.handBones.left.localToWorld(studioGripOffset("left")).distanceTo(target)).toBeLessThan(.005);
      expect(Math.abs(rig.handBones.left.rotation.x) * 180 / Math.PI).toBeLessThanOrEqual(35.001);
      expect(Math.abs(rig.handBones.left.rotation.z) * 180 / Math.PI).toBeLessThanOrEqual(25.001);
      const shoulder = rig.bones["left-shoulder"].rotation;
      const angles = { x: shoulder.x * 180 / Math.PI, y: shoulder.y * 180 / Math.PI, z: -shoulder.z * 180 / Math.PI };
      const bounded = clampJointControlAngles("left-shoulder", angles);
      for (const axis of ["x", "y", "z"] as const) expect(angles[axis]).toBeCloseTo(bounded[axis], 5);
    } finally { rig.dispose(); }
  });
  it("can move inward from several joint limits toward a nearby feasible grip", () => {
    const rig = createAnatomyRig(new Group());
    const pose = { "left-shoulder": { x: 160, y: -7.93758, z: -170 }, "left-elbow": { x: 0, y: 0, z: 0 }, "left-wrist": { x: -90, y: -70, z: -30 } };
    try {
      poseAnatomyRig(rig, { ...pose, "left-shoulder": { x: 156.43187, y: -9.3009, z: -168.2866 }, "left-elbow": { x: 3.55191, y: 0, z: 0 }, "left-wrist": { x: -90, y: -70, z: -29.69058 } }, true);
      const target = rig.handBones.left.localToWorld(studioGripOffset("left"));
      const shaft = new Vector3(1, 0, 0).applyQuaternion(rig.handBones.left.getWorldQuaternion(new Quaternion()));
      poseAnatomyRig(rig, pose, true);
      expect(solveBarbellContact(rig, "left", pose, target, shaft, false).limited).toBe(false);
      expect(rig.handBones.left.localToWorld(studioGripOffset("left")).distanceTo(target)).toBeLessThan(.005);
    } finally { rig.dispose(); }
  });
  it("rejects an invalid target without changing the rig", () => {
    const rig = createAnatomyRig(new Group());
    try {
      poseAnatomyRig(rig, {}, true); const before = rig.handBones.left.getWorldPosition(new Vector3());
      expect(solveBarbellContact(rig, "left", {}, new Vector3(NaN, 0, 0), new Vector3(1, 0, 0), false).limited).toBe(true);
      expect(rig.handBones.left.getWorldPosition(new Vector3())).toEqual(before);
    } finally { rig.dispose(); }
  });
});
