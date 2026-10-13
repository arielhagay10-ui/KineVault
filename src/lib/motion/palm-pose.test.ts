import { describe, expect, it } from "vitest";
import { Group, Quaternion, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { automaticWeightTransform } from "./automatic-weight-grip";
import { automaticWristAngles, forearmRotationForScene } from "./equipment-motion";
import { editHeldWeightPose, sampleHeldWeightPose } from "./held-weight-pose";
import { createStudioObject, studioPointToWorld } from "./studio";
import { resolveStudioObject } from "./studio-constraints";
import { studioGripOffset, weightGripPoint } from "./studio-grip";
import { applyStudioSeating } from "./studio-seat";
import { blankWorkshopScene, sampleWorkshopPose } from "./workshop";

describe("seated held-weight palm orientation", () => {
  it("preserves weight-only intermediate arm poses when taking wrist control", () => {
    const scene = structuredClone(blankWorkshopScene);
    const weight = { ...createStudioObject("dumbbell", "weight", 0), attachment: "left" as const };
    for (const frame of scene.keyframes) frame.poses = { "left-elbow": { x: 60, y: 0, z: 0 } };
    scene.studio!.objects = [{ ...weight, frames: [0, 800, 1600, 3200].map(timeMs => {
      const target = structuredClone(scene);
      for (const frame of target.keyframes) frame.poses["left-elbow"] = { x: timeMs === 800 ? 100 : 60, y: 0, z: 0 };
      return { timeMs, ...automaticWeightTransform(target.studio!.body, weight, "left", target, timeMs) };
    }) }];
    const before = structuredClone(scene);
    const saved = JSON.parse(JSON.stringify(editHeldWeightPose(scene, 1, "selected", { "left-wrist": { x: -90, y: 0, z: 0 } }))) as typeof scene;
    expect(scene).toEqual(before);
    expect(saved.keyframes.map(frame => frame.timeMs)).toEqual([0, 800, 1600, 3200]);
    expect(saved.keyframes.find(frame => frame.timeMs === 1600)!.poses["left-wrist"]!.x).toBe(-90);
    expect(saved.keyframes.find(frame => frame.timeMs === 800)!.poses["left-wrist"]).toBeUndefined();
    const rig = createAnatomyRig(new Group());
    try {
      for (const time of [0, 800, 1600, 3200]) {
        const positions = [scene, saved].map(value => {
          poseAnatomyRig(rig, sampleHeldWeightPose(value, time), true, forearmRotationForScene(value));
          return [rig.bones["left-elbow"], rig.handBones.left].map(bone => bone.getWorldPosition(new Vector3()));
        });
        positions[0].forEach((point, index) => expect(point.distanceTo(positions[1][index]), `joint ${index} at ${time}ms`).toBeLessThan(.000001));
      }
      let previousWrist: Vector3 | undefined;
      for (let step = 0; step <= 16; step++) {
        const time = step * 200;
        poseAnatomyRig(rig, sampleHeldWeightPose(saved, time), true, forearmRotationForScene(saved));
        const item = resolveStudioObject(saved, saved.studio!.objects[0], time);
        expect(studioPointToWorld(weightGripPoint(item, "left"), item).distanceTo(rig.handBones.left.localToWorld(studioGripOffset("left")))).toBeLessThan(.000001);
        const wrist = rig.handBones.left.getWorldPosition(new Vector3());
        if (previousWrist) expect(wrist.distanceTo(previousWrist)).toBeLessThan(.16);
        previousWrist = wrist;
      }
    } finally { rig.dispose(); }
  });

  it.each([23, 24])("handles the 24-pose limit atomically with %s existing poses and one weight-only moment", count => {
    const scene = structuredClone(blankWorkshopScene);
    scene.keyframes = Array.from({ length: count }, (_, index) => ({ timeMs: index === count - 1 ? 3200 : index * 100, poses: { "left-elbow": { x: 60, y: 0, z: 0 } } }));
    const weight = { ...createStudioObject("dumbbell", "weight", 0), attachment: "left" as const };
    scene.studio!.objects = [{ ...weight, frames: [0, 850, 3200].map(timeMs => ({ timeMs, ...automaticWeightTransform(scene.studio!.body, weight, "left", scene, timeMs) })) }];
    const before = structuredClone(scene);
    const edit = () => editHeldWeightPose(scene, 1, "selected", { "left-wrist": { x: -90, y: 0, z: 0 } });
    if (count === 24) expect(edit).toThrow(/24 poses/);
    else expect(edit().keyframes).toHaveLength(24);
    expect(scene).toEqual(before);
  });

  it.each([0, 90, 180])("keeps automatic %s degree forearm rotation identical to its authored equivalent", rotation => {
    const rig = createAnatomyRig(new Group());
    try {
      poseAnatomyRig(rig, {}, true, rotation);
      const original = (["left", "right"] as const).map(side => ({ position: rig.handBones[side].getWorldPosition(new Vector3()), rotation: rig.handBones[side].getWorldQuaternion(new Quaternion()) }));
      poseAnatomyRig(rig, { "left-wrist": { x: rotation - 90, y: 0, z: 0 }, "right-wrist": { x: rotation - 90, y: 0, z: 0 } }, true, rotation);
      (["left", "right"] as const).forEach((side, index) => {
        expect(rig.handBones[side].getWorldPosition(new Vector3()).distanceTo(original[index].position)).toBeLessThan(.000001);
        expect(rig.handBones[side].getWorldQuaternion(new Quaternion()).angleTo(original[index].rotation)).toBeLessThan(.000001);
      });
    } finally { rig.dispose(); }
  });
  it.each((["left", "right"] as const).flatMap(side => (["dumbbell", "barbell", "kettlebell"] as const).map(slug => ({ side, slug }))))("reports the actual automatic $side palm orientation while holding a $slug", ({ side, slug }) => {
    const scene = structuredClone(blankWorkshopScene);
    scene.studio!.objects = [{ ...createStudioObject(slug, "weight", 0), attachment: side }];
    const rig = createAnatomyRig(new Group());
    try {
      const pose = sampleWorkshopPose(scene.keyframes, 0);
      poseAnatomyRig(rig, pose, side, forearmRotationForScene(scene));
      const shown = rig.handBones[side].getWorldQuaternion(new Quaternion());
      poseAnatomyRig(rig, { ...pose, [`${side}-wrist`]: automaticWristAngles(scene) }, side, forearmRotationForScene(scene));
      expect(rig.handBones[side].getWorldQuaternion(new Quaternion()).angleTo(shown)).toBeLessThan(.000001);
    } finally { rig.dispose(); }
  });

  it.each(["left", "right"] as const)("preserves the visible %s arm when taking wrist control on an incline bench", side => {
    const scene = structuredClone(blankWorkshopScene);
    const bench = { ...createStudioObject("bench", "bench", 0), benchAngle: 45, x: .3, rotationY: 25 };
    const weight = { ...createStudioObject("dumbbell", "weight", 1), attachment: side };
    scene.studio!.objects = [bench, weight];
    scene.studio!.seating = { benchId: bench.id, facing: "supine" };
    for (const frame of scene.keyframes) frame.poses = { [`${side}-shoulder`]: { x: 10, y: 0, z: 0 }, [`${side}-elbow`]: { x: 60, y: 0, z: 0 } };
    const placed = automaticWeightTransform(scene.studio!.body, weight, side, scene, 0);
    // A weight drag changes the displayed arm without rewriting authored joints.
    scene.studio!.objects[1] = { ...weight, ...placed, x: placed.x + (side === "left" ? .04 : -.04) };
    const next = editHeldWeightPose(scene, 1, "selected", { [`${side}-wrist`]: { x: -90, y: 0, z: 0 } });
    const saved = JSON.parse(JSON.stringify(next)) as typeof next;
    const rig = createAnatomyRig(new Group());
    try {
      for (let step = 0; step <= 16; step++) {
        const time = step * 200;
        const positions = [scene, saved].map(value => {
          const pose = sampleHeldWeightPose(value, time);
          poseAnatomyRig(rig, pose, side, forearmRotationForScene(value));
          applyStudioSeating(rig, value.studio, time, pose);
          const result = [rig.bones[`${side}-elbow`], rig.handBones[side]].map(bone => bone.getWorldPosition(new Vector3()));
          const item = resolveStudioObject(value, value.studio!.objects[1], time);
          expect(studioPointToWorld(weightGripPoint(item, side), item).distanceTo(rig.handBones[side].localToWorld(studioGripOffset(side))), `contact ${value === scene ? "before" : "after"} at ${time}ms`).toBeLessThan(.002);
          return result;
        });
        positions[0].forEach((point, index) => expect(point.distanceTo(positions[1][index]), `joint ${index} at ${time}ms`).toBeLessThan(.000001));
      }
    } finally { rig.dispose(); }
  });
});
