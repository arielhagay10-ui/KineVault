import { describe, expect, it, vi } from "vitest";
import { Euler, Group, Quaternion, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { createStudioObject, studioPointToWorld } from "./studio";
import { automaticWeightTransform, solveDumbbellGrip } from "./automatic-weight-grip";
import { equipmentLabel } from "./equipment-label";
import { applyStudioSeating } from "./studio-seat";
import { studioGripOffset, weightGripPoint } from "./studio-grip";
import { blankWorkshopScene, identityTransform, type WorkshopScene } from "./workshop";
import { solveLimbPose } from "./limb-pose";

describe("automatic weight placement", () => {
  it.each(["left", "right", "both"] as const)("fits a newly attached kettlebell to the %s grip", attachment => {
    const scene = structuredClone(blankWorkshopScene);
    const weight = { ...createStudioObject("kettlebell", "bell", 0), attachment };
    const placed = { ...weight, ...automaticWeightTransform(identityTransform, weight, attachment, scene, 0) };
    const rig = createAnatomyRig(new Group());
    try {
      const pose = scene.keyframes[0].poses;
      poseAnatomyRig(rig, pose, attachment === "both" ? true : attachment);
      for (const side of attachment === "both" ? ["left", "right"] as const : [attachment]) {
        const target = studioPointToWorld(weightGripPoint(placed, side), placed);
        const solved = solveDumbbellGrip(rig, { ...placed, attachment: side }, pose, target);
        expect(solved?.limited, JSON.stringify({ side, placed, target, palm: rig.handBones[side].localToWorld(studioGripOffset(side)), shoulder: rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3()) })).toBe(false);
        expect(rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(target)).toBeLessThan(.005);
      }
    } finally { rig.dispose(); }
  });
  it("builds a calculation-only rig without invalid scene objects", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const rig = createAnatomyRig(new Group());
    try { expect(errors.mock.calls).toEqual([]); }
    finally { rig.dispose(); errors.mockRestore(); }
  });
  it("distinguishes saved duplicate equipment by identity without changing its names", () => {
    const weights = [createStudioObject("dumbbell", "a", 0), createStudioObject("bench", "b", 1), createStudioObject("dumbbell", "c", 2)];
    const saved = JSON.parse(JSON.stringify(weights));
    expect(equipmentLabel(saved, saved[0])).toBe("Dumbbell 1");
    expect(equipmentLabel(saved, saved[2])).toBe("Dumbbell 2");
    expect(equipmentLabel(saved, saved[1])).toBe("Adjustable bench");
    expect(weights.map(item => item.name)).toEqual(["Dumbbell", "Adjustable bench", "Dumbbell"]);
  });
  it("keeps both dumbbells in their palms at reach limits and on a seated curl path", () => {
    const rig = createAnatomyRig(new Group());
    const bench = { ...createStudioObject("bench", "bench", 0), x: .4, benchAngle: 65 };
    const scene: WorkshopScene = { ...structuredClone(blankWorkshopScene), studio: { body: identityTransform, objects: [bench], seating: { benchId: bench.id, facing: "supine" } } };
    try {
      for (let step = 0; step <= 16; step++) {
        const pose = { "left-shoulder": { x: 0, y: 12, z: 0 }, "right-shoulder": { x: 0, y: -12, z: 0 } };
        poseAnatomyRig(rig, pose, true); applyStudioSeating(rig, scene.studio, 0, pose);
        for (const side of ["left", "right"] as const) {
          const weight = { ...createStudioObject("dumbbell", side, 1), attachment: side };
          const shoulder = rig.bones[`${side}-shoulder`], elbow = rig.bones[`${side}-elbow`];
          const upperLength = shoulder.getWorldPosition(new Vector3()).distanceTo(elbow.getWorldPosition(new Vector3()));
          const lowerLength = elbow.getWorldPosition(new Vector3()).distanceTo(rig.handBones[side].getWorldPosition(new Vector3()));
          const target = step === 16 ? new Vector3(10, 10, 10) : rig.handBones[side].localToWorld(studioGripOffset(side)).add(new Vector3(0, .25 * Math.sin(step / 16 * Math.PI), .1));
          const result = solveDumbbellGrip(rig, weight, pose, target)!;
          const palm = rig.handBones[side].localToWorld(studioGripOffset(side));
          expect(studioPointToWorld(weightGripPoint(weight, side), result.transform).distanceTo(palm)).toBeLessThan(.00001);
          expect(shoulder.rotation.y * 180 / Math.PI).toBeCloseTo(side === "left" ? 12 : -12, 6);
          expect(shoulder.getWorldPosition(new Vector3()).distanceTo(elbow.getWorldPosition(new Vector3()))).toBeCloseTo(upperLength, 6);
          expect(elbow.getWorldPosition(new Vector3()).distanceTo(rig.handBones[side].getWorldPosition(new Vector3()))).toBeCloseTo(lowerLength, 6);
          if (step === 16) expect(result.limited).toBe(true);
          // Repeated renders must not accumulate shoulder rotation.
          const rotation = shoulder.quaternion.clone();
          solveDumbbellGrip(rig, weight, pose, target);
          expect(shoulder.quaternion.angleTo(rotation)).toBeLessThan(.00001);
        }
      }
    } finally { rig.dispose(); }
  });
  it("moves the palm contact without spending shoulder twist or stretching the arm", () => {
    const rig = createAnatomyRig(new Group()), reference = createAnatomyRig(new Group());
    try {
      for (const side of ["left", "right"] as const) for (let step = 0; step <= 16; step++) {
        const base = { [`${side}-shoulder`]: { x: 15, y: 12, z: 0 }, [`${side}-elbow`]: { x: 35, y: 0, z: 0 } };
        poseAnatomyRig(reference, { ...base, [`${side}-elbow`]: { x: 35 + step * 3, y: 0, z: 0 } }, side);
        const target = reference.handBones[side].localToWorld(studioGripOffset(side));
        poseAnatomyRig(rig, base, side);
        const solved = solveLimbPose(rig, `${side}-hand`, base, target, false, studioGripOffset(side));
        poseAnatomyRig(rig, { ...base, ...solved.poses }, side);
        expect(rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(target)).toBeLessThan(.002);
        expect(solved.poses[`${side}-shoulder`]!.y).toBe(12);
      }
    } finally { rig.dispose(); reference.dispose(); }
  });
  it.each(["left", "right"] as const)("puts the weight in the posed %s hand on a moved incline bench", side => {
    const bench = { ...createStudioObject("bench", "bench", 0), x: .4, z: -.2, rotationY: 25, benchAngle: 65 };
    const weight = createStudioObject("dumbbell", "weight", 1);
    const rig = createAnatomyRig(new Group());
    const scene: WorkshopScene = { ...structuredClone(blankWorkshopScene), studio: { body: identityTransform, objects: [bench, weight], seating: { benchId: bench.id, facing: "supine" } } };
    try {
      for (let step = 0; step <= 16; step++) {
        const pose = { [`${side}-shoulder`]: { x: -15, y: 12, z: 0 }, [`${side}-elbow`]: { x: 15 + step * 5, y: 0, z: 0 } };
        scene.keyframes = [{ timeMs: 0, poses: pose }, { timeMs: 3200, poses: pose }];
        poseAnatomyRig(rig, pose, side); applyStudioSeating(rig, scene.studio, 0, pose);
        const palm = rig.handBones[side].localToWorld(studioGripOffset(side));
        const rotation = rig.handBones[side].getWorldQuaternion(new Quaternion());
        const transform = automaticWeightTransform(identityTransform, weight, side, scene, 0);
        const contact = studioPointToWorld(weightGripPoint({ ...weight, attachment: side }, side), transform);
        expect(contact.distanceTo(palm), `sample ${step}`).toBeLessThan(.001);
        const actualRotation = new Quaternion().setFromEuler(new Euler(transform.rotationX * Math.PI / 180, transform.rotationY * Math.PI / 180, transform.rotationZ * Math.PI / 180));
        expect(actualRotation.angleTo(rotation)).toBeLessThan(.001);
      }
    } finally { rig.dispose(); }
  });
});
