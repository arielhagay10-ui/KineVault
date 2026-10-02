import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Group, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { cableAttachmentFrame, cableGripPoint, correctEquipmentMotion } from "./equipment-motion";
import { defaultScene, sampleWorkshopPose, type WorkshopScene } from "./workshop";

let source: Group;
beforeAll(async () => {
  const bytes = await readFile("public/models/z-anatomy/model.glb");
  source = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "")).scene;
});

describe("equipment motion", () => {
  it("presses vertically from stacked wrists and elbows to overhead", () => {
    const scene: WorkshopScene = { ...defaultScene, keyframes: [
      { timeMs: 0, poses: { "left-shoulder": { x: -90, y: 0, z: -75 }, "right-shoulder": { x: -90, y: 0, z: 75 }, "left-elbow": { x: 90, y: 0, z: 0 }, "right-elbow": { x: 90, y: 0, z: 0 } } },
      { timeMs: 1600, poses: { "left-shoulder": { x: 0, y: 0, z: -165 }, "right-shoulder": { x: 0, y: 0, z: 165 }, "left-elbow": { x: 5, y: 0, z: 0 }, "right-elbow": { x: 5, y: 0, z: 0 } } },
    ] };
    const corrected = correctEquipmentMotion(scene);
    const rig = createAnatomyRig(source);
    try {
      let previousHeight = 0;
      for (const time of [0, 400, 800, 1200, 1600]) {
        poseAnatomyRig(rig, sampleWorkshopPose(corrected.keyframes, time), true);
        for (const side of ["left", "right"] as const) {
          const wrist = rig.handBones[side].getWorldPosition(new Vector3());
          const elbow = rig.bones[`${side}-elbow`].getWorldPosition(new Vector3());
          expect(wrist.y).toBeGreaterThan(elbow.y);
          expect(Math.abs(wrist.z - elbow.z)).toBeLessThan(0.12);
          if (time === 0) expect(Math.abs(wrist.x - elbow.x)).toBeLessThan(0.12);
          if (time === 1600) expect(wrist.y).toBeGreaterThan(3);
        }
        const height = rig.handBones.left.getWorldPosition(new Vector3()).y;
        expect(height).toBeGreaterThan(previousHeight);
        previousHeight = height;
      }
      expect(correctEquipmentMotion(corrected)).toBe(corrected);
      expect(correctEquipmentMotion(defaultScene)).toBe(defaultScene);
    } finally { rig.dispose(); }
  });

  it("keeps both pushdown hands on a horizontal bar facing the high pulley", () => {
    const scene = correctEquipmentMotion({ ...defaultScene, equipment: { slug: "single-cable", x: 2.75, y: 2.25, z: 0.6, scale: 1 },
      keyframes: [95, 10].map((angle, index) => ({ timeMs: index * 1600, poses: { "left-elbow": { x: angle, y: 0, z: 0 } } })) });
    const rig = createAnatomyRig(source);
    try {
      for (const time of [0, 400, 800, 1200, 1600]) {
        poseAnatomyRig(rig, sampleWorkshopPose(scene.keyframes, time), true, 180);
        const frame = cableAttachmentFrame(rig, scene);
        const left = cableGripPoint(rig, "left"), right = cableGripPoint(rig, "right");
        expect(Math.abs(left.y - right.y)).toBeLessThan(0.00001);
        expect(Math.abs(left.z - right.z)).toBeLessThan(0.00001);
        expect(frame.pulley.x).toBeCloseTo(0);
        expect(frame.pulley.z).toBeGreaterThan(left.z);
        expect(frame.pulley.y).toBeGreaterThan(left.y);
        for (const grip of [left, right]) {
          const local = grip.clone().sub(frame.center).applyQuaternion(frame.rotation.clone().invert());
          expect(Math.abs(local.y)).toBeLessThan(0.00001);
          expect(Math.abs(local.z)).toBeLessThan(0.00001);
          expect(Math.abs(local.x)).toBeLessThan(frame.width / 2);
        }
        expect(rig.fingerSegments.every(segment => segment.bone.rotation.x < 0)).toBe(true);
      }
    } finally { rig.dispose(); }
  });
});
