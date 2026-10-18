import { describe, expect, it, vi } from "vitest";
import * as anatomy from "./anatomy";
import { createHeldWeightPoseSampler, sampleHeldWeightPose } from "./held-weight-pose";
import { createStudioObject } from "./studio";
import { blankWorkshopScene, identityTransform } from "./workshop";

describe("owned held-weight pose sampler", () => {
  it("allocates lazily and releases one reused rig", () => {
    const create = vi.spyOn(anatomy, "createAnatomyRig");
    const sampler = createHeldWeightPoseSampler();
    try {
      sampler.sample(blankWorkshopScene, 0);
      expect(create).not.toHaveBeenCalled();
      const scene = structuredClone(blankWorkshopScene);
      scene.studio!.objects = [{ ...createStudioObject("dumbbell", "weight", 0), attachment: "left" }];
      sampler.sample(scene, 0);
      sampler.sample(scene, 500);
      expect(create).toHaveBeenCalledTimes(1);
      const release = vi.spyOn(create.mock.results[0].value, "dispose");
      sampler.dispose();
      sampler.dispose();
      expect(release).toHaveBeenCalledTimes(1);
    } finally { sampler.dispose(); create.mockRestore(); }
  });

  it.each(["dumbbell", "barbell"] as const)("matches fresh %s solves through scene, time and body changes", slug => {
    const sampler = createHeldWeightPoseSampler();
    const scene = structuredClone(blankWorkshopScene);
    scene.studio!.objects = [{ ...createStudioObject(slug, "weight", 0), attachment: slug === "barbell" ? "both" : "left",
      x: 0, y: 1.1, z: .45,
      frames: [{ ...identityTransform, timeMs: 0, x: 0, y: 1.1, z: .45 }, { ...identityTransform, timeMs: scene.durationMs, x: .1, y: 1.4, z: .5 }] }];
    const transformed = structuredClone(scene);
    Object.assign(transformed.studio!.body, { x: .2, y: .1, rotationY: 35, scale: 1.2 });
    try {
      const first = sampler.sample(scene, 0), snapshot = structuredClone(first);
      for (let step = 0; step <= 16; step++) {
        const time = scene.durationMs * step / 16;
        for (const value of [scene, transformed]) expect(sampler.sample(value, time)).toEqual(sampleHeldWeightPose(value, time));
      }
      expect(first).toEqual(snapshot);
      sampler.dispose();
      expect(sampler.sample(scene, 0)).toEqual(snapshot);
    } finally { sampler.dispose(); }
  });
});
