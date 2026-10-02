import { describe, expect, it } from "vitest";
import { Group, Quaternion, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { studioLayoutSchema } from "./scene-schema";
import { applyStudioMachine, machineDemoScene, type MachineSlug } from "./studio-machines";
import { studioPointToWorld } from "./studio";
import { readFile } from "node:fs/promises";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

describe("cable row and pec deck", () => {
  it("rows with elbows beside the torso in the sagittal plane", () => {
    const rig = createAnatomyRig(new Group());
    const scene = machineDemoScene("cable-row-machine", "00000000-0000-4000-8000-000000000001");
    try {
      for (let step = 0; step <= 64; step++) {
        poseAnatomyRig(rig, {}, true); applyStudioMachine(rig, scene, step * 75);
        for (const side of ["left", "right"] as const) {
          const shoulder = rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3());
          const elbow = rig.bones[`${side}-elbow`].getWorldPosition(new Vector3());
          expect(Math.abs(elbow.x - shoulder.x)).toBeLessThan(0.005);
          if (step === 32) { expect(elbow.y).toBeLessThan(1.25); expect(elbow.z).toBeLessThan(0.05); }
          const thumb = new Vector3(side === "left" ? 1 : -1, 0, 0).applyQuaternion(rig.handBones[side].getWorldQuaternion(new Quaternion()));
          expect(thumb.y).toBeGreaterThan(0.99);
        }
      }
    } finally { rig.dispose(); }
  });
  it.each(["regular", "reverse"] as const)("uses the requested %s pec deck palm direction without drooping elbows", mode => {
    const rig = createAnatomyRig(new Group());
    const scene = machineDemoScene("pec-deck", "00000000-0000-4000-8000-000000000001", "supinated", mode);
    try {
      for (let step = 0; step <= 64; step++) {
        poseAnatomyRig(rig, {}, true); applyStudioMachine(rig, scene, step * 75);
        for (const side of ["left", "right"] as const) {
          const hand = rig.handBones[side], elbow = rig.bones[`${side}-elbow`].getWorldPosition(new Vector3());
          expect(elbow.y).toBeGreaterThan(1.5);
          const palm = new Vector3(0, 0, 1).applyQuaternion(hand.getWorldQuaternion(new Quaternion())).applyQuaternion(rig.root.quaternion.clone().invert());
          if ((mode === "regular" && step === 32) || (mode === "reverse" && step === 0)) {
            expect(palm.x * (side === "left" ? 1 : -1) * (mode === "regular" ? -1 : 1)).toBeGreaterThan(0.95);
          }
        }
      }
    } finally { rig.dispose(); }
  });
  it.each(["cable-row-machine", "pec-deck"] as const)("uses a complete %s range without elbow branch jumps", slug => {
    const rig = createAnatomyRig(new Group());
    const scene = machineDemoScene(slug, "00000000-0000-4000-8000-000000000001");
    const previous = new Vector3();
    try {
      for (let step = 0; step <= 64; step++) {
        poseAnatomyRig(rig, {}, true); applyStudioMachine(rig, scene, step * 75);
        const shoulder = rig.bones["left-shoulder"].getWorldPosition(new Vector3());
        const elbow = rig.bones["left-elbow"].getWorldPosition(new Vector3());
        const wrist = rig.handBones.left.getWorldPosition(new Vector3());
        const flexion = 180 - shoulder.clone().sub(elbow).angleTo(wrist.clone().sub(elbow)) * 180 / Math.PI;
        if (slug === "pec-deck") { expect(flexion).toBeGreaterThan(25); expect(flexion).toBeLessThan(50); }
        else if (step === 0 || step === 64) expect(flexion).toBeLessThan(35);
        else if (step === 32) expect(flexion).toBeGreaterThan(110);
        if (step > 0) expect(elbow.distanceTo(previous)).toBeLessThan(0.07);
        previous.copy(elbow);
      }
    } finally { rig.dispose(); }
  });
  it.each(["cable-row-machine", "pec-deck"] as const)("wraps rendered %s fingertips around vertical handles with thumbs upward", async slug => {
    const bytes = await readFile("public/models/z-anatomy/model.glb");
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    const rig = createAnatomyRig(gltf.scene);
    const scene = machineDemoScene(slug, "00000000-0000-4000-8000-000000000001");
    try {
      for (let step = 0; step <= 16; step++) {
        poseAnatomyRig(rig, {}, true); applyStudioMachine(rig, scene, step * 300);
        rig.root.updateMatrixWorld(true); rig.skeleton.update();
        const travel = (1 - Math.cos(step / 16 * Math.PI * 2)) / 2;
        const angle = (80 - 89 * travel) * Math.PI / 180;
        let soleY = Infinity, solePlane = Infinity, seatY = Infinity, backZ = Infinity;
        for (const mesh of rig.meshes) {
          const positions = mesh.geometry.getAttribute("position");
          for (let vertex = 0; vertex < positions.count; vertex++) {
            const rest = new Vector3().fromBufferAttribute(positions, vertex);
            if (rest.y > 0.25 && !/Gluteus_maximus|Latissimus|Trapezius/.test(mesh.name)) continue;
            const point = mesh.localToWorld(mesh.getVertexPosition(vertex, new Vector3()));
            if (rest.y < 0.25) soleY = Math.min(soleY, point.y);
            if (rest.y < 0.25) solePlane = Math.min(solePlane, ((point.y - 0.24) - (point.z - 1.12)) * Math.SQRT1_2);
            if (/Gluteus_maximus/.test(mesh.name) && Math.abs(point.z) < 0.25) seatY = Math.min(seatY, point.y);
            if (/Latissimus|Trapezius/.test(mesh.name) && point.y > 1.1 && point.y < 1.65 && Math.abs(point.x) < 0.22) backZ = Math.min(backZ, point.z);
          }
        }
        if (slug === "cable-row-machine") expect(solePlane).toBeCloseTo(0.025, 3);
        else expect(soleY).toBeCloseTo(0, 3);
        expect(Math.abs(seatY - (slug === "cable-row-machine" ? 0.677 : 0.655))).toBeLessThan(0.015);
        if (slug === "pec-deck") expect(Math.abs(backZ + 0.13)).toBeLessThan(0.01);
        for (const side of ["left", "right"] as const) {
          const sign = side === "left" ? 1 : -1;
          const target = slug === "cable-row-machine" ? new Vector3(sign * 0.15, 1.23, 0.88 - travel * 0.58)
            : new Vector3(sign * (0.289 + 0.955 * Math.sin(angle)), 1.55, 0.955 * Math.cos(angle));
          // The actual atlas thumb is lateral (+X on the left, -X on the right).
          const thumbUp = new Vector3(sign, 0, 0).applyQuaternion(rig.handBones[side].getWorldQuaternion(new Quaternion()));
          expect(thumbUp.y).toBeGreaterThan(0.999);
          for (const mesh of rig.meshes.filter(mesh => /Distal_phalanx_of_.*_finger_of_hand/.test(mesh.name) && mesh.name.endsWith(side === "left" ? "l" : "r"))) {
            let nearest = Infinity;
            for (let vertex = 0; vertex < mesh.geometry.getAttribute("position").count; vertex++) {
              const point = mesh.localToWorld(mesh.getVertexPosition(vertex, new Vector3()));
              nearest = Math.min(nearest, Math.hypot(point.x - target.x, point.z - target.z));
            }
            expect(nearest, `${slug} ${step} ${mesh.name}`).toBeLessThan(0.035);
            expect(nearest, `${slug} ${step} ${mesh.name}`).toBeGreaterThan(0.015);
          }
        }
      }
    } finally { rig.dispose(); }
  });
  it.each(["cable-row-machine", "pec-deck"])("saves %s travel and keeps both grips, seat and feet in contact", slug => {
    const scene = machineDemoScene(slug as MachineSlug, "00000000-0000-4000-8000-000000000001");
    expect(studioLayoutSchema.safeParse(JSON.parse(JSON.stringify(scene.studio))).success).toBe(true);
    const rig = createAnatomyRig(new Group());
    try {
      for (const scale of [0.75, 1, 1.3]) {
        const raw = scene.studio!.objects[0];
        raw.frames = raw.frames!.map(frame => ({ ...frame, scale, x: 1.1, z: -0.4, rotationY: 35 }));
        for (let step = 0; step <= 32; step++) {
          const timeMs = step * 150, travel = (1 - Math.cos(step / 32 * Math.PI * 2)) / 2;
          const placement = { ...raw, ...raw.frames[0] };
          poseAnatomyRig(rig, {}, true);
          applyStudioMachine(rig, scene, timeMs);
          expect(rig.bones.pelvis.getWorldPosition(new Vector3()).distanceTo(studioPointToWorld({ x: 0, y: 0.82, z: 0 }, placement))).toBeLessThan(0.005);
          for (const side of ["left", "right"] as const) {
            const sign = side === "left" ? 1 : -1;
            // Interpolation between the 17 authored samples stays close to this analytic cycle.
            const angle = ((80 - 89 * travel)) * Math.PI / 180;
            const target = slug === "cable-row-machine" ? { x: sign * 0.15, y: 1.23, z: 0.88 - travel * 0.58 }
              : { x: sign * (0.289 + 0.955 * Math.sin(angle)), y: 1.55, z: 0.955 * Math.cos(angle) };
            expect(rig.handBones[side].localToWorld(new Vector3(sign * 0.03, -0.11, 0.12)).distanceTo(studioPointToWorld(target, placement))).toBeLessThan(0.02 * scale);
            const handDirection = new Vector3(0, -1, 0).applyQuaternion(rig.handBones[side].getWorldQuaternion(new Quaternion()));
            const forearmDirection = rig.handBones[side].getWorldPosition(new Vector3()).sub(rig.bones[`${side}-elbow`].getWorldPosition(new Vector3()));
            expect(handDirection.angleTo(forearmDirection) * 180 / Math.PI).toBeLessThan(slug === "cable-row-machine" ? 20 : 40);
            const foot = { x: sign * 0.17, y: slug === "cable-row-machine" ? 0.2958614357 : 0.119, z: slug === "cable-row-machine" ? 0.9722146827 : 0.6 };
            expect(rig.footBones[side].getWorldPosition(new Vector3()).distanceTo(studioPointToWorld(foot, placement))).toBeLessThan(0.005);
          }
        }
      }
    } finally { rig.dispose(); }
  });
});


