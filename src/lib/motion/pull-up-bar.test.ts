import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { Group, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { searchWorkshopEquipment, workshopEquipmentOptions } from "./quick-create";
import { workshopSceneSchema } from "./scene-schema";
import { applyStudioSeating } from "./studio-seat";
import { createStudioObject, sampleStudioObject, studioPointToWorld } from "./studio";
import { studioGripOffset, weightGripPoint } from "./studio-grip";
import { equipmentGripHands } from "./equipment-capabilities";
import { limbPoseBlock } from "./limb-pose";
import { pullUpBar } from "./pull-up-bar";
import { blankWorkshopScene, identityTransform, sampleWorkshopPose, type RigPose, type WorkshopScene } from "./workshop";

function pose(shoulder: number[], elbow: number): RigPose {
  return { "left-shoulder": { x: shoulder[0], y: shoulder[1], z: shoulder[2] }, "right-shoulder": { x: shoulder[0], y: -shoulder[1], z: -shoulder[2] },
    "left-elbow": { x: elbow, y: 0, z: 0 }, "right-elbow": { x: elbow, y: 0, z: 0 },
    "left-hip": { x: -10, y: 0, z: 0 }, "right-hip": { x: -10, y: 0, z: 0 }, "left-knee": { x: -25, y: 0, z: 0 }, "right-knee": { x: -25, y: 0, z: 0 } };
}
// A wide overhand pull-up: dead hang, three intermediate moments with the elbows out, chin over the bar.
const phases: [number[], number][] = [[[0, 0, -162], 6], [[-50, -40, -115], 55], [[-55, -20, -100], 95], [[-40, 0, -85], 125], [[-5, 5, -65], 135]];
function pullUp(placement: Partial<typeof identityTransform> = {}): WorkshopScene {
  const bar = { ...createStudioObject("pull-up-bar", "00000000-0000-4000-8000-000000000001", 0), ...identityTransform, ...placement, attachment: "both" as const };
  return { ...structuredClone(blankWorkshopScene), durationMs: 4000, keyframes: [...phases, ...phases.slice(0, -1).reverse()].map(([shoulder, elbow], index) => ({ timeMs: index * 500, poses: pose(shoulder, elbow) })),
    studio: { body: { ...identityTransform }, objects: [bar] } };
}
const flexion = (rig: ReturnType<typeof createAnatomyRig>, side: "left" | "right") => {
  const shoulder = rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3()), elbow = rig.bones[`${side}-elbow`].getWorldPosition(new Vector3());
  return elbow.clone().sub(shoulder).angleTo(rig.handBones[side].getWorldPosition(new Vector3()).sub(elbow)) * 180 / Math.PI;
};

describe("pull-up bar", () => {
  it("is found as a support that only both hands can hold, and hanging excludes other supports", () => {
    expect(searchWorkshopEquipment(workshopEquipmentOptions(), "pull up bar")[0]?.slug).toBe("pull-up-bar");
    const scene = pullUp(), bar = scene.studio!.objects[0];
    expect(equipmentGripHands(bar)).toEqual(["both"]);
    expect(workshopSceneSchema.safeParse(JSON.parse(JSON.stringify(scene))).success).toBe(true);
    expect(weightGripPoint(bar, "left").toArray()).toEqual([pullUpBar.grip, pullUpBar.height, 0]);
    for (const limb of ["left-hand", "right-hand"] as const) expect(limbPoseBlock(scene, limb)).toMatch(/hands stay on the bar/);
    for (const limb of ["left-foot", "right-foot"] as const) expect(limbPoseBlock(scene, limb)).toBeUndefined();
    const invalid: WorkshopScene[] = [
      { ...scene, studio: { ...scene.studio!, objects: [{ ...bar, attachment: "left" }] } },
      { ...scene, motionStyle: "squat" },
      { ...scene, studio: { ...scene.studio!, supports: [{ region: "left-foot", objectId: null, surface: "floor", point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 }, turn: 0 }] } },
      { ...scene, studio: { ...scene.studio!, objects: [bar, { ...createStudioObject("leg-press", "00000000-0000-4000-8000-000000000002", 1), machineUse: true }] } },
    ];
    for (const item of invalid) expect(workshopSceneSchema.safeParse(JSON.parse(JSON.stringify(item))).success).toBe(false);
  });

  it.each([{}, { x: -.6, y: .1, z: .3, rotationY: 35 }])("hangs the body from the hands at a height set by the arms, placement %o", placement => {
    const scene = pullUp(placement), rig = createAnatomyRig(new Group()), heights: number[] = [], depths: number[] = [];
    try {
      for (let step = 0; step <= 16; step++) {
        const time = 2000 * step / 16, authored = sampleWorkshopPose(scene.keyframes, time), bar = sampleStudioObject(scene.studio!.objects[0], time);
        poseAnatomyRig(rig, authored, true); applyStudioSeating(rig, scene.studio, time, authored);
        for (const side of ["left", "right"] as const) {
          expect(rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(studioPointToWorld(weightGripPoint(bar, side), bar)), `${side} grip at ${step}`).toBeLessThan(.001);
          expect(rig.bones[`${side}-knee`].rotation.x * 180 / Math.PI, `${side} knee stays authored at ${step}`).toBeCloseTo(25, 5);
        }
        const pelvis = rig.bones.pelvis.getWorldPosition(new Vector3()).sub(new Vector3(bar.x, bar.y, bar.z));
        heights.push(pelvis.y); depths.push(pelvis.clone().applyAxisAngle(new Vector3(0, 1, 0), -bar.rotationY * Math.PI / 180).z);
        if (step === 0) expect(flexion(rig, "left"), "elbows nearly straight in the dead hang").toBeLessThan(20);
        if (step === 16) expect(flexion(rig, "left"), "elbows deeply flexed at the top").toBeGreaterThan(135);
      }
      for (let step = 1; step <= 16; step++) expect(heights[step], `the body rises at ${step}`).toBeGreaterThan(heights[step - 1]);
      expect(heights[16] - heights[0]).toBeGreaterThan(.7);
      expect(Math.max(...depths) - Math.min(...depths), "little swing").toBeLessThan(.15);
    } finally { rig.dispose(); }
  });

  it("keeps both hands on the bar when the arms are posed unevenly", () => {
    const scene = pullUp(), rig = createAnatomyRig(new Group());
    try {
      const uneven = { ...pose([-55, -20, -100], 95), "right-elbow": { x: 60, y: 0, z: 0 } };
      poseAnatomyRig(rig, uneven, true); applyStudioSeating(rig, scene.studio, 0, uneven);
      for (const side of ["left", "right"] as const) expect(rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(weightGripPoint(scene.studio!.objects[0], side))).toBeLessThan(.001);
      const released = { ...scene.studio!, objects: [{ ...scene.studio!.objects[0], attachment: "none" as const }] };
      poseAnatomyRig(rig, uneven, true); applyStudioSeating(rig, released, 0, uneven);
      expect(rig.root.position.length(), "an unused bar leaves the figure where it stands").toBe(0);
    } finally { rig.dispose(); }
  });

  it("clears the real head, neck and body past the bar with the chin over it at the top", async () => {
    const bytes = await readFile("public/models/z-anatomy/model.glb");
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    const rig = createAnatomyRig(gltf.scene), scene = pullUp(), point = new Vector3();
    const handPart = /phalanx_of_.*finger_of_hand|metacarpal|carpal|hand|pollicis|digiti_minimi|palmar|hamate|capitate|lunate|scaphoid|trapezi(um|oid)|triquetr|pisiform/i;
    try {
      for (let step = 0; step <= 16; step++) {
        const time = 2000 * step / 16, authored = sampleWorkshopPose(scene.keyframes, time);
        poseAnatomyRig(rig, authored, true); applyStudioSeating(rig, scene.studio, time, authored);
        rig.root.updateMatrixWorld(true); rig.skeleton.update();
        let clearance = Infinity, chin = -Infinity, feet = Infinity;
        for (const mesh of rig.meshes) {
          const count = mesh.geometry.getAttribute("position").count, hand = handPart.test(mesh.name), mandible = /mandible/i.test(mesh.name);
          for (let vertex = 0; vertex < count; vertex++) {
            mesh.localToWorld(mesh.getVertexPosition(vertex, point));
            feet = Math.min(feet, point.y);
            if (mandible) chin = Math.max(chin, point.y - pullUpBar.height);
            // The gripping hands and wrists wrap the bar; everything else must stay clear of it.
            if (hand || Math.abs(point.x) > pullUpBar.upright.x || point.distanceTo(new Vector3(Math.sign(point.x) * pullUpBar.grip, pullUpBar.height, 0)) < .15) continue;
            clearance = Math.min(clearance, Math.hypot(point.y - pullUpBar.height, point.z) - pullUpBar.radius);
          }
        }
        expect(clearance, `bar clearance at ${step}`).toBeGreaterThan(.015);
        expect(feet, `feet off the floor at ${step}`).toBeGreaterThan(.05);
        if (step === 16) expect(chin, "chin over the bar").toBeGreaterThan(.03);
      }
    } finally { rig.dispose(); }
  }, 60_000);
});
