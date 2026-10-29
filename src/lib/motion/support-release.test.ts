import { expect, it } from "vitest";
import { Group, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { weightAtPalm } from "./automatic-weight-grip";
import { sampleHeldWeightPose } from "./held-weight-pose";
import { bakeSupportRelease, supportContactPoint } from "./support-contacts";
import { createStudioObject } from "./studio";
import { blankWorkshopScene } from "./workshop";

it("releases a failed hand anchor without baking its unreachable arm pose into the movement", () => {
  const rig = createAnatomyRig(new Group()), scene = structuredClone(blankWorkshopScene);
  scene.keyframes[1].poses["right-elbow"] = { x: 60, y: 0, z: 0 };
  scene.studio!.supports = [{ region: "right-hand", objectId: null, surface: "floor", point: { x: -5, y: 0, z: -7 }, normal: { x: 0, y: 1, z: 0 }, turn: 0 }];
  try {
    const next = bakeSupportRelease(scene, "right-hand", rig);
    expect(next.studio!.supports).toEqual([]);
    expect(next.keyframes).toEqual(scene.keyframes);
  } finally { rig.dispose(); }
});

it("rejects root release when preserving later poses needs an animated body path", () => {
  const rig = createAnatomyRig(new Group()), scene = structuredClone(blankWorkshopScene);
  scene.studio!.supports = [{ region: "back", objectId: null, surface: "floor", point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 }, turn: 0 }];
  scene.keyframes[1].poses.torso = { x: 30, y: 0, z: 0 };
  const before = structuredClone(scene);
  try {
    expect(() => bakeSupportRelease(scene, "back", rig)).toThrow(/body.*path/i);
    expect(scene).toEqual(before);
  } finally { rig.dispose(); }
});

it("releasing an elbow support retains the final held-weight pose", () => {
  const rig = createAnatomyRig(new Group()), scene = structuredClone(blankWorkshopScene);
  try {
    const desired = { "left-shoulder": { x: -30, y: 0, z: 0 }, "left-elbow": { x: 90, y: 0, z: 0 }, "left-wrist": { x: 0, y: 0, z: 0 } };
    poseAnatomyRig(rig, desired);
    const target = supportContactPoint(rig, "left-elbow");
    const rack = { ...createStudioObject("squat-rack", "rack", 0), x: 0, y: 0, z: 0 };
    let weight = { ...createStudioObject("dumbbell", "weight", 1), attachment: "left" as const };
    weight = { ...weight, ...weightAtPalm(rig, weight, "left") };
    scene.studio!.objects = [rack, weight];
    scene.studio!.supports = [{ region: "left-elbow", objectId: rack.id, surface: "body", point: { x: target.x, y: target.y, z: target.z }, normal: { x: 0, y: 1, z: 0 }, turn: 0 }];
    const before = sampleHeldWeightPose(scene, 0);
    poseAnatomyRig(rig, before);
    const elbow = rig.bones["left-elbow"].getWorldPosition(new Vector3());
    const hand = rig.handBones.left.getWorldPosition(new Vector3());
    const released = bakeSupportRelease(scene, "left-elbow", rig);
    poseAnatomyRig(rig, sampleHeldWeightPose(released, 0));
    expect(rig.bones["left-elbow"].getWorldPosition(new Vector3()).distanceTo(elbow)).toBeLessThan(.005);
    expect(rig.handBones.left.getWorldPosition(new Vector3()).distanceTo(hand)).toBeLessThan(.005);
  } finally { rig.dispose(); }
});
