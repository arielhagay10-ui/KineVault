import { describe, expect, it } from "vitest";
import { createStudioObject, sampleStudioObject, setStudioObjectAnimated, updateStudioObjectTransform } from "./studio";
import { studioLayoutSchema } from "./scene-schema";
import { identityTransform } from "./workshop";
import { Group, Quaternion, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { applyStudioMachine, machineCarriagePoint, machineDemoScene, setMachinePosition } from "./studio-machines";
import { studioGripOffset } from "./studio-grip";
import { studioPointToWorld } from "./studio";
import { readFile } from "node:fs/promises";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

describe("studio machines", () => {
  it("round trips a pulldown grip and rejects it on other equipment", () => {
    const scene = machineDemoScene("lat-pulldown-machine", "00000000-0000-4000-8000-000000000001");
    const object = scene.studio!.objects[0];
    for (const machineGrip of ["supinated", "pronated"] as const) {
      const layout = { ...scene.studio!, objects: [{ ...object, machineGrip }] };
      expect(studioLayoutSchema.parse(JSON.parse(JSON.stringify(layout))).objects[0]).toHaveProperty("machineGrip", machineGrip);
    }
    for (const changes of [{ machineGrip: "neutral" }, { machineGrip: "pronated", slug: "smith-machine" }]) {
      expect(studioLayoutSchema.safeParse({ ...scene.studio!, objects: [{ ...object, ...changes }] }).success).toBe(false);
    }
  });
  it("uses overhand palms with frontal shoulder motion throughout the pronated pulldown", () => {
    const scene = machineDemoScene("lat-pulldown-machine", "00000000-0000-4000-8000-000000000001");
    Object.assign(scene.studio!.objects[0], { machineGrip: "pronated" });
    const rig = createAnatomyRig(new Group());
    try {
      for (let step = 0; step <= 32; step++) {
        poseAnatomyRig(rig, {}, true); applyStudioMachine(rig, scene, step * 150);
        for (const side of ["left", "right"] as const) {
          const elbow = rig.bones[`${side}-elbow`].getWorldPosition(new Vector3());
          const shoulder = rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3());
          expect(Math.abs(elbow.z - shoulder.z)).toBeLessThan(0.005);
          const palm = new Vector3(0, 0, 1).applyQuaternion(rig.handBones[side].getWorldQuaternion(new Quaternion()));
          expect(palm.z).toBeGreaterThan(0.2);
          const carriage = machineCarriagePoint(sampleStudioObject(scene.studio!.objects[0], step * 150));
          const grip = new Vector3(side === "left" ? 0.48 : -0.48, carriage.y, carriage.z);
          expect(rig.handBones[side].localToWorld(new Vector3(side === "left" ? 0.03 : -0.03, -0.11, 0.12)).distanceTo(grip)).toBeLessThan(0.005);
        }
      }
    } finally { rig.dispose(); }
  });
  it("keeps Smith elbows below the shoulder with a natural back-bar wrist angle", () => {
    const scene = machineDemoScene("smith-machine", "00000000-0000-4000-8000-000000000001");
    const rig = createAnatomyRig(new Group());
    try {
      for (let step = 0; step <= 32; step++) {
        poseAnatomyRig(rig, {}, true); applyStudioMachine(rig, scene, step * 150);
        for (const side of ["left", "right"] as const) {
          const shoulder = rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3());
          const elbow = rig.bones[`${side}-elbow`].getWorldPosition(new Vector3());
          expect(elbow.y).toBeLessThan(shoulder.y - 0.3);
          expect(elbow.z).toBeLessThan(shoulder.z);
          expect(rig.handBones[side].quaternion.angleTo(new Quaternion())).toBeLessThan(35 * Math.PI / 180);
        }
      }
    } finally { rig.dispose(); }
  });
  it("closes the rendered Smith fingertips around the bar rather than floating", async () => {
    const bytes = await readFile("public/models/z-anatomy/model.glb");
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    const rig = createAnatomyRig(gltf.scene);
    const scene = machineDemoScene("smith-machine", "00000000-0000-4000-8000-000000000001");
    try {
      for (const time of [0, 2400, 4800]) {
        poseAnatomyRig(rig, {}, true); applyStudioMachine(rig, scene, time);
        // Three's render traversal refreshes SkinnedMesh bind inverses.
        rig.root.updateMatrixWorld(true); rig.skeleton.update();
        const bar = machineCarriagePoint(sampleStudioObject(scene.studio!.objects[0], time));
        const tips = rig.meshes.filter(mesh => /Distal_phalanx_of_(first|second|third|fourth|fifth)_finger_of_hand/.test(mesh.name));
        expect(tips.length).toBe(10);
        for (const mesh of tips) {
          let nearest = Infinity;
          for (let vertex = 0; vertex < mesh.geometry.getAttribute("position").count; vertex++) {
            const point = mesh.localToWorld(mesh.getVertexPosition(vertex, new Vector3()));
            nearest = Math.min(nearest, Math.hypot(point.y - bar.y, point.z - bar.z));
          }
          expect(nearest, mesh.name).toBeLessThan(0.035);
          expect(nearest, mesh.name).toBeGreaterThan(0.015);
        }
      }
    } finally { rig.dispose(); }
  });
  it("keeps the frontal pulldown shaft across closed fingers through the rep", async () => {
    const bytes = await readFile("public/models/z-anatomy/model.glb");
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    const rig = createAnatomyRig(gltf.scene);
    const scene = machineDemoScene("lat-pulldown-machine", "00000000-0000-4000-8000-000000000001", "pronated");
    try {
      for (let step = 0; step <= 32; step++) {
        poseAnatomyRig(rig, {}, true); applyStudioMachine(rig, scene, step * 150);
        rig.root.updateMatrixWorld(true); rig.skeleton.update();
        for (const side of ["left", "right"] as const) {
          const shaft = new Vector3(1, 0, 0).applyQuaternion(rig.handBones[side].getWorldQuaternion(new Quaternion()));
          expect(Math.abs(shaft.x)).toBeGreaterThan(0.999);
          expect(rig.handBones[side].quaternion.angleTo(new Quaternion())).toBeLessThan(35 * Math.PI / 180);
        }
        const bar = machineCarriagePoint(sampleStudioObject(scene.studio!.objects[0], step * 150));
        for (const mesh of rig.meshes.filter(mesh => /Distal_phalanx_of_.*_finger_of_hand/.test(mesh.name))) {
          let nearest = Infinity;
          for (let vertex = 0; vertex < mesh.geometry.getAttribute("position").count; vertex++) {
            const point = mesh.localToWorld(mesh.getVertexPosition(vertex, new Vector3()));
            nearest = Math.min(nearest, Math.hypot(point.y - bar.y, point.z - bar.z));
          }
          expect(nearest, mesh.name).toBeLessThan(0.035);
          expect(nearest, mesh.name).toBeGreaterThan(0.015);
        }
      }
    } finally { rig.dispose(); }
  });
  it.each(["lat-pulldown-machine", "smith-machine", "leg-press"] as const)("accepts and reloads %s with independent carriage movement", slug => {
    const object = { ...createStudioObject(slug, "00000000-0000-4000-8000-000000000001", 0), machineUse: true, machinePosition: 0,
      frames: [{ ...identityTransform, timeMs: 0, machinePosition: 0 }, { ...identityTransform, timeMs: 1600, machinePosition: 1 }, { ...identityTransform, timeMs: 3200, machinePosition: 0 }] };
    const saved = studioLayoutSchema.parse(JSON.parse(JSON.stringify({ body: identityTransform, objects: [object] })));
    expect(sampleStudioObject(saved.objects[0], 800).machinePosition).toBe(0.5);
    expect(sampleStudioObject(saved.objects[0], 2400).machinePosition).toBe(0.5);
    expect(sampleStudioObject(saved.objects[0], 3200).machinePosition).toBe(0);
  });
  it("rejects invalid carriage travel and machine controls on other objects", () => {
    const object = createStudioObject("bench", "00000000-0000-4000-8000-000000000001", 0);
    for (const changes of [{ machinePosition: 0.5 }, { machineUse: true }, { slug: "leg-press", machinePosition: 1.1 }, { slug: "leg-press", frames: [{ ...identityTransform, timeMs: 0, machinePosition: -1 }] }]) {
      expect(studioLayoutSchema.safeParse({ body: identityTransform, objects: [{ ...object, ...changes }] }).success).toBe(false);
    }
  });
  it("edits carriage keyframes without moving the frame, and retains travel when animation is flattened", () => {
    const scene = machineDemoScene("smith-machine", "00000000-0000-4000-8000-000000000001");
    const object = setMachinePosition(scene.studio!.objects[0], 0.4, 600);
    expect(sampleStudioObject(object, 600).machinePosition).toBe(0.4);
    expect(sampleStudioObject(object, 600).y).toBe(0);
    expect(setStudioObjectAnimated(object, false, 600, []).machinePosition).toBe(0.4);
    const transform = sampleStudioObject(object, 750);
    expect(sampleStudioObject(updateStudioObjectTransform(object, transform, 750, true), 750).machinePosition).toBeCloseTo(transform.machinePosition!);
  });
  it.each(["lat-pulldown-machine", "smith-machine", "leg-press"] as const)("keeps %s grips and feet in contact for a full cycle, after placement and resizing", slug => {
    const scene = machineDemoScene(slug, "00000000-0000-4000-8000-000000000001");
    const rig = createAnatomyRig(new Group());
    const body = new Group(); body.add(rig.root);
    try {
      for (const scale of [0.75, 1, 1.3]) {
        const raw = scene.studio!.objects[0]; raw.scale = scale; raw.x = 1.2; raw.z = -0.5; raw.rotationY = 35;
        raw.frames = raw.frames!.map(frame => ({ ...frame, scale, x: raw.x, z: raw.z, rotationY: raw.rotationY }));
        for (let step = 0; step <= 32; step++) {
          const time = step / 32 * scene.durationMs;
          poseAnatomyRig(rig, { torso: { x: step % 2 ? 35 : -35, y: 30, z: 20 } }, true); body.updateMatrixWorld(true); applyStudioMachine(rig, scene, time);
          expect(rig.bones.torso.quaternion.angleTo(new Quaternion())).toBeLessThan(0.00001);
          const object = sampleStudioObject(raw, time), carriage = machineCarriagePoint(object);
          for (const side of ["left", "right"] as const) {
            const sign = side === "left" ? 1 : -1;
            const target = slug === "leg-press" ? { x: sign * 0.36, y: 0.74, z: -0.32 } : { x: sign * (slug === "smith-machine" ? 0.56 : 0.48), y: carriage.y, z: carriage.z };
            const offset = slug === "smith-machine" ? new Vector3(sign * 0.03, -0.11, 0.12) : studioGripOffset(side);
            expect(rig.handBones[side].localToWorld(offset).distanceTo(studioPointToWorld(target, object))).toBeLessThan(0.005);
            expect(rig.handBones[side].quaternion.angleTo(new Quaternion())).toBeLessThan(slug === "smith-machine" ? 35 * Math.PI / 180 : 0.00001);
            if (slug === "smith-machine") {
              const shoulder = rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3());
              const bar = studioPointToWorld({ x: 0, y: carriage.y, z: carriage.z }, object);
              expect(shoulder.y - bar.y).toBeGreaterThan(0);
              expect(shoulder.y - bar.y).toBeLessThan(0.05 * scale);
            }
            const foot = slug === "leg-press" ? { x: sign * 0.17, y: carriage.y - 0.085, z: carriage.z - 0.085 } : { x: sign * 0.17, y: 0.119, z: slug === "smith-machine" ? 0.22 : 0.6 };
            expect(rig.footBones[side].getWorldPosition(new Vector3()).distanceTo(studioPointToWorld(foot, object))).toBeLessThan(0.005);
            if (slug === "leg-press") {
              const sole = new Vector3(0, -1, 0).applyQuaternion(rig.footBones[side].getWorldQuaternion(new Quaternion()));
              const normal = new Vector3(0, Math.SQRT1_2, Math.SQRT1_2).applyAxisAngle(new Vector3(0, 1, 0), raw.rotationY * Math.PI / 180);
              expect(sole.dot(normal)).toBeGreaterThan(0.999);
            }
          }
        }
      }
    } finally { rig.dispose(); }
  });
});
