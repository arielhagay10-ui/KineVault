import { describe, expect, it } from "vitest";
import { captureFirstWorkshopPose, hasIndependentWorkshopMotion, workshopPoseSignature } from "./workshop-recording";
import { createStudioObject, sampleStudioObject, setStudioObjectAnimated, updateStudioObjectTransform } from "./studio";
import { setMachinePosition } from "./studio-machines";
import { blankWorkshopScene, type StudioObject } from "./workshop";

describe("explicit pose recording", () => {
  it("protects edited and duplicated moments but lets a new start seed untouched defaults", () => {
    const before = structuredClone(blankWorkshopScene), next = structuredClone(before);
    next.keyframes[0].poses["left-elbow"] = { x: 70, y: 0, z: 0 };
    expect(hasIndependentWorkshopMotion(before, next)).toBe(false);
    next.keyframes[1].poses["left-elbow"] = { x: 40, y: 0, z: 0 };
    expect(hasIndependentWorkshopMotion(before, next)).toBe(true);
    const duplicated = { ...before, keyframes: [before.keyframes[0], { timeMs: 800, poses: {} }, ...before.keyframes.slice(1)] };
    expect(hasIndependentWorkshopMotion(before, duplicated)).toBe(true);
  });
  it("protects equipment edited away from Start without mistaking a new static track for a finish edit", () => {
    const before = structuredClone(blankWorkshopScene);
    const weight = createStudioObject("dumbbell", "weight", 0);
    before.studio!.objects = [weight];
    const next = structuredClone(before);
    next.studio!.objects[0] = setStudioObjectAnimated(weight, true, 0, before.keyframes.map(frame => frame.timeMs));
    next.studio!.objects[0] = updateStudioObjectTransform(next.studio!.objects[0], { ...weight, y: 1.5 }, 0, true);
    expect(hasIndependentWorkshopMotion(before, next)).toBe(false);
    next.studio!.objects[0] = updateStudioObjectTransform(next.studio!.objects[0], { ...weight, y: 1.8 }, 1600, true);
    expect(hasIndependentWorkshopMotion(before, next)).toBe(true);
  });
  it("starts an untouched repetition from the recorded first body and equipment pose", () => {
    const scene = structuredClone(blankWorkshopScene);
    scene.keyframes[0].poses["left-elbow"] = { x: 70, y: 0, z: 0 };
    const weight: StudioObject = { ...createStudioObject("dumbbell", "weight", 0), attachment: "left" };
    weight.frames = scene.keyframes.map(frame => ({ ...weight, timeMs: frame.timeMs, y: frame.timeMs === 0 ? 1.1 : 1.6 }));
    scene.studio!.objects = [weight];
    const captured = captureFirstWorkshopPose(scene);
    expect(captured.keyframes.map(frame => frame.poses["left-elbow"]?.x)).toEqual([70, 70, 70]);
    expect(sampleStudioObject(captured.studio!.objects[0], 1600).y).toBe(1.1);
    expect(scene.keyframes[1].poses["left-elbow"]).toBeUndefined();
    expect(sampleStudioObject(scene.studio!.objects[0], 1600).y).toBe(1.6);
  });
  it("requires recapture after a surface anchor changes", () => {
    const scene = structuredClone(blankWorkshopScene);
    const before = workshopPoseSignature(scene, 0);
    scene.studio!.supports = [{ region: "left-hand", objectId: null, surface: "floor", point: { x: .3, y: 0, z: .4 }, normal: { x: 0, y: 1, z: 0 }, turn: 0 }];
    expect(workshopPoseSignature(scene, 0)).not.toBe(before);
    const anchored = workshopPoseSignature(scene, 0);
    scene.studio!.supports[0].point.x += .1;
    expect(workshopPoseSignature(scene, 0)).not.toBe(anchored);
  });
  it("keeps the start and return recorded when a static machine's finish begins animating", () => {
    const scene = structuredClone(blankWorkshopScene);
    scene.studio!.objects = [{ ...createStudioObject("cable-row-machine", "row", 0), machineUse: true }];
    const next = structuredClone(scene);
    next.studio!.objects[0] = setMachinePosition(setStudioObjectAnimated(next.studio!.objects[0], true, 1600, next.keyframes.map(frame => frame.timeMs)), .65, 1600);
    for (const time of [0, 3200]) expect(workshopPoseSignature(next, time)).toBe(workshopPoseSignature(scene, time));
  });
  it("marks a recorded pose changed for motion edits, without treating camera changes as recording", () => {
    const scene = structuredClone(blankWorkshopScene), captured = workshopPoseSignature(scene, 0);
    expect(workshopPoseSignature({ ...scene, cameraAngle: "side" }, 0)).toBe(captured);
    const next = structuredClone(scene);
    next.keyframes[0].poses["left-elbow"] = { x: 70, y: 0, z: 0 };
    expect(workshopPoseSignature(next, 0)).not.toBe(captured);
    expect(workshopPoseSignature(next, 1600)).toBe(workshopPoseSignature(scene, 1600));
  });
});
