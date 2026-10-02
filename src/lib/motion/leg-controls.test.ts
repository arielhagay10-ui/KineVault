import { describe, expect, it, vi } from "vitest";
import { Euler, Group, Quaternion, Vector3 } from "three";
import { createAnatomyRig, plantAnatomyFeet, poseAnatomyRig } from "./anatomy";
import { jointControlRange, jointControlValue, sampleWorkshopPose, type RigPose } from "./workshop";
import { readJointAngles } from "./studio";
import { workshopSceneSchema } from "./scene-schema";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
import { decodeSharedScene } from "./load-scene";

describe("knee and ankle controls", () => {
  it("shows positive knee flexion and bends the lower leg backward without stretching", () => {
    const rig = createAnatomyRig(new Group());
    try {
      for (const side of ["left", "right"] as const) {
        const slug = `${side}-knee` as const;
        expect(jointControlRange(slug, "x")).toEqual([-5, 150]);
        poseAnatomyRig(rig, {});
        const knee = rig.bones[slug].getWorldPosition(new Vector3());
        const originalFoot = rig.footBones[side].getWorldPosition(new Vector3());
        for (let step = 0; step <= 16; step++) {
          const flexion = step * 150 / 16;
          poseAnatomyRig(rig, { [slug]: { x: jointControlValue(slug, "x", flexion), y: 0, z: 0 } });
          const foot = rig.footBones[side].getWorldPosition(new Vector3());
          expect(rig.bones[slug].getWorldPosition(new Vector3()).distanceTo(knee)).toBeLessThan(1e-5);
          expect(foot.distanceTo(knee)).toBeCloseTo(originalFoot.distanceTo(knee), 6);
          if (step) expect(foot.z).toBeLessThan(originalFoot.z);
          expect(jointControlValue(slug, "x", readJointAngles(slug, rig.bones[slug]).x)).toBeCloseTo(Math.round(flexion), 0);
        }
      }
    } finally { rig.dispose(); }
  });

  it("raises and points the toes independently with an anchored ankle pivot", () => {
    const rig = createAnatomyRig(new Group());
    try {
      for (const side of ["left", "right"] as const) {
        poseAnatomyRig(rig, {});
        const foot = rig.footBones[side], other = rig.footBones[side === "left" ? "right" : "left"];
        const pivot = foot.getWorldPosition(new Vector3());
        const flatToe = foot.localToWorld(new Vector3(0, 0, 0.2));
        let previous: Quaternion | null = null;
        for (let step = 0; step <= 16; step++) {
          const angle = -45 + step * 65 / 16;
          poseAnatomyRig(rig, { [`${side}-ankle`]: { x: angle, y: 0, z: 0 } });
          const toe = foot.localToWorld(new Vector3(0, 0, 0.2));
          expect(foot.getWorldPosition(new Vector3()).distanceTo(pivot)).toBeLessThan(1e-5);
          expect((toe.y - flatToe.y) * Math.sign(angle)).toBeGreaterThan(0);
          expect(other.quaternion.angleTo(new Quaternion())).toBeLessThan(1e-5);
          const rotation = foot.getWorldQuaternion(new Quaternion());
          if (previous) expect(rotation.angleTo(previous)).toBeLessThan(0.1);
          previous = rotation;
        }
      }
    } finally { rig.dispose(); }
  });

  it("retains explicit ankle poses with automatic foot placement, and leaves old scenes automatic", () => {
    const rig = createAnatomyRig(new Group());
    try {
      const pose: RigPose = { torso: { x: 20, y: 0, z: 0 }, "left-ankle": { x: 15, y: 0, z: 0 } };
      poseAnatomyRig(rig, pose); plantAnatomyFeet(rig, "squat", pose);
      expect(rig.footBones.left.getWorldQuaternion(new Quaternion()).angleTo(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -15 * Math.PI / 180))).toBeLessThan(1e-5);
      expect(rig.footBones.right.getWorldQuaternion(new Quaternion()).angleTo(new Quaternion())).toBeLessThan(1e-5);
      const frames = [{ timeMs: 0, poses: {} }, { timeMs: 1000, poses: {} }];
      expect(sampleWorkshopPose(frames, 500)["left-ankle"]).toBeUndefined();
    } finally { rig.dispose(); }
  });

  it("loads ankle quaternions and safely normalizes legacy knee extension and twisting", () => {
    const encode = (slug: string, x: number, y: number, z: number) => {
      const rotation = new Quaternion().setFromEuler(new Euler(x * Math.PI / 180, y * Math.PI / 180, z * Math.PI / 180));
      return { slug, x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w };
    };
    const poses = [encode("left-knee", -90, 0, 0), encode("right-knee", 15, 10, 20), encode("left-ankle", 20, -15, 25)];
    const scene = decodeSharedScene({ durationMs: 1000, cameraAngle: "front", equipment: null, keyframes: [{ timeMs: 0, poses }, { timeMs: 1000, poses }] });
    expect(scene?.keyframes[0].poses["left-knee"]).toEqual({ x: -90, y: 0, z: 0 });
    expect(scene?.keyframes[0].poses["right-knee"]).toEqual({ x: 5, y: 0, z: 0 });
    expect(scene?.keyframes[0].poses["left-ankle"]).toEqual({ x: 20, y: -15, z: 25 });
    for (const knee of [{ x: 6, y: 0, z: 0 }, { x: -151, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }]) {
      const invalid = structuredClone(scene!); invalid.keyframes[0].poses["left-knee"] = knee;
      expect(workshopSceneSchema.safeParse(invalid).success).toBe(false);
    }
  });
});
