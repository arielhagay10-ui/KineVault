import { expect, it } from "vitest";
import { automaticWeightTransform } from "./automatic-weight-grip";
import { editHeldWeightPose, sampleHeldWeightPose } from "./held-weight-pose";
import { jointEditChanges } from "./joint-edit";
import { createStudioObject } from "./studio";
import { resolveStudioObject } from "./studio-constraints";
import { workshopSceneSchema } from "./scene-schema";
import { blankWorkshopScene, identityTransform } from "./workshop";

it.each((["dumbbell", "barbell", "kettlebell"] as const).flatMap(slug =>
  (["left", "right", "both"] as const).flatMap(attachment =>
    (["shoulder", "elbow", "wrist"] as const).flatMap(part =>
      (attachment === "both" ? ["left", "right"] as const : [attachment]).flatMap(side =>
        (["selected", "all"] as const).map(scope => ({ slug, attachment, part, side, scope })))))))(
  "returns $attachment $slug to the same position after repeated $side $part edits ($scope)", ({ slug, attachment, part, side, scope }) => {
    let scene = structuredClone(blankWorkshopScene);
    const weight = { ...createStudioObject(slug, "00000000-0000-4000-8000-000000000001", 0), attachment };
    scene.studio!.objects = [{ ...weight, ...automaticWeightTransform(identityTransform, weight, attachment, scene, 0) }];
    const edit = (value: number) => {
      const angles = sampleHeldWeightPose(scene, 1600)[`${side}-${part}`] ?? { x: 0, y: 0, z: 0 };
      scene = editHeldWeightPose(scene, 1, scope, jointEditChanges(`${side}-${part}`, { ...angles, x: value }, attachment === "both"), attachment === "both" && slug === "dumbbell" ? undefined : side, "x");
    };
    edit(30);
    const first = structuredClone(scene);
    for (const value of [90, 30, 90, 30]) edit(value);
    scene = workshopSceneSchema.parse(JSON.parse(JSON.stringify(scene)));
    for (let step = 0; step <= 16; step++) {
      const time = scene.durationMs * step / 16;
      const before = resolveStudioObject(first, first.studio!.objects[0], time);
      const after = resolveStudioObject(scene, scene.studio!.objects[0], time);
      for (const axis of ["x", "y", "z"] as const) expect(after[axis], `${axis} at ${time}ms`).toBeCloseTo(before[axis], 2);
    }
    const reset = editHeldWeightPose(scene, 1, "selected", jointEditChanges(`${side}-${part}`, { x: 0, y: 0, z: 0 }, attachment === "both"), attachment === "both" && slug === "dumbbell" ? undefined : side);
    expect(reset.keyframes[1].poses[`${side}-${part}`]).toEqual({ x: 0, y: 0, z: 0 });
  },
);
