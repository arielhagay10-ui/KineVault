import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { type Group, Quaternion, Vector3 } from "three";
import { anatomyEconomyModelUrl, anatomyModelUrl, bendAnatomyToes, correctAuthoredArmPath, createAnatomyRig, plantAnatomyFeet, poseAnatomyRig, toeAxis, type AnatomyRig } from "./anatomy";
import { createQuickScene } from "./quick-create";
import { applyStudioMachine } from "./studio-machines";
import { applyStudioSeating } from "./studio-seat";
import { createStudioObject } from "./studio";
import { defaultScene, sampleWorkshopPose, type WorkshopScene } from "./workshop";

// SHA-256 of every mesh's skinIndex and skinWeight bytes before the toe joint existed.
const previousSkin: Record<string, string> = {
  [anatomyModelUrl]: "87a059cfb9ca076d123bbf139e0abbed8559be96b498503b0cc15785ec160a4a",
  [anatomyEconomyModelUrl]: "7e1bd7ac84c953fdb482e07601e3c43bd7294b9bdc796a67d87d3464fc342d2d",
};
const sources: Record<string, Group> = {};
beforeAll(async () => {
  for (const url of [anatomyModelUrl, anatomyEconomyModelUrl]) {
    const bytes = await readFile(`public${url}`);
    sources[url] = (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "")).scene;
  }
}, 60_000);

function boneMatrix(rig: AnatomyRig, index: number) {
  return Array.from(rig.skeleton.boneMatrices!.subarray(index * 16, index * 16 + 16));
}

describe("toe joint", () => {
  it.each([anatomyModelUrl, anatomyEconomyModelUrl])("adds toe influences to %s without changing any other skin data", url => {
    const rig = createAnatomyRig(sources[url]), hash = createHash("sha256");
    try {
      const toes = { left: rig.skeleton.bones.indexOf(rig.toeBones.left), right: rig.skeleton.bones.indexOf(rig.toeBones.right) };
      expect(Object.values(toes)).toEqual([rig.skeleton.bones.length - 2, rig.skeleton.bones.length - 1]);
      let toeVertices = 0;
      for (const mesh of rig.meshes) {
        const indices = (mesh.geometry.getAttribute("skinIndex").array as Uint16Array).slice();
        const weights = (mesh.geometry.getAttribute("skinWeight").array as Float32Array).slice();
        const phalanx = /phalanx_of_\w+_finger_of_foot/.test(mesh.name);
        for (let vertex = 0; vertex < indices.length / 4; vertex++) {
          const slot = vertex * 4 + 2;
          if (indices[slot] !== toes.left && indices[slot] !== toes.right) { expect(phalanx).toBe(false); continue; }
          toeVertices++;
          expect([.5, 1]).toContain(weights[slot]);
          expect(weights[slot - 1] + weights[slot]).toBe(1);
          if (phalanx) expect(weights[slot]).toBe(1);
          // Fold the toe share back into the foot to recover the previous binding.
          expect(indices[slot - 1]).toBe(rig.skeleton.bones.indexOf(rig.footBones[indices[slot] === toes.left ? "left" : "right"]));
          weights[slot - 1] = 1; weights[slot] = 0; indices[slot] = 0;
        }
        hash.update(new Uint8Array(indices.buffer)); hash.update(new Uint8Array(weights.buffer));
      }
      expect(toeVertices).toBeGreaterThan(5000);
      expect(hash.digest("hex")).toBe(previousSkin[url]);
    } finally { rig.dispose(); }
  });

  it("skins resting toes with the exact foot matrices across existing scenes", () => {
    const rig = createAnatomyRig(sources[anatomyModelUrl]);
    const bench = { ...createStudioObject("bench", crypto.randomUUID(), 0), benchAngle: 0 };
    const scenes: WorkshopScene[] = [defaultScene,
      ...(["squat", "hinge", "row", "split-squat", "bench-press", "seated-curl", "incline-curl"] as const).map(motionStyle => ({ ...defaultScene, motionStyle, keyframes: [
        { timeMs: 0, poses: { torso: { x: 0, y: 0, z: 0 }, "left-ankle": { x: -8, y: 4, z: 3 } } }, { timeMs: 3200, poses: { torso: { x: 35, y: 0, z: 0 }, "left-ankle": { x: 12, y: 0, z: -6 } } }] })),
      ...(["leg-press", "smith-machine", "leg-extension-machine", "t-bar-row-machine", "row-machine"] as const).map(slug => createQuickScene(slug)),
      { ...defaultScene, equipment: null, studio: { body: { x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1 }, objects: [bench], seating: { benchId: bench.id, facing: "supine" } } }];
    try {
      for (const scene of scenes) for (let step = 0; step <= 8; step++) {
        const time = scene.durationMs * step / 8, pose = sampleWorkshopPose(scene.keyframes, time);
        poseAnatomyRig(rig, pose, true); plantAnatomyFeet(rig, scene.motionStyle, pose); correctAuthoredArmPath(rig, scene.motionStyle, pose);
        applyStudioSeating(rig, scene.studio, time, pose); applyStudioMachine(rig, scene, time);
        rig.root.updateMatrixWorld(true); rig.skeleton.update();
        for (const side of ["left", "right"] as const) {
          expect(boneMatrix(rig, rig.skeleton.bones.indexOf(rig.toeBones[side])), `${scene.motionStyle} ${scene.studio?.objects[0]?.slug} ${side} at ${step}`)
            .toEqual(boneMatrix(rig, rig.skeleton.bones.indexOf(rig.footBones[side])));
        }
      }
    } finally { rig.dispose(); }
  });

  it("bends the toes about the MTP line while the metatarsals stay with the foot", () => {
    const rig = createAnatomyRig(sources[anatomyModelUrl]), point = new Vector3();
    const find = (name: string) => rig.meshes.find(mesh => mesh.name === name)!;
    const sample = (name: string) => Array.from({ length: 12 }, (_, index) => find(name).getVertexPosition(index * 7, new Vector3()).clone());
    try {
      poseAnatomyRig(rig, {});
      const names = ["Distal_phalanx_of_first_finger_of_footl", "Second_metatarsal_bonel", "Proximal_phalanx_of_fifth_finger_of_footr"];
      const rest = names.map(sample);
      const axis = new Vector3(...toeAxis.direction).normalize();
      bendAnatomyToes(rig, "left", new Quaternion().setFromAxisAngle(axis, -30 * Math.PI / 180));
      rig.root.updateMatrixWorld(true); rig.skeleton.update();
      const bent = names.map(sample);
      expect(Math.min(...bent[0].map((vertex, index) => vertex.distanceTo(rest[0][index])))).toBeGreaterThan(.02);
      for (const index of [1, 2]) expect(Math.max(...bent[index].map((vertex, item) => vertex.distanceTo(rest[index][item])))).toBe(0);
      // The bent toe rises above the floor, pivoting on the joint.
      expect(Math.min(...bent[0].map(vertex => vertex.y))).toBeGreaterThan(Math.min(...rest[0].map(vertex => vertex.y)) + .02);
      poseAnatomyRig(rig, {});
      expect(rig.toeBones.left.quaternion.equals(new Quaternion()) && rig.toeBones.left.position.lengthSq() === 0).toBe(true);
      expect(find(names[0]).getVertexPosition(0, point).distanceTo(rest[0][0])).toBe(0);
    } finally { rig.dispose(); }
  });
});
