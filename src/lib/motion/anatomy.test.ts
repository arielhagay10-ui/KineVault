import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Group, Quaternion, Vector3 } from "three";
import { correctAuthoredArmPath, createAnatomyRig, highlightAnatomyRig, plantAnatomyFeet, poseAnatomyRig } from "./anatomy";
import { defaultScene, sampleWorkshopPose } from "./workshop";

let source: Group;
beforeAll(async () => {
  const bytes = await readFile("public/models/z-anatomy/model.glb");
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  source = gltf.scene;
});

describe("Z-Anatomy integration", () => {
  it("presses vertically and keeps lunge weights outside the hips and thighs throughout the rep", () => {
    const rig = createAnatomyRig(source);
    try {
      for (const style of ["bench-press", "split-squat"]) {
        const previous = [new Vector3(), new Vector3()];
        for (let step = 0; step <= 16; step++) {
          const progress = step / 16;
          const pose = { torso: { x: progress * 35, y: 0, z: 0 }, "left-elbow": { x: 90 - 85 * progress, y: 0, z: 0 }, "right-elbow": { x: 90 - 85 * progress, y: 0, z: 0 } };
          poseAnatomyRig(rig, pose, true); plantAnatomyFeet(rig, style, pose); correctAuthoredArmPath(rig, style, pose);
          for (const [index, side] of (["left", "right"] as const).entries()) {
            const sign = side === "left" ? 1 : -1;
            const grip = rig.handBones[side].localToWorld(new Vector3(sign * 0.03, -0.15, 0.13));
            const shoulder = rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3());
            if (style === "bench-press") {
              const gripRotation = rig.handBones[side].getWorldQuaternion(new Quaternion());
              const fixedRotation = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI);
              expect(gripRotation.angleTo(fixedRotation)).toBeLessThan(0.00001);
              expect(rig.handBones[side].quaternion.angleTo(new Quaternion())).toBeLessThan(0.00001);
              expect(gripRotation.angleTo(rig.forearmBones[side].getWorldQuaternion(new Quaternion()))).toBeLessThan(0.00001);
              expect(grip.z).toBeCloseTo(shoulder.z + 0.08, 3);
              if (step > 0) expect(grip.y).toBeGreaterThan(previous[index].y);
              if (step === 16) expect(grip.y - shoulder.y).toBeGreaterThan(0.99);
            } else {
              expect(grip.x).toBeCloseTo(sign * 0.44, 3);
              // A bounding sphere enclosing both plates must clear the posed body.
              for (const mesh of rig.meshes.filter(mesh => /gluteus|vastus|rectus_femoris|adductor_(longus|magnus|brevis)|Hip_bone/i.test(mesh.name))) {
                const positions = mesh.geometry.getAttribute("position");
                for (let vertex = 0; vertex < positions.count; vertex++) {
                  const point = mesh.localToWorld(mesh.getVertexPosition(vertex, new Vector3()));
                  if (Math.abs(point.y - grip.y) < 0.15 && Math.abs(point.z - grip.z) < 0.25) {
                    expect(sign * (grip.x - point.x)).toBeGreaterThan(0.16);
                  }
                }
              }
            }
            previous[index].copy(grip);
          }
        }
      }
    } finally { rig.dispose(); }
  });
  it("plants both feet throughout authored lower-body movements and resets free poses", () => {
    const rig = createAnatomyRig(source);
    try {
      for (const style of ["squat", "hinge", "row", "split-squat", "bench-press"]) {
        const starts: Vector3[] = [];
        for (const depth of [0, 8.75, 17.5, 26.25, 35]) {
          const pose = { torso: { x: depth, y: 0, z: 0 } };
          poseAnatomyRig(rig, pose); plantAnatomyFeet(rig, style, pose);
          for (const [index, side] of (["left", "right"] as const).entries()) {
            const foot = rig.footBones[side];
            const position = foot.getWorldPosition(new Vector3());
            const rearFoot = style === "split-squat" && side === "right";
            expect(position.y).toBeCloseTo(rearFoot ? 0.204 : 0.119, 3);
            if (depth === 0) starts[index] = position;
            else expect(position.distanceTo(starts[index])).toBeLessThan(0.001);
            const orientation = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), rearFoot ? 25 * Math.PI / 180 : 0);
            expect(foot.getWorldQuaternion(new Quaternion()).angleTo(orientation)).toBeLessThan(0.00001);
          }
        }
      }
      poseAnatomyRig(rig, {});
      expect(rig.root.position.length()).toBe(0);
      expect(rig.root.quaternion.angleTo(new Quaternion())).toBe(0);
    } finally { rig.dispose(); }
  });
  it("keeps medial deltoid origins attached while the upper arms move overhead", () => {
    const rig = createAnatomyRig(source);
    try {
      poseAnatomyRig(rig, { "left-shoulder": { x: -90, y: -75, z: -90 }, "right-shoulder": { x: -90, y: 75, z: 90 } });
      let checked = 0;
      for (const mesh of rig.meshes.filter(mesh => /deltoid/.test(mesh.name))) {
        const positions = mesh.geometry.getAttribute("position");
        for (let index = 0; index < positions.count; index++) {
          const original = new Vector3().fromBufferAttribute(positions, index);
          if (Math.abs(original.x) > 0.24) continue;
          expect(mesh.getVertexPosition(index, new Vector3()).distanceTo(original)).toBeLessThan(0.00001);
          checked++;
        }
      }
      expect(checked).toBeGreaterThan(10);
    } finally { rig.dispose(); }
  });
  it("turns palms down on lateral raises without bending the wrists", () => {
    const rig = createAnatomyRig(source);
    try {
      poseAnatomyRig(rig, { "left-shoulder": { x: 0, y: 0, z: -90 }, "right-shoulder": { x: 0, y: 0, z: 90 } }, "left");
      for (const side of ["left", "right"] as const) {
        const palm = new Vector3(0, 0, 1).applyQuaternion(rig.handBones[side].getWorldQuaternion(new Quaternion()));
        expect(palm.y).toBeLessThan(-0.99);
        expect(rig.handBones[side].rotation.x).toBe(0);
      }
      expect(rig.fingerSegments.filter(segment => segment.side === "right").every(segment => segment.bone.rotation.x === 0)).toBe(true);
    } finally { rig.dispose(); }
  });
  it("flexes elbows forward and closes both hands around the grip", () => {
    const rig = createAnatomyRig(source);
    try {
      poseAnatomyRig(rig, {});
      const wrists = (["left", "right"] as const).map(side => rig.handBones[side].getWorldPosition(new Vector3()));
      const fingertips = rig.meshes.filter(mesh => /Distal_phalanx_of_.*finger_of_hand/.test(mesh.name));
      const open = fingertips.map(mesh => mesh.getVertexPosition(0, new Vector3()).clone());
      poseAnatomyRig(rig, { "left-elbow": { x: 90, y: 0, z: 0 }, "right-elbow": { x: 90, y: 0, z: 0 } });
      for (const [index, side] of (["left", "right"] as const).entries()) {
        expect(rig.handBones[side].getWorldPosition(new Vector3()).z).toBeGreaterThan(wrists[index].z + 0.25);
      }
      poseAnatomyRig(rig, {}, true);
      expect(rig.fingerSegments).toHaveLength(28);
      for (const [index, mesh] of fingertips.entries()) expect(mesh.getVertexPosition(0, new Vector3()).distanceTo(open[index])).toBeGreaterThan(0.02);
      poseAnatomyRig(rig, {});
      for (const [index, mesh] of fingertips.entries()) expect(mesh.getVertexPosition(0, new Vector3()).distanceTo(open[index])).toBeLessThan(0.00001);
    } finally { rig.dispose(); }
  });
  it("exposes the actual muscles, separate heads and individual isolation", () => {
    const rig = createAnatomyRig(source);
    try {
      expect(rig.muscles).toHaveLength(513);
      expect(new Set(rig.muscles.map(item => item.id)).size).toBe(513);
      expect(highlightAnatomyRig(rig, "group:triceps", false)).toBe(6);
      expect(highlightAnatomyRig(rig, "group:traps", false)).toBe(6);
      const leftHead = rig.muscles.find(item => item.label === "Long head of triceps brachii (left)")!;
      expect(highlightAnatomyRig(rig, leftHead.id, true)).toBe(1);
      expect(rig.meshes.filter(mesh => mesh.visible)).toHaveLength(1);
      highlightAnatomyRig(rig, "none", true);
      expect(rig.meshes.filter(mesh => mesh.visible)).toHaveLength(784);
    } finally { rig.dispose(); }
  });

  it("keeps the resting shape and moves the arm with existing keyframes", () => {
    const rig = createAnatomyRig(source);
    try {
      poseAnatomyRig(rig, {});
      const arm = rig.meshes.find(mesh => mesh.name === "Lateral_head_of_triceps_brachiil")!;
      const calf = rig.meshes.find(mesh => mesh.name === "Tibialis_anterior_musclel")!;
      const atRest = arm.getVertexPosition(0, new Vector3()).clone();
      const original = new Vector3().fromBufferAttribute(arm.geometry.getAttribute("position"), 0);
      expect(atRest.distanceTo(original)).toBeLessThan(0.00001);
      const calfAtRest = calf.getVertexPosition(0, new Vector3()).clone();
      poseAnatomyRig(rig, sampleWorkshopPose(defaultScene.keyframes, 1600));
      expect(arm.getVertexPosition(0, new Vector3()).distanceTo(atRest)).toBeGreaterThan(0.1);
      expect(calf.getVertexPosition(0, new Vector3()).distanceTo(calfAtRest)).toBeLessThan(0.00001);
      // A second viewer has its own bones, materials and visibility.
      const other = createAnatomyRig(source);
      try {
        poseAnatomyRig(other, {});
        expect(other.bones["left-shoulder"].rotation.z).toBeCloseTo(0);
        expect(other.meshes[0].material).not.toBe(rig.meshes[0].material);
        expect(source.children.some(child => "isSkinnedMesh" in child)).toBe(false);
      } finally { other.dispose(); }
    } finally { rig.dispose(); }
  });
});
