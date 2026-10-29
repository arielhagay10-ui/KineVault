import { expect, it } from "vitest";
import { Group, Quaternion, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { reachHingedMachineGrip } from "./machine-grip";
import { studioGripOffset } from "./studio-grip";
import { supportPoseFromRig } from "./support-contacts";

it("leaves the figure unchanged when a machine grip target is invalid", () => {
  const rig = createAnatomyRig(new Group());
  try {
    poseAnatomyRig(rig, { "left-shoulder": { x: -35, y: 0, z: 0 }, "left-elbow": { x: 90, y: 0, z: 0 } }, true);
    const before = rig.bones["left-shoulder"].quaternion.clone();
    expect(reachHingedMachineGrip(rig, "left", {}, new Vector3(NaN, 0, 0), new Vector3(1, 0, 0))).toBe(Infinity);
    expect(rig.bones["left-shoulder"].quaternion.angleTo(before)).toBeLessThan(1e-6);
  } finally { rig.dispose(); }
});

it("canonicalizes equivalent forearm turns without changing a valid machine grip", () => {
  const rig = createAnatomyRig(new Group());
  try {
    poseAnatomyRig(rig, { "left-shoulder": { x: -40, y: 0, z: -30 }, "left-elbow": { x: 90, y: 0, z: 0 } }, true);
    const forearm = rig.forearmBones.left, hand = rig.handBones.left;
    const before = hand.getWorldQuaternion(new Quaternion());
    const target = hand.localToWorld(studioGripOffset("left"));
    const shaft = new Vector3(1, 0, 0).applyQuaternion(before);
    const q = forearm.quaternion.clone(); forearm.quaternion.set(-q.x, -q.y, -q.z, -q.w);
    reachHingedMachineGrip(rig, "left", {}, target, shaft);
    expect(hand.localToWorld(studioGripOffset("left")).distanceTo(target)).toBeLessThan(1e-6);
    expect(hand.getWorldQuaternion(before.clone()).angleTo(before)).toBeLessThan(1e-6);
    expect(supportPoseFromRig(rig)["left-wrist"]!.x).toBeGreaterThanOrEqual(-90);
    expect(supportPoseFromRig(rig)["left-wrist"]!.x).toBeLessThanOrEqual(90);
  } finally { rig.dispose(); }
});
