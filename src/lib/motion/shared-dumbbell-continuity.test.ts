import { expect, it } from "vitest";
import { Group, Quaternion, Vector3 } from "three";
import { nearLimitPulloverScene, sharedDumbbellScene } from "../../../tests/helpers/shared-dumbbell";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { automaticWeightTransform, poseArmDrivenWeight, solveDumbbellGrip } from "./automatic-weight-grip";
import { editHeldWeightPose, sampleHeldWeightPose } from "./held-weight-pose";
import { jointEditChanges } from "./joint-edit";
import { studioGripOffset, weightGripPoint } from "./studio-grip";
import { studioPointToWorld } from "./studio";
import { sampleStudioObject } from "./studio";
import { applyStudioSeating } from "./studio-seat";
import { sampleWorkshopPose, type StudioObject, type WorkshopScene } from "./workshop";
import { workshopSceneSchema } from "./scene-schema";

it("keeps a saved near-limit pullover continuous through both end poses", () => {
  let { scene, weight }: { scene: WorkshopScene; weight: StudioObject } = nearLimitPulloverScene();
  scene = workshopSceneSchema.parse(JSON.parse(JSON.stringify(scene)));
  weight = scene.studio!.objects[1];
  const rig = createAnatomyRig(new Group());
  let previous: Quaternion[] | undefined, worst = { angle: 0, time: 0, joint: 0 };
  try {
    for (let frame = 0; frame <= 384; frame++) {
      const time = scene.durationMs * frame / 384, pose = sampleWorkshopPose(scene.keyframes, time);
      poseAnatomyRig(rig, pose, true); applyStudioSeating(rig, scene.studio, time, pose);
      poseArmDrivenWeight(rig, sampleStudioObject(weight, time), pose);
      const joints = [rig.bones["left-shoulder"], rig.bones["left-elbow"], rig.handBones.left, rig.bones["right-shoulder"], rig.bones["right-elbow"], rig.handBones.right].map(bone => bone.getWorldQuaternion(new Quaternion()));
      if (previous) joints.forEach((q, joint) => { const angle = q.angleTo(previous![joint]); if (angle > worst.angle) worst = { angle, time, joint }; });
      previous = joints;
    }
    expect(worst.angle, JSON.stringify(worst)).toBeLessThan(.35);
  } finally { rig.dispose(); }
}, 30_000);

it.each((["weight", "arm", "left-arm", "right-arm"] as const).flatMap(driver => [0, 5, 25, 85, "varying"].map(bend => ({ driver, bend }))))(
  "keeps $driver shared holds continuous after holding with $bend degree elbows", ({ driver, bend }) => {
    let { scene, weight }: { scene: WorkshopScene; weight: StudioObject } = sharedDumbbellScene("pullover", true);
    for (const frame of scene.keyframes) for (const side of ["left", "right"] as const) frame.poses[`${side}-elbow`] = { x: typeof bend === "number" ? bend : frame.timeMs === 1600 ? 85 : 0, y: 0, z: 0 };
    weight.frames = scene.keyframes.map(frame => ({ timeMs: frame.timeMs, ...automaticWeightTransform(scene.studio!.body, weight, "both", scene, frame.timeMs) }));
    if (driver !== "weight") {
      const side = driver === "right-arm" ? "right" : "left", anchor = driver === "arm" ? undefined : side;
      const angles = sampleHeldWeightPose(scene, 0)[`${side}-shoulder`]!;
      scene = editHeldWeightPose(scene, 0, "all", jointEditChanges(`${side}-shoulder`, { ...angles, x: -90 }, true), anchor, "x");
      const finish = sampleHeldWeightPose(scene, 1600)[`${side}-shoulder`]!;
      scene = editHeldWeightPose(scene, 1, "selected", jointEditChanges(`${side}-shoulder`, { ...finish, x: -150 }, true), anchor, "x");
    }
    weight = scene.studio!.objects[1];
    const rig = createAnatomyRig(new Group());
    let previous: Quaternion[] | undefined, worst = { angle: 0, time: 0, joint: 0 };
    try {
      for (let frame = 0; frame <= 256; frame++) {
        const time = scene.durationMs * frame / 256, pose = sampleWorkshopPose(scene.keyframes, time);
        poseAnatomyRig(rig, pose, true); applyStudioSeating(rig, scene.studio, time, pose);
        const item = sampleStudioObject(weight, time);
        const solved = driver === "weight" ? solveDumbbellGrip(rig, item, pose, new Vector3()) : poseArmDrivenWeight(rig, item, pose);
        if (!solved) throw Error("Shared dumbbell fit was not evaluated");
        for (const side of ["left", "right"] as const) {
          const error = rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(studioPointToWorld(weightGripPoint(item, side), solved.transform));
          // A straight following arm can run out of reach; report it without snapping or stretching.
          if (error >= .005) expect(solved.limited, `${side} reach warning at ${time}`).toBe(true);
          if (!solved.limited || driver === `${side}-arm`) expect(error, `${side} contact at ${time}`).toBeLessThan(.005);
        }
        const joints = [rig.bones["left-shoulder"], rig.bones["left-elbow"], rig.handBones.left, rig.bones["right-shoulder"], rig.bones["right-elbow"], rig.handBones.right].map(bone => bone.getWorldQuaternion(new Quaternion()));
        if (previous) joints.forEach((q, joint) => { const angle = q.angleTo(previous![joint]); if (angle > worst.angle) worst = { angle, time, joint }; });
        previous = joints;
      }
      expect(worst.angle, JSON.stringify(worst)).toBeLessThan(.35);
    } finally { rig.dispose(); }
  }, 30_000,
);
