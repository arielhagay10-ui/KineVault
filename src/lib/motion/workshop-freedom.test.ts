import { describe, expect, it } from "vitest";
import { addWorkshopEquipment, createFreeCableSetup, editWorkshopMoment } from "./workshop-freedom";
import { createQuickScene } from "./quick-create";
import { blankWorkshopScene } from "./workshop";
import { workshopSceneSchema } from "./scene-schema";
import { limbPoseBlock } from "./limb-pose";

const itemId = "e84c556e-13a0-4b02-8fbe-5bc19bf85ccf";

describe("free workshop equipment", () => {
  it("creates an editable finish for drafts without a midpoint and preserves surrounding poses", () => {
    const scene = structuredClone(blankWorkshopScene);
    scene.keyframes = [{ timeMs: 0, poses: { torso: { x: 10, y: 0, z: 0 } } }, { timeMs: 3200, poses: { torso: { x: 30, y: 0, z: 0 } } }];
    const result = editWorkshopMoment(scene, 1600);
    expect(result.index).toBe(1);
    expect(result.scene.keyframes).toHaveLength(3);
    expect(result.scene.keyframes[0]).toEqual(scene.keyframes[0]);
    expect(result.scene.keyframes[1]).toMatchObject({ timeMs: 1600, poses: { torso: { x: 20, y: 0, z: 0 } } });
    expect(result.scene.keyframes[2]).toEqual(scene.keyframes[1]);
    expect(scene.keyframes).toHaveLength(2);
    expect(editWorkshopMoment(result.scene, 1600).scene).toBe(result.scene);
  });
  it("keeps existing moments editable at the pose limit and rejects extra moments", () => {
    const scene = structuredClone(blankWorkshopScene);
    scene.keyframes = Array.from({ length: 24 }, (_, i) => ({ timeMs: Math.round(scene.durationMs * i / 23), poses: {} }));
    expect(editWorkshopMoment(scene, 0)).toEqual({ scene, index: 0 });
    expect(() => editWorkshopMoment(scene, 1600)).toThrow(/24 poses/);
  });
  it("places a cable row without taking over the body or existing contacts", () => {
    const scene = createQuickScene("dumbbell");
    const next = addWorkshopEquipment(scene, "cable-row-machine", itemId);
    expect(next.studio!.objects[0]).toEqual(scene.studio!.objects[0]);
    expect(next.studio!.objects[1].machineUse).toBe(false);
    expect(limbPoseBlock(next, "left-foot")).toBeUndefined();
  });

  it("replaces a row with a free cable while preserving authored movement and other items", () => {
    const scene = createQuickScene("cable-row-machine");
    const id = scene.studio!.objects[0].id;
    scene.keyframes[1].poses["left-knee"] = { x: -30, y: 0, z: 0 };
    const withBench = addWorkshopEquipment(scene, "bench", itemId);
    const before = structuredClone(withBench);
    const next = createFreeCableSetup(withBench, id);
    expect(next.motionStyle).toBe("free");
    expect(next.keyframes).toEqual(before.keyframes);
    expect(next.studio!.presentation).toEqual(before.studio!.presentation);
    expect(next.studio!.objects[1]).toEqual(before.studio!.objects[1]);
    expect(next.studio!.objects[0]).toMatchObject({ id, slug: "cable-machine", attachment: "both", cableAttachment: "straight-bar", pulleyHeight: .3 });
    expect(next.studio!.objects[0].frames).toBeUndefined();
    for (const limb of ["left-hand", "right-hand", "left-foot", "right-foot"] as const) expect(limbPoseBlock(next, limb)).toBeUndefined();
    expect(workshopSceneSchema.safeParse(next).success).toBe(true);
    expect(withBench).toEqual(before);
  });

  it("adds a free cable to a blank scene and replaces occupied hand contacts", () => {
    const scene = createQuickScene("dumbbell-pair");
    const next = createFreeCableSetup(scene, itemId);
    expect(next.studio!.objects.map(item => item.attachment)).toEqual(["none", "none", "both"]);
    expect(next.studio!.body).toEqual(blankWorkshopScene.studio!.body);
    expect(workshopSceneSchema.safeParse(next).success).toBe(true);
  });
});
