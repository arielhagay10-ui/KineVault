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
});
