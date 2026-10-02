import { describe, expect, it } from "vitest";
import { Group, Quaternion, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { studioLayoutSchema } from "./scene-schema";
import { createStudioObject, studioPointToWorld } from "./studio";
import { alignedCableTransform, constrainFrontalPose, resolveStudioObject, setCableAttachment, setFrontalPlane } from "./studio-constraints";
import { applyStudioSeating } from "./studio-seat";
import { blankWorkshopScene, identityTransform, type WorkshopScene } from "./workshop";

const cable = createStudioObject("cable-machine", "00000000-0000-4000-8000-000000000001", 0);
const bench = createStudioObject("bench", "00000000-0000-4000-8000-000000000002", 1);

describe("studio alignment and constraints", () => {
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
