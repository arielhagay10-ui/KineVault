import { describe, expect, it } from "vitest";
import { captureFirstWorkshopPose, workshopPoseSignature } from "./workshop-recording";
import { createStudioObject, sampleStudioObject, setStudioObjectAnimated } from "./studio";
import { setMachinePosition } from "./studio-machines";
import { blankWorkshopScene, type StudioObject } from "./workshop";

describe("explicit pose recording", () => {
  it("keeps the start and return recorded when a static machine's finish begins animating", () => {
    const scene = structuredClone(blankWorkshopScene);
    scene.studio!.objects = [{ ...createStudioObject("cable-row-machine", "row", 0), machineUse: true }];
    const next = structuredClone(scene);
    next.studio!.objects[0] = setMachinePosition(setStudioObjectAnimated(next.studio!.objects[0], true, 1600, next.keyframes.map(frame => frame.timeMs)), .65, 1600);
    for (const time of [0, 3200]) expect(workshopPoseSignature(next, time)).toBe(workshopPoseSignature(scene, time));
  });
  it("starts the repetition from the recorded first body and equipment pose", () => {
    const scene = structuredClone(blankWorkshopScene);
    scene.keyframes[0].poses["left-elbow"] = { x: 70, y: 0, z: 0 };
    const weight: StudioObject = { ...createStudioObject("dumbbell", "weight", 0), attachment: "left" };
    weight.frames = scene.keyframes.map(frame => ({ ...weight, timeMs: frame.timeMs, y: frame.timeMs === 0 ? 1.1 : 1.6 }));
    const bench = createStudioObject("bench", "bench", 1);
    scene.studio!.objects = [weight, bench];
    const captured = captureFirstWorkshopPose(scene);
    for (const frame of captured.keyframes) {
      expect(frame.poses["left-elbow"]?.x).toBe(70);
      expect(sampleStudioObject(captured.studio!.objects[0], frame.timeMs).y).toBe(1.1);
    }
    expect(captured.studio!.objects[1].frames).toBeUndefined();
    expect(scene.keyframes[1].poses["left-elbow"]).toBeUndefined();
    expect(sampleStudioObject(scene.studio!.objects[0], 1600).y).toBe(1.6);
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
