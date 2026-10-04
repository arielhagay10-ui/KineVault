import { describe, expect, it } from "vitest";
import { defaultScene, sampleWorkshopPose } from "./workshop";
import { workshopSceneSchema } from "./scene-schema";

describe("workshop timeline", () => {
  it("interpolates keyframes without dropping joint controls", () => {
    const pose = sampleWorkshopPose([
      { timeMs: 0, poses: { "left-shoulder": { x: 0, y: 0, z: 5 }, "right-shoulder": { x: 0, y: 0, z: -5 } } },
      { timeMs: 1600, poses: { "left-shoulder": { x: 0, y: 0, z: -75 }, "right-shoulder": { x: 0, y: 0, z: 75 } } },
    ], 800);
    expect(pose["left-shoulder"]?.z).toBe(-35);
    expect(pose["right-shoulder"]?.z).toBe(35);
    expect(pose.torso).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("accepts sparse named poses and rejects impossible joint angles", () => {
    expect(workshopSceneSchema.safeParse(defaultScene).success).toBe(true);
    const invalid = structuredClone(defaultScene);
    invalid.keyframes[1].poses["left-shoulder"] = { x: 0, y: 0, z: -200 };
    expect(workshopSceneSchema.safeParse(invalid).success).toBe(false);
  });
  it("interpolates wrist turns and preserves automatic grips in older scenes", () => {
    expect(sampleWorkshopPose(defaultScene.keyframes, 800)["left-wrist"]).toBeUndefined();
    const frames = [
      { timeMs: 0, poses: { "left-wrist": { x: -90, y: 20, z: -10 } } },
      { timeMs: 1000, poses: { "left-wrist": { x: 90, y: -20, z: 10 } } },
    ];
    expect(sampleWorkshopPose(frames, 500)["left-wrist"]).toEqual({ x: 0, y: 0, z: 0 });
    expect(workshopSceneSchema.safeParse({ ...defaultScene, durationMs: 1000, keyframes: frames }).success).toBe(true);
    frames[1].poses["left-wrist"].y = 71;
    expect(workshopSceneSchema.safeParse({ ...defaultScene, durationMs: 1000, keyframes: frames }).success).toBe(false);
  });
  it("validates timed annotations against scene bounds", () => {
    const annotation = { startMs: 0, endMs: 1000, label: "Raise", note: null, jointAction: "shoulder-abduction" };
    expect(workshopSceneSchema.safeParse({ ...defaultScene, annotations: [annotation] }).success).toBe(true);
    expect(workshopSceneSchema.safeParse({ ...defaultScene, annotations: [{ ...annotation, endMs: 9000 }] }).success).toBe(false);
    expect(workshopSceneSchema.safeParse({ ...defaultScene, annotations: [{ ...annotation, endMs: 0 }] }).success).toBe(false);
  });
});
