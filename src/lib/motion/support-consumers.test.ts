import { expect, it } from "vitest";
import { Group, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { sampleHeldWeightPose } from "./held-weight-pose";
import { supportContactPoint } from "./support-contacts";
import { applyStudioSeating } from "./studio-seat";
import { blankWorkshopScene } from "./workshop";
import { createStudioObject } from "./studio";
import { carryHeldWeightsWithBody } from "./held-weight-body";

it("the inspector samples anchored joints even when no weight is held", () => {
  const rig = createAnatomyRig(new Group());
  try {
    const scene = structuredClone(blankWorkshopScene);
    poseAnatomyRig(rig, {});
    const target = supportContactPoint(rig, "left-hand").add(new Vector3(-.04, .04, 0));
    const rack = { ...createStudioObject("squat-rack", "6eb67185-eabc-4c60-ab75-afd29f587c5a", 0), x: 0, y: 0, z: 0 };
    scene.studio!.objects = [rack];
    scene.studio!.supports = [{ region: "left-hand", objectId: rack.id, surface: "body", point: { x: target.x, y: target.y, z: target.z }, normal: { x: 0, y: 1, z: 0 }, turn: 0 }];
    const sampled = sampleHeldWeightPose(scene, 0);
    poseAnatomyRig(rig, sampled);
    expect(supportContactPoint(rig, "left-hand").distanceTo(target)).toBeLessThan(.005);
    expect(applyStudioSeating(rig, scene.studio, 0, sampled)?.every(report => report.reachable)).toBe(true);
  } finally { rig.dispose(); }
});

it("moving a pelvis support carries held weights with the supported body", () => {
  const scene = structuredClone(blankWorkshopScene);
  const bench = createStudioObject("bench", "7c959b1f-4d8e-45cc-877e-2e70c05c7a2d", 0);
  const weight = { ...createStudioObject("dumbbell", "8c959b1f-4d8e-45cc-877e-2e70c05c7a2d", 1), attachment: "right" as const, x: .5, y: 1.3, z: .5 };
  scene.studio!.objects = [bench, weight];
  scene.studio!.supports = [{ region: "pelvis", objectId: bench.id, surface: "seat", point: { x: 0, y: .24, z: .054 }, normal: { x: 0, y: 0, z: 1 }, turn: 0 }];
  const next = structuredClone(scene);
  next.studio!.objects[0].x += .3;
  const carried = carryHeldWeightsWithBody(scene, next).studio!.objects[1];
  expect(carried.x).toBeCloseTo(.8, 5);
  expect(carried.y).toBeCloseTo(1.3, 5);
});
