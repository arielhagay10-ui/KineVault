import { describe, expect, it } from "vitest";
import { Euler, Group, Quaternion, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig, plantAnatomyFeet } from "./anatomy";
import { automaticWeightTransform, poseArmDrivenWeight, solveDumbbellGrip } from "./automatic-weight-grip";
import { editHeldWeightPose, sampleHeldWeightPose } from "./held-weight-pose";
import { applyStudioSeating } from "./studio-seat";
import { createStudioObject, sampleStudioObject, studioPointToWorld } from "./studio";
import { studioGripOffset, weightGripPoint } from "./studio-grip";
import { blankWorkshopScene, identityTransform, sampleWorkshopPose, type RigPose, type WorkshopScene } from "./workshop";
import { workshopSceneSchema } from "./scene-schema";
import { resolveStudioObject } from "./studio-constraints";
import { jointEditChanges } from "./joint-edit";

describe("two-handed dumbbell head support", () => {
  it.each([60, 80])("keeps Both control balanced when the left elbow already equals %s degrees", rightBend => {
    let scene = structuredClone(blankWorkshopScene);
    for (const frame of scene.keyframes) frame.poses = {
      "left-elbow": { x: 60, y: 0, z: 0 }, "right-elbow": { x: rightBend, y: 0, z: 0 },
    };
    const weight = { ...createStudioObject("dumbbell", "00000000-0000-4000-8000-000000000002", 0), attachment: "both" as const };
    scene.studio!.objects = [{ ...weight, ...automaticWeightTransform(identityTransform, weight, "both", scene, 0) }];
    scene = editHeldWeightPose(scene, 0, "selected", jointEditChanges("left-elbow", { x: 60, y: 0, z: 0 }, true), "left");
    scene = editHeldWeightPose(scene, 0, "selected", jointEditChanges("left-elbow", { x: 60, y: 0, z: 0 }, true));
    expect(scene.studio!.objects[0].poseDriver).toBe("arm");
    const displayed = sampleHeldWeightPose(scene, 0);
    expect(displayed["left-elbow"]!.x).toBeCloseTo(60, 1);
    expect(displayed["right-elbow"]!.x).toBeCloseTo(60, 1);
  });
  it.each(["left", "right"] as const)("keeps a shared dumbbell centered while bending both elbows from the %s control on a flat bench", selectedSide => {
    let scene = structuredClone(blankWorkshopScene);
    const bench = { ...createStudioObject("bench", "00000000-0000-4000-8000-000000000001", 0), ...identityTransform, benchAngle: 0 };
    const weight = { ...createStudioObject("dumbbell", "00000000-0000-4000-8000-000000000002", 0), attachment: "both" as const };
    scene.studio = { body: identityTransform, objects: [bench, weight], seating: { benchId: bench.id, facing: "supine" } };
    scene.keyframes = scene.keyframes.map(frame => ({ ...frame, poses: {
      "left-shoulder": { x: -110, y: 0, z: 0 }, "right-shoulder": { x: -110, y: 0, z: 0 },
      "left-elbow": { x: 60, y: 0, z: 0 }, "right-elbow": { x: 60, y: 0, z: 0 },
    } }));
    Object.assign(weight, automaticWeightTransform(identityTransform, weight, "both", scene, 0));
    const centerX = weight.x;
    const rig = createAnatomyRig(new Group());
    try {
      for (let step = 0; step <= 16; step++) {
        const bend = 30 + step * 5;
        const angles = sampleHeldWeightPose(scene, 0)[`${selectedSide}-elbow`]!;
        scene = editHeldWeightPose(scene, 0, "selected", jointEditChanges(`${selectedSide}-elbow`, { ...angles, x: bend }, true));
        const pose = sampleWorkshopPose(scene.keyframes, 0);
        poseAnatomyRig(rig, pose, true); applyStudioSeating(rig, scene.studio, 0, pose);
        const item = sampleStudioObject(scene.studio!.objects[1], 0);
        const solved = poseArmDrivenWeight(rig, item, pose);
        expect(solved.transform.x, `sideways drift at ${bend} degrees`).toBeCloseTo(centerX, 2);
        expect(sampleHeldWeightPose(scene, 0)["left-elbow"]!.x).toBeCloseTo(bend, 1);
        for (const side of ["left", "right"] as const) {
          expect(rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(studioPointToWorld(weightGripPoint(item, side), solved.transform)), `${side} contact at ${bend}`).toBeLessThan(.005);
        }
      }
      scene = workshopSceneSchema.parse(JSON.parse(JSON.stringify(scene)));
      for (let step = 0; step <= 16; step++) {
        const time = scene.durationMs * step / 16, pose = sampleWorkshopPose(scene.keyframes, time);
        poseAnatomyRig(rig, pose, true); applyStudioSeating(rig, scene.studio, time, pose);
        const item = sampleStudioObject(scene.studio!.objects[1], time);
        const solved = poseArmDrivenWeight(rig, item, pose);
        expect(solved.transform.x).toBeCloseTo(centerX, 2);
        for (const side of ["left", "right"] as const) {
          expect(rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(studioPointToWorld(weightGripPoint(item, side), solved.transform))).toBeLessThan(.005);
        }
      }
    } finally { rig.dispose(); }
  });
  it("keeps contact and supporting palms through a saved shoulder-and-elbow movement", () => {
    let scene = structuredClone(blankWorkshopScene);
    scene.keyframes = [0, 1600, 3200].map(timeMs => ({ timeMs, poses: {} }));
    const weight = { ...createStudioObject("dumbbell", "00000000-0000-4000-8000-000000000001", 0), attachment: "both" as const };
    weight.frames = scene.keyframes.map(frame => ({ timeMs: frame.timeMs, ...automaticWeightTransform(identityTransform, weight, "both", scene, frame.timeMs) }));
    scene.studio!.objects = [weight];
    for (const [index, shoulder, elbow] of [[0, -87, 44], [1, -146, 85], [2, -87, 44]]) {
      for (const [part, value] of [["shoulder", shoulder], ["elbow", elbow]] as const) {
        const current = sampleHeldWeightPose(scene, scene.keyframes[index].timeMs)[`left-${part}`]!;
        scene = editHeldWeightPose(scene, index, "selected", jointEditChanges(`left-${part}`, { ...current, x: value }, true), "left");
      }
    }
    scene = workshopSceneSchema.parse(JSON.parse(JSON.stringify(scene)));
    const rig = createAnatomyRig(new Group());
    let minimumPalmNormal = 1;
    try {
      for (let step = 0; step <= 32; step++) {
        const time = step * 100, pose = sampleWorkshopPose(scene.keyframes, time);
        poseAnatomyRig(rig, pose, true);
        const item = sampleStudioObject(scene.studio!.objects[0], time);
        const solved = poseArmDrivenWeight(rig, item, pose);
        expect(solved.limited, `contact at ${time}`).toBe(false);
        for (const side of ["left", "right"] as const) {
          expect(rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(studioPointToWorld(weightGripPoint(item, side), solved.transform))).toBeLessThan(.005);
          minimumPalmNormal = Math.min(minimumPalmNormal, new Vector3(0, 0, 1).applyQuaternion(rig.handBones[side].getWorldQuaternion(new Quaternion())).y);
        }
      }
      // The cupped hand can lean against the head's edge between authored
      // wrist poses, but must stay upward within 60 degrees and keep contact.
      expect(minimumPalmNormal).toBeGreaterThan(.5);
    } finally { rig.dispose(); }
  });

  it.each(["left", "right"] as const)("keeps the supporting %s palm beneath the head while editing shoulder and elbow bends", side => {
    let scene = structuredClone(blankWorkshopScene);
    scene.keyframes = scene.keyframes.map(frame => ({ ...frame, poses: {} }));
    const weight = { ...createStudioObject("dumbbell", "weight", 0), attachment: "both" as const };
    Object.assign(weight, automaticWeightTransform(identityTransform, weight, "both", scene, 0));
    scene.studio!.objects = [weight];
    const rig = createAnatomyRig(new Group());
    try {
      for (const [part, value] of [["shoulder", -87], ["elbow", 44], ["shoulder", -146], ["elbow", 85]] as const) {
        const displayed = sampleHeldWeightPose(scene, 0);
        scene = editHeldWeightPose(scene, 0, "selected", jointEditChanges(`${side}-${part}`, { ...displayed[`${side}-${part}`]!, x: value }, true), side);
        const pose = sampleWorkshopPose(scene.keyframes, 0);
        poseAnatomyRig(rig, pose, true);
        const solved = poseArmDrivenWeight(rig, scene.studio!.objects[0], pose);
        expect(solved.limited, JSON.stringify({ side, part, value, pose, errors: ["left", "right"].map(value => {
          const hand = value as "left" | "right";
          return { hand, error: rig.handBones[hand].localToWorld(studioGripOffset(hand)).distanceTo(studioPointToWorld(weightGripPoint(weight, hand), solved.transform)),
            elbow: rig.bones.torso.worldToLocal(rig.bones[`${hand}-elbow`].getWorldPosition(new Vector3())).toArray() };
        }) })).toBe(false);
        expect(rig.bones[`${side}-${part}`].rotation.x * 180 / Math.PI * (part === "elbow" ? -1 : 1)).toBeCloseTo(value, 1);
        const normal = new Vector3(0, 0, 1).applyQuaternion(rig.handBones[side].getWorldQuaternion(new Quaternion()));
        // The cupped palm may lean against the round edge while supporting it.
        expect(normal.y, `${part} ${value}`).toBeGreaterThan(.5);
      }
    } finally { rig.dispose(); }
  });

  it("starts a new two-hand hold in front of the chest with bent elbows", () => {
    const scene = structuredClone(blankWorkshopScene);
    scene.keyframes = scene.keyframes.map(frame => ({ ...frame, poses: {} }));
    const weight = { ...createStudioObject("dumbbell", "weight", 0), attachment: "both" as const };
    Object.assign(weight, automaticWeightTransform(identityTransform, weight, "both", scene, 0));
    scene.studio!.objects = [weight];
    const rig = createAnatomyRig(new Group());
    try {
      poseAnatomyRig(rig, {}, true);
      solveDumbbellGrip(rig, weight, {}, new Vector3());
      for (const side of ["left", "right"] as const) {
        const palm = rig.handBones[side].localToWorld(studioGripOffset(side));
        const hip = rig.bones[`${side}-hip`].getWorldPosition(new Vector3());
        expect(palm.y - hip.y).toBeGreaterThan(.35);
        expect(-rig.bones[`${side}-elbow`].rotation.x * 180 / Math.PI).toBeGreaterThan(55);
      }
    } finally { rig.dispose(); }
  });

  it.each(["left", "right"] as const)("honors each plus and minus step while the %s arm controls a shared weight", side => {
    let scene = structuredClone(blankWorkshopScene);
    scene.keyframes = scene.keyframes.map(frame => ({ ...frame, poses: {} }));
    const weight = { ...createStudioObject("dumbbell", "weight", 0), attachment: "both" as const };
    Object.assign(weight, automaticWeightTransform(identityTransform, weight, "both", scene, 0));
    scene.studio!.objects = [weight];
    for (const part of ["shoulder", "elbow"] as const) for (const delta of [1, 1, -1, -1, 1, -1]) {
      const displayed = sampleHeldWeightPose(scene, 0);
      const before = displayed[`${side}-${part}`]!;
      const target = { ...before, x: before.x + delta };
      scene = editHeldWeightPose(scene, 0, "selected", jointEditChanges(`${side}-${part}`, target, true), side);
      const after = sampleHeldWeightPose(scene, 0)[`${side}-${part}`]!;
      expect((after.x - before.x) * delta, `${part}: ${before.x} -> ${after.x}, requested ${target.x}`).toBeGreaterThan(.5);
      expect(after.x).toBeCloseTo(target.x, 1);
    }
  });

  it.each(["left", "right"] as const)("changes the %s wrist without jumping or losing the other hand", side => {
    let scene = structuredClone(blankWorkshopScene);
    const weight = { ...createStudioObject("dumbbell", "00000000-0000-4000-8000-000000000001", 0), attachment: "both" as const };
    scene.keyframes = [0, 1600, 3200].map(timeMs => ({ timeMs, poses: {
      "left-elbow": { x: 85, y: 0, z: 0 }, "right-elbow": { x: 85, y: 0, z: 0 },
    } }));
    weight.frames = scene.keyframes.map(({ timeMs }) => ({ timeMs, ...automaticWeightTransform(identityTransform, weight, "both", scene, timeMs) }));
    scene.studio!.objects = [weight];
    scene = editHeldWeightPose(scene, 1, "selected", { "left-elbow": { x: 90, y: 0, z: 0 } });
    const wrist = sampleHeldWeightPose(scene, 1600)[`${side}-wrist`]!;
    const before = resolveStudioObject(scene, scene.studio!.objects[0], 1600);
    const next = editHeldWeightPose(scene, 1, "selected", { [`${side}-wrist`]: { ...wrist, x: wrist.x + 1 } });
    const after = resolveStudioObject(next, next.studio!.objects[0], 1600);
    expect(new Vector3(after.x, after.y, after.z).distanceTo(new Vector3(before.x, before.y, before.z))).toBeLessThan(.015);
  });

  it.each(["left", "right"] as const)("keeps both contacts after repeated %s arm edits, save and reload", side => {
    let scene = structuredClone(blankWorkshopScene);
    const weight = { ...createStudioObject("dumbbell", "00000000-0000-4000-8000-000000000001", 0), attachment: "both" as const };
    scene.keyframes = [0, 1600, 3200].map(timeMs => ({ timeMs, poses: {
      "left-elbow": { x: 85, y: 0, z: 0 }, "right-elbow": { x: 85, y: 0, z: 0 },
    } }));
    weight.frames = scene.keyframes.map(({ timeMs }) => ({ timeMs, ...automaticWeightTransform(identityTransform, weight, "both", scene, timeMs) }));
    scene.studio!.objects = [weight];
    for (const angle of [95, 105, 100]) scene = editHeldWeightPose(scene, 1, "selected", { [`${side}-elbow`]: { x: angle, y: 0, z: 0 } });
    scene = workshopSceneSchema.parse(JSON.parse(JSON.stringify(scene)));
    expect(scene.studio!.objects[0].poseDriver).toBe(`${side}-arm`);
    const rig = createAnatomyRig(new Group());
    let previous: Vector3 | undefined;
    const previousShoulders: Partial<Record<"left" | "right", Quaternion>> = {};
    const previousHands: Partial<Record<"left" | "right", Quaternion>> = {};
    try {
      for (let step = 0; step <= 128; step++) {
        const timeMs = step * 25, pose = sampleWorkshopPose(scene.keyframes, timeMs);
        poseAnatomyRig(rig, pose, true);
        const item = sampleStudioObject(scene.studio!.objects[0], timeMs);
        const solved = poseArmDrivenWeight(rig, item, pose);
        expect(solved.limited, JSON.stringify({ side, step, transform: solved.transform, hands: ["left", "right"].map(hand => {
          const key = hand as "left" | "right";
          return { hand, error: rig.handBones[key].localToWorld(studioGripOffset(key)).distanceTo(studioPointToWorld(weightGripPoint(item, key), solved.transform)), wrist: rig.handBones[key].rotation.toArray() };
        }) })).toBe(false);
        for (const hand of ["left", "right"] as const) {
          expect(rig.handBones[hand].localToWorld(studioGripOffset(hand)).distanceTo(studioPointToWorld(weightGripPoint(item, hand), solved.transform))).toBeLessThan(.005);
          const shoulder = rig.bones[`${hand}-shoulder`].quaternion.clone();
          const wrist = rig.handBones[hand].getWorldQuaternion(new Quaternion());
          if (previousShoulders[hand]) expect(shoulder.angleTo(previousShoulders[hand]!), `${hand} shoulder jump at ${step}`).toBeLessThan(.12);
          if (previousHands[hand]) expect(wrist.angleTo(previousHands[hand]!), `${hand} palm jump at ${step}`).toBeLessThan(.15);
          previousShoulders[hand] = shoulder; previousHands[hand] = wrist;
        }
        const center = new Vector3(solved.transform.x, solved.transform.y, solved.transform.z);
        if (previous) expect(center.distanceTo(previous), `jump at ${step}`).toBeLessThan(.08);
        previous = center;
        const displayed = sampleHeldWeightPose(scene, timeMs);
        for (const hand of ["left", "right"] as const) expect(displayed[`${hand}-wrist`]).toBeDefined();
      }
    } finally { rig.dispose(); }
  });

  it("places distinct palms beneath one head instead of overlapping on the shaft", () => {
    const weight = { ...createStudioObject("dumbbell", "weight", 0), attachment: "both" as const };
    const left = weightGripPoint(weight, "left"), right = weightGripPoint(weight, "right");
    expect(left.distanceTo(right)).toBeGreaterThan(.09);
    for (const point of [left, right]) {
      expect(point.x).toBeCloseTo(.1, 2);
      expect(Math.hypot(point.y - .2, point.z)).toBeLessThan(.1);
    }
  });

  it.each(["goblet", "pullover"] as const)("retains both %s contacts through 17 positions with bounded wrists", variant => {
    const rig = createAnatomyRig(new Group());
    const bench = { ...createStudioObject("bench", "bench", 0), ...identityTransform, benchAngle: 0 };
    const weight = { ...createStudioObject("dumbbell", "weight", 0), attachment: "both" as const };
    try {
      for (let step = 0; step <= 16; step++) {
        const progress = Math.sin(step / 16 * Math.PI);
        const pose: RigPose = variant === "goblet" ? {
          torso: { x: 35 * progress, y: 0, z: 0 },
          "left-elbow": { x: 85, y: 0, z: 0 }, "right-elbow": { x: 85, y: 0, z: 0 },
          "left-hip": { x: 60 * progress, y: 0, z: 0 }, "right-hip": { x: 60 * progress, y: 0, z: 0 },
          "left-knee": { x: -90 * progress, y: 0, z: 0 }, "right-knee": { x: -90 * progress, y: 0, z: 0 },
        } : {
          "left-shoulder": { x: -90 - 60 * progress, y: 0, z: 0 }, "right-shoulder": { x: -90 - 60 * progress, y: 0, z: 0 },
          "left-elbow": { x: 25, y: 0, z: 0 }, "right-elbow": { x: 25, y: 0, z: 0 },
        };
        const scene: WorkshopScene = { ...blankWorkshopScene, motionStyle: variant === "goblet" ? "squat" : "free",
          studio: { body: identityTransform, objects: variant === "goblet" ? [weight] : [bench, weight],
            ...(variant === "pullover" ? { seating: { benchId: bench.id, facing: "supine" as const } } : {}) },
          keyframes: [0, 3200].map(timeMs => ({ timeMs, poses: pose })) };
        poseAnatomyRig(rig, pose, true); plantAnatomyFeet(rig, scene.motionStyle, pose); applyStudioSeating(rig, scene.studio, 0, pose);
        const placed = { ...weight, ...automaticWeightTransform(identityTransform, weight, "both", scene, 0) };
        const solved = solveDumbbellGrip(rig, placed, pose, new Vector3());
        expect(solved?.limited, JSON.stringify({ variant, step, placed, hands: ["left", "right"].map(value => {
          const side = value as "left" | "right";
          return { side, error: rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(studioPointToWorld(weightGripPoint(placed, side), placed)),
            normal: new Vector3(0, 0, 1).applyQuaternion(rig.handBones[side].getWorldQuaternion(new Quaternion())).toArray(),
            shoulder: rig.bones[`${side}-shoulder`].rotation.toArray(), wrist: rig.handBones[side].rotation.toArray() };
        }) })).toBe(false);
        const palms = [];
        for (const side of ["left", "right"] as const) {
          const palm = rig.handBones[side].localToWorld(studioGripOffset(side));
          expect(palm.distanceTo(studioPointToWorld(weightGripPoint(placed, side), placed)), `${side} ${step}`).toBeLessThan(.005);
          expect(new Vector3(0, 0, 1).applyQuaternion(rig.handBones[side].getWorldQuaternion(new Quaternion())).y, `${side} supporting palm ${step}`).toBeGreaterThan(.8);
          expect(Math.abs(rig.handBones[side].rotation.x * 180 / Math.PI)).toBeLessThanOrEqual(70.01);
          expect(Math.abs(rig.handBones[side].rotation.z * 180 / Math.PI)).toBeLessThanOrEqual(30.01);
          palms.push(palm);
        }
        expect(palms[0].distanceTo(palms[1])).toBeGreaterThan(.09);
        // The head stays above the handle in world gravity, including on a flat bench.
        const shaft = new Vector3(1, 0, 0).applyQuaternion(new Quaternion().setFromEuler(new Euler(
          placed.rotationX * Math.PI / 180, placed.rotationY * Math.PI / 180, placed.rotationZ * Math.PI / 180)));
        expect(shaft.y).toBeGreaterThan(.99);
      }
    } finally { rig.dispose(); }
  });
});
