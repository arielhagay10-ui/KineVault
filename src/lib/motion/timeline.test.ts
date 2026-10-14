import { describe, expect, it } from "vitest";
import { machineDemoScene } from "./studio-machines";
import { workshopSceneSchema } from "./scene-schema";
import { addEvenlySpacedWorkshopFrames, captureWorkshopFrame, pasteWorkshopFrame, deleteWorkshopFrame, retimeWorkshopFrame } from "./timeline";
import { blankWorkshopScene } from "./workshop";
import { editHeldWeightPose, sampleHeldWeightPose } from "./held-weight-pose";
import { createStudioObject } from "./studio";
import { automaticWeightTransform } from "./automatic-weight-grip";

const demo = () => machineDemoScene("smith-machine", "00000000-0000-4000-8000-000000000001");

describe("workshop frame editing", () => {
  it("fills both movement halves evenly without overwriting authored poses or tracks", () => {
    const scene = structuredClone(blankWorkshopScene);
    scene.keyframes[1].poses["left-elbow"] = { x: 80, y: 0, z: 0 };
    const next = addEvenlySpacedWorkshopFrames(scene, 5);
    expect(next.keyframes.map(frame => frame.timeMs)).toEqual([0, 400, 800, 1200, 1600, 2000, 2400, 2800, 3200]);
    expect(next.keyframes[4]).toEqual(scene.keyframes[1]);
    expect(next.studio).toEqual(scene.studio);
    expect(scene.keyframes).toHaveLength(3);
    expect(workshopSceneSchema.safeParse(next).success).toBe(true);
    expect(addEvenlySpacedWorkshopFrames(next, 5)).toEqual(next);
    expect(() => addEvenlySpacedWorkshopFrames(scene, 14)).toThrow();
  });
  it("copies a body and machine pose together and pastes at the destination time", () => {
    const scene = demo(), snapshot = captureWorkshopFrame(scene, 4);
    const next = pasteWorkshopFrame(scene, 8, snapshot);
    expect(next.keyframes[8]).toEqual({ ...scene.keyframes[4], timeMs: 2400 });
    expect(next.studio!.objects[0].frames![8].machinePosition).toBe(scene.studio!.objects[0].frames![4].machinePosition);
    expect(next.keyframes[4]).toEqual(scene.keyframes[4]);
    expect(workshopSceneSchema.safeParse(next).success).toBe(true);
  });
  it("rejects paste when an independent equipment track is already full", () => {
    const scene = demo(), object = scene.studio!.objects[0];
    object.frames = Array.from({ length: 24 }, (_, index) => ({ ...object.frames![0], timeMs: index * 100 }));
    const clipboard = captureWorkshopFrame(scene, 0);
    expect(() => pasteWorkshopFrame(scene, 8, clipboard)).toThrow();
    expect(object.frames).toHaveLength(24);
  });
  it("keeps another barbell pose unchanged when pasting from a different driving arm", () => {
    let scene = structuredClone(blankWorkshopScene);
    const bar = { ...createStudioObject("barbell", "bar", 0), attachment: "both" as const };
    scene.studio!.objects = [{ ...bar, ...automaticWeightTransform(scene.studio!.body, bar, "both", scene, 0) }];
    scene = editHeldWeightPose(scene, 0, "selected", { "right-elbow": { x: 85, y: 0, z: 0 } });
    const clipboard = captureWorkshopFrame(scene, 0);
    scene = editHeldWeightPose(scene, 1, "selected", { "left-elbow": { x: 145, y: 0, z: 0 } });
    const next = pasteWorkshopFrame(scene, 0, clipboard);
    expect(sampleHeldWeightPose(next, 1600)).toEqual(sampleHeldWeightPose(scene, 1600));
  });
  it("retimes the body and matching machine frame together without changing their values", () => {
    const original = demo();
    const edited = retimeWorkshopFrame(original, 4, 1300);
    expect(edited.keyframes[4]).toEqual({ ...original.keyframes[4], timeMs: 1300 });
    expect(edited.studio!.objects[0].frames![4]).toEqual({ ...original.studio!.objects[0].frames![4], timeMs: 1300 });
    expect(original.keyframes[4].timeMs).toBe(1200);
    expect(workshopSceneSchema.safeParse(edited).success).toBe(true);
  });
  it("rejects moving past another body or independent equipment frame or the endpoints", () => {
    const scene = demo();
    scene.studio!.objects[0].frames!.splice(5, 0, { ...scene.studio!.objects[0].frames![4], timeMs: 1250 });
    for (const time of [900, 1250, 1500, NaN, 1200.5]) expect(() => retimeWorkshopFrame(scene, 4, time)).toThrow();
    expect(() => retimeWorkshopFrame(scene, 0, 100)).toThrow();
    expect(() => retimeWorkshopFrame(scene, 16, 4700)).toThrow();
  });
  it("deletes matching body and machine frames and keeps unrelated moments", () => {
    const scene = demo();
    const edited = deleteWorkshopFrame(scene, 4);
    expect(edited.keyframes.map(frame => frame.timeMs)).not.toContain(1200);
    expect(edited.studio!.objects[0].frames!.map(frame => frame.timeMs)).not.toContain(1200);
    expect(edited.studio!.objects[0].frames).toHaveLength(16);
    expect(edited.keyframes[3]).toEqual(scene.keyframes[3]);
    expect(scene.keyframes).toHaveLength(17);
    expect(workshopSceneSchema.safeParse(edited).success).toBe(true);
  });
  it("allows endpoint deletion by moving the next surviving pose and matching carriage to the boundary", () => {
    for (const index of [0, 16]) {
      const scene = demo(), edited = deleteWorkshopFrame(scene, index);
      const position = index === 0 ? 0 : 15, source = index === 0 ? 1 : 15;
      expect(edited.keyframes[position].timeMs).toBe(index === 0 ? 0 : 4800);
      expect(edited.studio!.objects[0].frames![position].machinePosition).toBe(scene.studio!.objects[0].frames![source].machinePosition);
      expect(edited.studio!.objects[0].frames![position].timeMs).toBe(edited.keyframes[position].timeMs);
      expect(workshopSceneSchema.safeParse(edited).success).toBe(true);
    }
  });
  it("protects the last two frames and removes an emptied equipment track", () => {
    const scene = demo();
    scene.studio!.objects[0].frames = [scene.studio!.objects[0].frames![0]];
    scene.studio!.objects[0].frames[0].machinePosition = 0.7;
    const deleted = deleteWorkshopFrame(scene, 0).studio!.objects[0];
    expect(deleted.frames).toBeUndefined();
    expect(deleted.machinePosition).toBe(0.7);
    scene.keyframes = [scene.keyframes[0], scene.keyframes.at(-1)!];
    expect(() => deleteWorkshopFrame(scene, 0)).toThrow();
    expect(() => deleteWorkshopFrame(scene, 1)).toThrow();
    expect(() => deleteWorkshopFrame(scene, -1)).toThrow();
  });
  it("keeps independent equipment moments ordered when an endpoint is promoted", () => {
    const scene = demo();
    scene.keyframes = [scene.keyframes[0], scene.keyframes[2], scene.keyframes[14], scene.keyframes[16]];
    for (const index of [0, 3]) expect(workshopSceneSchema.safeParse(deleteWorkshopFrame(scene, index)).success).toBe(true);
  });
  it("moves matching phase markers with a frame and protects nearby annotation boundaries", () => {
    const scene = demo();
    scene.annotations = [{ startMs: 900, endMs: 1200, label: "Lower", note: null, jointAction: null }];
    expect(retimeWorkshopFrame(scene, 4, 1300).annotations![0].endMs).toBe(1300);
    scene.annotations.push({ startMs: 1200, endMs: 1250, label: "Hold", note: null, jointAction: null });
    expect(() => retimeWorkshopFrame(scene, 4, 1300)).toThrow();
  });
  it.each([0, 2])("keeps sparse equipment motion at the promoted pose when endpoint %s is deleted", index => {
    const scene = demo();
    scene.keyframes = [scene.keyframes[0], scene.keyframes[8], scene.keyframes[16]];
    scene.studio!.objects[0].frames = [scene.studio!.objects[0].frames![0], scene.studio!.objects[0].frames![16]];
    scene.studio!.objects[0].frames![1].machinePosition = 0;
    const edited = deleteWorkshopFrame(scene, index);
    expect(workshopSceneSchema.safeParse(edited).success).toBe(true);
    expect(edited.studio!.objects[0].frames).toHaveLength(2);
    expect(edited.studio!.objects[0].frames![0].timeMs).toBe(0);
    expect(edited.studio!.objects[0].frames![index === 0 ? 0 : 1].machinePosition).toBe(0.5);
    expect(edited.studio!.objects[0].frames![1].timeMs).toBe(4800);
  });
});
