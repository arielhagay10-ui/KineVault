import { describe, expect, it } from "vitest";
import { Group, Quaternion, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { automaticWeightTransform } from "./automatic-weight-grip";
import { editHeldWeightPose } from "./held-weight-pose";
import { studioLayoutSchema } from "./scene-schema";
import { createStudioObject, sampleStudioObject, studioPointToWorld } from "./studio";
import { alignedCableTransform, constrainFrontalPose, materializeArmDrivenWeight, materializeReleasedArmWeights, resolveStudioObject, setCableAttachment, setFrontalPlane } from "./studio-constraints";
import { applyStudioSeating } from "./studio-seat";
import { studioGripOffset, weightGripPoint } from "./studio-grip";
import { blankWorkshopScene, identityTransform, type WorkshopScene } from "./workshop";

const cable = createStudioObject("cable-machine", "00000000-0000-4000-8000-000000000001", 0);
const bench = createStudioObject("bench", "00000000-0000-4000-8000-000000000002", 1);

describe("studio alignment and constraints", () => {
  it.each([false, true])("materializes releases with peer replacement %s while preserving the next scene's contact changes", replacePeer => {
    const scene = structuredClone(blankWorkshopScene);
    scene.keyframes.forEach((frame, index) => { frame.poses = { "left-shoulder": { x: index === 1 ? 80 : 5, y: 0, z: -10 }, "left-elbow": { x: 20, y: 0, z: 0 } }; });
    const weight = { ...createStudioObject("dumbbell", "weight", 0), attachment: "left" as const, poseDriver: "arm" as const, gripOffsets: { left: { x: .01, y: -.02, z: .015 } } };
    const peer = { ...createStudioObject("dumbbell", "peer", 1), attachment: replacePeer ? "left" as const : "none" as const };
    scene.studio!.objects = [weight, { ...peer, attachment: "none" }];
    const next = { ...scene, studio: { ...scene.studio!, objects: [{ ...weight, name: "Released weight", attachment: "none" as const, gripOffsets: undefined, elbowLocks: undefined }, peer] } };
    const before = structuredClone(next), releaseTime = 1250;
    const released = materializeReleasedArmWeights(scene, next, releaseTime);
    expect(next).toEqual(before);
    expect(released.studio!.objects[1]).toBe(peer);
    expect(released.studio!.objects[0]).toMatchObject({ name: "Released weight", attachment: "none", gripOffsets: undefined, elbowLocks: undefined, poseDriver: undefined });
    for (const time of [0, 1600, 3200, releaseTime]) {
      const visible = resolveStudioObject(scene, weight, time), actual = sampleStudioObject(released.studio!.objects[0], time);
      for (const key of Object.keys(identityTransform) as (keyof typeof identityTransform)[]) expect(actual[key]).toBeCloseTo(visible[key], 6);
    }
    expect(materializeReleasedArmWeights(scene, scene, releaseTime)).toBe(scene);
  });
  it("leaves a replacement support unchanged when it reuses a former weight's identity", () => {
    const scene = structuredClone(blankWorkshopScene);
    scene.studio!.objects = [{ ...createStudioObject("dumbbell", "reused", 0), attachment: "left", poseDriver: "arm" }];
    const support = { ...bench, id: "reused" };
    const next = { ...scene, studio: { ...scene.studio!, objects: [support] } };
    expect(materializeReleasedArmWeights(scene, next, 0)).toBe(next);
  });
  it("keeps the scene intact when preserving a release would exceed the saved moment limit", () => {
    const scene = structuredClone(blankWorkshopScene);
    scene.keyframes = Array.from({ length: 24 }, (_, index) => ({ timeMs: index * 100, poses: {} }));
    const weight = { ...createStudioObject("dumbbell", "weight", 0), attachment: "left" as const, poseDriver: "arm" as const };
    scene.studio!.objects = [weight];
    const before = structuredClone(scene);
    expect(() => materializeArmDrivenWeight(scene, weight, 1250)).toThrow("more than 24 weight moments");
    expect(scene).toEqual(before);
  });
  it.each(["dumbbell", "barbell", "kettlebell"] as const)("materializes every arm-driven %s moment and the visible release time before detaching", slug => {
    const scene = structuredClone(blankWorkshopScene);
    const weight = { ...createStudioObject(slug, "weight", 0), attachment: "left" as const, poseDriver: "arm" as const,
      gripOffsets: { left: { x: .01, y: -.02, z: .015 } } };
    scene.keyframes = Array.from({ length: 17 }, (_, step) => ({ timeMs: step * 200, poses: {
      "left-shoulder": { x: 5 + 80 * Math.sin(step / 16 * Math.PI), y: 12, z: -10 }, "left-elbow": { x: 20, y: 0, z: 0 },
    } }));
    scene.studio!.objects = [weight];
    const before = structuredClone(scene), releaseTime = 1250;
    const materialized = materializeArmDrivenWeight(scene, weight, releaseTime);
    expect(scene).toEqual(before);
    const released = { ...materialized, attachment: "none" as const, poseDriver: undefined };
    for (const time of [...scene.keyframes.map(frame => frame.timeMs), releaseTime]) {
      const visible = resolveStudioObject(scene, weight, time), sampled = sampleStudioObject(released, time);
      expect(studioPointToWorld(weightGripPoint(weight, "left"), sampled).distanceTo(studioPointToWorld(weightGripPoint(weight, "left"), visible))).toBeLessThan(.000001);
      expect(sampled.rotationX).toBeCloseTo(visible.rotationX, 6);
      expect(sampled.rotationY).toBeCloseTo(visible.rotationY, 6);
      expect(sampled.rotationZ).toBeCloseTo(visible.rotationZ, 6);
    }
    expect(materialized.gripOffsets).toEqual(weight.gripOffsets);
    expect(materialized.attachment).toBe("left");
    expect(materialized.poseDriver).toBe("arm");
    for (const item of [bench, cable, { ...weight, poseDriver: "weight" as const }, { ...weight, attachment: "none" as const }, { ...weight, elbowLocks: { left: { x: 0, y: 1, z: 0 } } }]) {
      expect(materializeArmDrivenWeight(scene, item, releaseTime)).toBe(item);
    }
  });
  it.each([false, true])("resolves the visible palm after a same-value joint edit with frontal plane %s", frontalPlane => {
    const scene = structuredClone(blankWorkshopScene);
    const shoulder = { x: 15, y: 12, z: -20 }, elbow = { x: 35, y: 0, z: 0 };
    scene.keyframes.forEach(frame => { frame.poses = { "left-shoulder": shoulder, "left-elbow": elbow }; });
    scene.studio!.frontalPlane = frontalPlane;
    const weight = { ...createStudioObject("dumbbell", "weight", 0), attachment: "left" as const, gripOffsets: { left: { x: .01, y: -.02, z: .015 } } };
    const targetScene = structuredClone(scene);
    targetScene.keyframes.forEach(frame => { frame.poses["left-elbow"] = { x: 85, y: 0, z: 0 }; });
    scene.studio!.objects = [{ ...weight, ...automaticWeightTransform(identityTransform, weight, "left", targetScene, 0) }];
    const next = editHeldWeightPose(scene, 1, "selected", { "left-shoulder": shoulder });
    const saved = JSON.parse(JSON.stringify(next)) as WorkshopScene;
    const rig = createAnatomyRig(new Group());
    try {
      const visible = { "left-shoulder": frontalPlane ? { x: 0, y: 0, z: -20 } : shoulder, "left-elbow": elbow };
      poseAnatomyRig(rig, visible, "left");
      const palm = rig.handBones.left.localToWorld(studioGripOffset("left"));
      for (let step = 0; step <= 16; step++) {
        const resolved = resolveStudioObject(saved, saved.studio!.objects[0], step * 200);
        expect(studioPointToWorld(weightGripPoint(resolved, "left"), resolved).distanceTo(palm)).toBeLessThan(.000001);
        expect(resolved.attachment).toBe("left");
        expect(resolved.poseDriver).toBe("arm");
        expect(resolved.gripOffsets).toEqual(weight.gripOffsets);
      }
    } finally { rig.dispose(); }
  });
  it("remembers upper-arm placement through attachment changes and JSON saves", () => {
    const cuff = { ...cable, cableAttachment: "cuff" as const, cuffPosition: "upper-arm" as const, attachment: "left" as const };
    const rope = setCableAttachment(cuff, "rope");
    const saved = studioLayoutSchema.parse(JSON.parse(JSON.stringify({ body: identityTransform, objects: [rope] })));
    expect(setCableAttachment(saved.objects[0], "cuff").cuffPosition).toBe("upper-arm");
    expect(setCableAttachment({ ...rope, attachment: "both" }, "cuff").attachment).toBe("left");
  });

  it("locks both shoulders across every frame without losing abduction or elbow bends", () => {
    const scene: WorkshopScene = { ...blankWorkshopScene, keyframes: [0, 1600, 3200].map(timeMs => ({ timeMs, poses: {
      "left-shoulder": { x: 20, y: 30, z: -timeMs / 40 },
      "right-shoulder": { x: -10, y: -20, z: timeMs / 40 },
      "left-elbow": { x: 45, y: 0, z: 0 },
    } })) };
    const locked = setFrontalPlane(scene, true);
    expect(locked.studio?.frontalPlane).toBe(true);
    for (const [index, frame] of locked.keyframes.entries()) {
      expect(frame.poses["left-shoulder"]).toEqual({ x: 0, y: 0, z: -frame.timeMs / 40 });
      expect(frame.poses["right-shoulder"]).toEqual({ x: 0, y: 0, z: frame.timeMs / 40 });
      expect(frame.poses["left-elbow"]).toEqual(scene.keyframes[index].poses["left-elbow"]);
    }
    expect(constrainFrontalPose(scene.keyframes[1].poses, true)).toEqual(locked.keyframes[1].poses);
    expect(constrainFrontalPose(scene.keyframes[1].poses, false)).toBe(scene.keyframes[1].poses);
    expect(setFrontalPlane(locked, false).studio?.frontalPlane).toBe(false);
    expect(scene.keyframes[0].poses["left-shoulder"]?.x).toBe(20);
  });

  it("keeps the pulley beside either shoulder through moved, rotated and animated seating", () => {
    const rig = createAnatomyRig(new Group());
    const body = new Group(); body.add(rig.root);
    try {
      for (const side of ["left", "right"] as const) for (const facing of ["front", "left", "right", "back"] as const) {
        const movingBench = { ...bench, x: 0.4, z: -0.3, rotationY: 35, scale: 1.2,
          frames: [{ ...identityTransform, timeMs: 0 }, { ...identityTransform, timeMs: 3200, x: 2, y: 0.2, z: -1, rotationY: 80, scale: 1.2 }] };
        const aligned = { ...cable, shoulderAlignment: side, rotationX: 20, rotationY: -30, rotationZ: 10 };
        const scene: WorkshopScene = { ...blankWorkshopScene, studio: { body: identityTransform, objects: [movingBench, aligned], seating: { benchId: bench.id, facing } } };
        for (const timeMs of [0, 800, 1600, 2400, 3200]) {
          poseAnatomyRig(rig, {}); applyStudioSeating(rig, scene.studio, timeMs, {});
          const transform = alignedCableTransform(rig, aligned);
          const shoulder = rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3());
          const rotation = rig.bones[`${side}-shoulder`].parent!.getWorldQuaternion(new Quaternion());
          const outward = new Vector3(side === "left" ? 1 : -1, 0, 0).applyQuaternion(rotation).setY(0).normalize();
          const expected = shoulder.clone().add(outward);
          const pulley = studioPointToWorld({ x: 0, y: aligned.pulleyHeight, z: 0.2 }, transform);
          expect(pulley.x).toBeCloseTo(expected.x, 6);
          expect(pulley.z).toBeCloseTo(expected.z, 6);
          expect(transform.y).toBe(aligned.y);
          expect(resolveStudioObject(scene, aligned, timeMs)).toMatchObject(transform);
        }
      }
    } finally { rig.dispose(); }
  });

  it("round trips locks and alignment and rejects unsupported values and equipment", () => {
    const studio = { body: identityTransform, frontalPlane: true, objects: [{ ...cable, shoulderAlignment: "left" }] };
    expect(studioLayoutSchema.parse(JSON.parse(JSON.stringify(studio)))).toEqual(studio);
    for (const invalid of [
      { ...studio, frontalPlane: "yes" },
      { ...studio, objects: [{ ...cable, shoulderAlignment: "up" }] },
      { ...studio, objects: [{ ...bench, shoulderAlignment: "left" }] },
      { ...studio, objects: [{ ...bench, cuffPosition: "upper-arm" }] },
    ]) expect(studioLayoutSchema.safeParse(invalid).success).toBe(false);
  });
});
