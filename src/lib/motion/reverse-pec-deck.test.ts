import { describe, expect, it } from "vitest";
import { Group, Quaternion, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { applyStudioMachine, machineDemoScene, setPecDeckMode } from "./studio-machines";
import { studioLayoutSchema } from "./scene-schema";
import { readFile } from "node:fs/promises";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

describe("machine reference variants", () => {
  it("preserves the chosen muscles and authored timeline when switching pec deck modes", () => {
    const scene = machineDemoScene("pec-deck", "00000000-0000-4000-8000-000000000001");
    scene.studio!.presentation!.highlight = "group:abs";
    const reverse = setPecDeckMode(scene, scene.studio!.objects[0].id, "reverse");
    expect(reverse.studio!.presentation!.highlight).toBe("group:abs");
    expect(reverse.studio!.objects[0].machineMode).toBe("reverse");
    expect(reverse.studio!.objects[0].frames).toEqual(scene.studio!.objects[0].frames);
    expect(setPecDeckMode(reverse, scene.studio!.objects[0].id, "regular").studio!.presentation!.highlight).toBe("group:abs");
  });
  it("braces the row feet on diagonal plates with toes above heels", () => {
    const rig = createAnatomyRig(new Group());
    try {
      const scene = machineDemoScene("cable-row-machine", "00000000-0000-4000-8000-000000000001");
      applyStudioMachine(rig, scene, 0);
      for (const side of ["left", "right"] as const) {
        const foot = rig.footBones[side];
        const forward = new Vector3(0, 0, 1).applyQuaternion(foot.getWorldQuaternion(new Quaternion()));
        expect(forward.y).toBeGreaterThan(0.6);
        expect(foot.getWorldPosition(new Vector3()).z).toBeGreaterThan(0.9);
      }
    } finally { rig.dispose(); }
  });
  it("faces the chest support and opens both reverse fly arms smoothly", () => {
    const rig = createAnatomyRig(new Group());
    const scene = machineDemoScene("pec-deck", "00000000-0000-4000-8000-000000000001");
    Object.assign(scene.studio!.objects[0], { machineMode: "reverse" });
    try {
      let previous: Vector3 | undefined;
      for (let step = 0; step <= 64; step++) {
        poseAnatomyRig(rig, {}, true); applyStudioMachine(rig, scene, step * 75);
        expect(new Vector3(0, 0, 1).applyQuaternion(rig.root.quaternion).z).toBeLessThan(-0.99);
        const elbow = rig.bones["left-elbow"].getWorldPosition(new Vector3());
        if (previous) expect(elbow.distanceTo(previous)).toBeLessThan(0.07);
        previous = elbow;
        for (const side of ["left", "right"] as const) {
          const sign = side === "left" ? 1 : -1;
          const wrist = rig.handBones[side].getWorldPosition(new Vector3());
          if (step === 0 || step === 64) { expect(wrist.z).toBeLessThan(-0.65); expect(Math.abs(wrist.x)).toBeLessThan(0.3); }
          if (step === 32) { expect(wrist.x * sign).toBeLessThan(-1); expect(Math.abs(wrist.z)).toBeLessThan(0.25); }
        }
      }
    } finally { rig.dispose(); }
  });
  it("persists either pec deck mode and rejects modes on other equipment", () => {
    const scene = machineDemoScene("pec-deck", "00000000-0000-4000-8000-000000000001");
    for (const machineMode of ["regular", "reverse"]) {
      Object.assign(scene.studio!.objects[0], { machineMode });
      expect(studioLayoutSchema.safeParse(JSON.parse(JSON.stringify(scene.studio))).success).toBe(true);
    }
    Object.assign(scene.studio!.objects[0], { slug: "cable-row-machine" });
    expect(studioLayoutSchema.safeParse(scene.studio).success).toBe(false);
  });
  it("keeps rendered reverse fly soles, chest and fingers on their supports through the rep", async () => {
    const bytes = await readFile("public/models/z-anatomy/model.glb");
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    const rig = createAnatomyRig(gltf.scene);
    const scene = machineDemoScene("pec-deck", "00000000-0000-4000-8000-000000000001", "supinated", "reverse");
    try {
      for (let step = 0; step <= 32; step++) {
        poseAnatomyRig(rig, {}, true); applyStudioMachine(rig, scene, step * 150);
        rig.root.updateMatrixWorld(true); rig.skeleton.update();
        let soleY = Infinity, chestZ = Infinity, seatY = Infinity;
        for (const mesh of rig.meshes) {
          const positions = mesh.geometry.getAttribute("position");
          for (let vertex = 0; vertex < positions.count; vertex++) {
            const rest = new Vector3().fromBufferAttribute(positions, vertex);
            if (rest.y > 0.25 && !/pectoralis|gluteus_maximus/i.test(mesh.name)) continue;
            const point = mesh.localToWorld(mesh.getVertexPosition(vertex, new Vector3()));
            if (rest.y < 0.25) soleY = Math.min(soleY, point.y);
            if (/pectoralis/i.test(mesh.name) && point.y > 1.1 && point.y < 1.65 && Math.abs(point.x) < 0.22) chestZ = Math.min(chestZ, point.z);
            if (/gluteus_maximus/i.test(mesh.name) && Math.abs(point.z) < 0.25) seatY = Math.min(seatY, point.y);
          }
        }
        expect(soleY).toBeCloseTo(0, 3);
        expect(Math.abs(chestZ + 0.13)).toBeLessThan(0.01);
        expect(Math.abs(seatY - 0.655)).toBeLessThan(0.015);
        const before = scene.studio!.objects[0].frames![Math.floor(step / 2)];
        const after = scene.studio!.objects[0].frames![Math.ceil(step / 2)];
        const travel = (before.machinePosition! + after.machinePosition!) / 2;
        const angle = (-9 + 89 * travel) * Math.PI / 180;
        for (const side of ["left", "right"] as const) {
          const sign = side === "left" ? 1 : -1;
          const target = new Vector3(-sign * (0.289 + 0.955 * Math.sin(angle)), 1.55, 0.136 - 0.955 * Math.cos(angle));
          expect(rig.handBones[side].localToWorld(new Vector3(sign * 0.03, -0.11, 0.12)).distanceTo(target)).toBeLessThan(0.005);
          // Outward palms invert the vertical grip; the atlas thumb is lateral.
          const thumb = new Vector3(sign, 0, 0).applyQuaternion(rig.handBones[side].getWorldQuaternion(new Quaternion()));
          expect(thumb.y).toBeLessThan(-0.999);
          for (const mesh of rig.meshes.filter(mesh => /Distal_phalanx_of_.*_finger_of_hand/.test(mesh.name) && mesh.name.endsWith(side === "left" ? "l" : "r"))) {
            let nearest = Infinity;
            for (let vertex = 0; vertex < mesh.geometry.getAttribute("position").count; vertex++) {
              const point = mesh.localToWorld(mesh.getVertexPosition(vertex, new Vector3()));
              nearest = Math.min(nearest, Math.hypot(point.x - target.x, point.z - target.z));
            }
            expect(nearest).toBeGreaterThan(0.015); expect(nearest).toBeLessThan(0.035);
          }
        }
      }
    } finally { rig.dispose(); }
  });
});
