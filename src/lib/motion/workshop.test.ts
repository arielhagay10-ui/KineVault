import { describe, expect, it } from "vitest";
import { defaultScene, sampleWorkshopPose } from "./workshop";
import { workshopSceneSchema } from "./scene-schema";

describe("workshop timeline", () => {
  it("interpolates keyframes without dropping joint controls", () => {
    const pose = sampleWorkshopPose(defaultScene.keyframes, 800);
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
  it("validates timed annotations against scene bounds", () => {
    const annotation = { startMs: 0, endMs: 1000, label: "Raise", note: null, jointAction: "shoulder-abduction" };
    expect(workshopSceneSchema.safeParse({ ...defaultScene, annotations: [annotation] }).success).toBe(true);
    expect(workshopSceneSchema.safeParse({ ...defaultScene, annotations: [{ ...annotation, endMs: 9000 }] }).success).toBe(false);
    expect(workshopSceneSchema.safeParse({ ...defaultScene, annotations: [{ ...annotation, endMs: 0 }] }).success).toBe(false);
  });
});
