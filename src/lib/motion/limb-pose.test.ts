import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { Group, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { blankWorkshopScene, jointLimits, type RigPose } from "./workshop";
import { createQuickScene } from "./quick-create";
import { limbPoseBlock, solveLimbPose, type PoseLimb } from "./limb-pose";
import { createStudioObject } from "./studio";
import { forearmRotationForScene } from "./equipment-motion";

async function loadRig() {
  const bytes = await readFile("public/models/z-anatomy/model.glb");
  const model = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  return createAnatomyRig(model.scene);
}

describe("direct hand and foot posing", () => {
  it.each(["d-handle", "straight-bar", "rope", "cuff"] as const)("lets held %s cables follow freely posed hands and feet", attachment => {
    const scene = createQuickScene("cable-machine");
    scene.studio!.objects[0].cableAttachment = attachment;
    for (const limb of ["left-hand", "right-hand", "left-foot", "right-foot"] as const) {
      expect(limbPoseBlock(scene, limb)).toBeUndefined();
    }
  });
  it("does not turn either palm automatically as a custom hand drag crosses curl angles", () => {
    const scene = structuredClone(blankWorkshopScene);
    scene.keyframes[1].poses["left-elbow"] = { x: 95, y: 0, z: 0 };
    expect(forearmRotationForScene(scene)).toBe(90);
  });
  it.each(["left-hand", "right-hand", "left-foot", "right-foot"] as PoseLimb[])("reconstructs saved %s targets with stable bone lengths at 17 points", async limb => {
    const rig = await loadRig(), side = limb.startsWith("left") ? "left" : "right", hand = limb.endsWith("hand");
    const upper = `${side}-${hand ? "shoulder" : "hip"}` as const;
    const hinge = `${side}-${hand ? "elbow" : "knee"}` as const;
    const end = rig.bones[`${side}-${hand ? "wrist" : "ankle"}`];
    const body = new Group(); body.position.set(.4, .2, -.6); body.rotation.set(.1, .4, -.05); body.scale.setScalar(1.2); body.add(rig.root);
    let pose: RigPose = { torso: { x: 9, y: 12, z: 0 } };
    try {
      for (let i = 0; i <= 16; i++) {
        const desired: RigPose = { ...pose, [upper]: { x: hand ? -20 - i * 2 : 15 + i, y: 0, z: side === "left" ? 5 : -5 }, [hinge]: { x: (hand ? 1 : -1) * (20 + i * 3), y: 0, z: 0 } };
        poseAnatomyRig(rig, desired);
        const target = end.getWorldPosition(new Vector3());
        poseAnatomyRig(rig, pose);
        const before = rig.bones[hinge].position.clone();
        const length = end.getWorldPosition(new Vector3()).distanceTo(rig.bones[hinge].getWorldPosition(new Vector3()));
        const opposite = rig.bones[`${side === "left" ? "right" : "left"}-${hand ? "wrist" : "ankle"}`].getWorldPosition(new Vector3());
        const result = solveLimbPose(rig, limb, pose, target);
        expect(rig.bones[hinge].position).toEqual(before);
        expect(result.error).toBeLessThan(.008);
        pose = { ...pose, ...result.poses };
        poseAnatomyRig(rig, pose);
        expect(end.getWorldPosition(new Vector3()).distanceTo(target)).toBeLessThan(.008);
        expect(end.getWorldPosition(new Vector3()).distanceTo(rig.bones[hinge].getWorldPosition(new Vector3()))).toBeCloseTo(length, 8);
        expect(rig.bones[`${side === "left" ? "right" : "left"}-${hand ? "wrist" : "ankle"}`].getWorldPosition(new Vector3()).distanceTo(opposite)).toBeLessThan(1e-8);
        expect(pose.torso).toEqual({ x: 9, y: 12, z: 0 });
        for (const slug of [upper, hinge]) for (const axis of ["x", "y", "z"] as const) {
          expect(pose[slug]![axis]).toBeGreaterThanOrEqual(jointLimits[slug][axis][0]);
          expect(pose[slug]![axis]).toBeLessThanOrEqual(jointLimits[slug][axis][1]);
        }
        expect(pose[hinge]!.x * (hand ? 1 : -1)).toBeGreaterThanOrEqual(0);
      }
      const far = solveLimbPose(rig, limb, pose, new Vector3(99, 99, 99));
      expect(far.error).toBeGreaterThan(1);
      expect(Object.values(far.poses).every(angles => Object.values(angles!).every(Number.isFinite))).toBe(true);
    } finally { rig.dispose(); }
  });

  it("keeps machine, seated and held contacts in charge", () => {
    const scene = structuredClone(blankWorkshopScene);
    expect(limbPoseBlock(scene, "left-hand")).toBeUndefined();
    const weight = createStudioObject("dumbbell", "weight", 0); weight.attachment = "left"; scene.studio!.objects.push(weight);
    expect(limbPoseBlock(scene, "left-hand")).toMatch(/attached equipment/);
    expect(limbPoseBlock(scene, "right-hand")).toBeUndefined();
    expect(limbPoseBlock(scene, "left-foot")).toBeUndefined();
    scene.studio!.objects = [];
    expect(limbPoseBlock(createQuickScene("pec-deck"), "left-hand")).toMatch(/machine/i);
    scene.studio!.seating = { benchId: "bench", facing: "front" };
    expect(limbPoseBlock(scene, "left-foot")).toMatch(/Stand up/);
    expect(limbPoseBlock(scene, "left-hand")).toBeUndefined();
    scene.motionStyle = "squat";
    expect(limbPoseBlock(scene, "right-foot")).toMatch(/Free posing/);
  });

  it("keeps the frontal constraint and restores the rig after unreachable or invalid targets", async () => {
    const rig = await loadRig();
    try {
      poseAnatomyRig(rig, { "left-shoulder": { x: 0, y: 0, z: -40 }, "left-elbow": { x: 30, y: 0, z: 0 } });
      const target = rig.handBones.left.getWorldPosition(new Vector3());
      poseAnatomyRig(rig, {});
      const original = rig.bones["left-shoulder"].quaternion.clone();
      const result = solveLimbPose(rig, "left-hand", {}, target, true);
      expect(result.error).toBeLessThan(.008);
      expect(result.poses["left-shoulder"]).toMatchObject({ x: 0, y: 0 });
      expect(rig.bones["left-shoulder"].quaternion.toArray()).toEqual(original.toArray());
      expect(solveLimbPose(rig, "left-hand", {}, new Vector3(NaN, 0, 0)).poses).toEqual({});
      expect(rig.bones["left-shoulder"].quaternion.toArray()).toEqual(original.toArray());
    } finally { rig.dispose(); }
  });
});
