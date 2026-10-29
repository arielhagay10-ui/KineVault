import { describe, expect, it } from "vitest";
import { createQuickScene } from "./quick-create";
import { editShoulderWithElbow } from "./shoulder-follow";
import { sampleHeldWeightPose } from "./held-weight-pose";
import { sampleStudioObject } from "./studio";

describe("shoulder and elbow editing", () => {
  it.each(["left", "right"] as const)("moves only the %s shoulder press lever when elbow follows shoulder", side => {
    const scene = createQuickScene("shoulder-press-machine");
    const object = scene.studio!.objects[0];
    Object.assign(object, { frames: undefined, machinePosition: .2, machinePositionLeft: .2, machinePositionRight: .2 });
    const target = structuredClone(scene);
    target.studio!.objects[0][side === "left" ? "machinePositionLeft" : "machinePositionRight"] = .7;
    const shoulder = `${side}-shoulder` as const;
    const desired = sampleHeldWeightPose(target, 0)[shoulder]!;
    const before = sampleHeldWeightPose(scene, 0)[shoulder]!;
    const next = editShoulderWithElbow(scene, 0, false, { [shoulder]: desired }, "x", side);
    const actual = sampleHeldWeightPose(next, 0)[shoulder]!;
    const sampled = sampleStudioObject(next.studio!.objects[0], 0);
    expect(next.studio!.objects[0].attachment).toBe(object.attachment);
    expect(Math.abs(actual.x - desired.x)).toBeLessThan(Math.abs(before.x - desired.x) / 2);
    expect(sampled[side === "left" ? "machinePositionLeft" : "machinePositionRight"]).toBeGreaterThan(.3);
    expect(sampled[side === "left" ? "machinePositionRight" : "machinePositionLeft"]).toBe(.2);
    expect(sampleStudioObject(next.studio!.objects[0], scene.durationMs).machinePositionLeft).toBe(.2);
    expect(sampleStudioObject(next.studio!.objects[0], scene.durationMs).machinePositionRight).toBe(.2);
  }, 15_000);
  it.each(["left", "right"] as const)("poses the released %s arm without changing T-bar travel", side => {
    const scene = createQuickScene("t-bar-row-machine");
    const machine = scene.studio!.objects[0];
    Object.assign(machine, { rowGrip: "wide", attachment: side === "left" ? "right" : "left" });
    const shoulder = `${side}-shoulder` as const;
    const requested = { x: 30, y: 0, z: 0 };

    const next = editShoulderWithElbow(scene, 0, false, { [shoulder]: requested }, "x", side);

    expect(next.keyframes[0].poses[shoulder]).toEqual(requested);
    expect(next.keyframes.slice(1)).toEqual(scene.keyframes.slice(1));
    expect(next.studio!.objects[0]).toEqual(machine);
  });
});
