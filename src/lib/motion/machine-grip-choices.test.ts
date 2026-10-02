import { describe, expect, it } from "vitest";
import { studioLayoutSchema } from "./scene-schema";
import { machineDemoScene } from "./studio-machines";
import { applyStudioMachine, machineHandlePoint, setMachineGripChoices } from "./studio-machines";
import { readFile } from "node:fs/promises";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Group, Quaternion, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { sampleStudioObject, studioPointToWorld } from "./studio";

describe("independent machine palm and elbow choices", () => {
  it("round trips every independent choice without replacing creator highlights", () => {
    for (const slug of ["cable-row-machine", "pec-deck"] as const) {
      const scene = machineDemoScene(slug, "00000000-0000-4000-8000-000000000001");
      scene.studio!.presentation!.highlight = "mesh:Deliberately_chosen_l";
      for (const machinePalm of ["inward", "outward"]) for (const machineElbowPath of ["beside-body", "shoulder-height"]) {
        const layout = { ...scene.studio!, objects: [{ ...scene.studio!.objects[0], machinePalm, machineElbowPath }] };
        expect(studioLayoutSchema.parse(JSON.parse(JSON.stringify(layout)))).toEqual(layout);
      }
    }
  });
  it("rejects nulls, unknown choices and choices on other equipment with useful paths", () => {
    const studio = machineDemoScene("cable-row-machine", "00000000-0000-4000-8000-000000000001").studio!;
    for (const [key, value] of [["machinePalm", null], ["machinePalm", "neutral"], ["machineElbowPath", null], ["machineElbowPath", "wide"]]) {
      expect(studioLayoutSchema.safeParse({ ...studio, objects: [{ ...studio.objects[0], [String(key)]: value }] }).success).toBe(false);
    }
    for (const key of ["machinePalm", "machineElbowPath"] as const) {
      const result = studioLayoutSchema.safeParse({ ...studio, objects: [{ ...studio.objects[0], slug: "smith-machine", [key]: key === "machinePalm" ? "inward" : "beside-body" }] });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues.some(issue => issue.path.join(".") === `objects.0.${key}`)).toBe(true);
    }
  });
  it("changes only the requested choice, retaining creator highlights and the source motion", () => {
    const scene = machineDemoScene("pec-deck", "00000000-0000-4000-8000-000000000001");
    scene.studio!.presentation!.highlight = "group:abs";
    const updated = setMachineGripChoices(scene, scene.studio!.objects[0].id, { machinePalm: "outward" });
    expect(updated.studio!.presentation).toEqual(scene.studio!.presentation);
    expect(updated.keyframes).toBe(scene.keyframes);
    expect(updated.studio!.objects[0].frames).toBe(scene.studio!.objects[0].frames);
    expect(updated.studio!.objects[0].machineElbowPath).toBeUndefined();
    expect(scene.studio!.objects[0].machinePalm).toBeUndefined();
  });
  it.each(["row", "regular", "reverse"] as const)("preserves the legacy %s defaults and makes palm orientation independent of the elbow choice", variant => {
    const rig = createAnatomyRig(new Group());
    const scene = machineDemoScene(variant === "row" ? "cable-row-machine" : "pec-deck", "00000000-0000-4000-8000-000000000001", "supinated", variant === "reverse" ? "reverse" : "regular");
    try {
      for (const time of [0, 1200, 2400, 3600, 4800]) {
        poseAnatomyRig(rig, {}, true); applyStudioMachine(rig, scene, time);
        const legacy = [rig.handBones.left, rig.bones["left-elbow"]].map(bone => ({ position: bone.getWorldPosition(new Vector3()), rotation: bone.getWorldQuaternion(new Quaternion()) }));
        Object.assign(scene.studio!.objects[0], { machinePalm: variant === "reverse" ? "outward" : "inward", machineElbowPath: variant === "row" ? "beside-body" : "shoulder-height" });
        poseAnatomyRig(rig, {}, true); applyStudioMachine(rig, scene, time);
        [rig.handBones.left, rig.bones["left-elbow"]].forEach((bone, i) => {
          expect(bone.getWorldPosition(new Vector3()).distanceTo(legacy[i].position)).toBeLessThan(1e-8);
          expect(bone.getWorldQuaternion(new Quaternion()).angleTo(legacy[i].rotation)).toBeLessThan(1e-6);
        });
        const palms: Vector3[] = [];
        for (const machinePalm of ["inward", "outward"] as const) {
          const orientations: Quaternion[] = [];
          for (const machineElbowPath of ["beside-body", "shoulder-height"] as const) {
            Object.assign(scene.studio!.objects[0], { machinePalm, machineElbowPath });
            poseAnatomyRig(rig, {}, true); applyStudioMachine(rig, scene, time);
            orientations.push(rig.handBones.left.getWorldQuaternion(new Quaternion()));
          }
          expect(orientations[0].angleTo(orientations[1])).toBeLessThan(1e-6);
          palms.push(new Vector3(0, 0, 1).applyQuaternion(orientations[0]));
        }
        expect(palms[0].dot(palms[1])).toBeLessThan(-0.999);
        delete scene.studio!.objects[0].machinePalm; delete scene.studio!.objects[0].machineElbowPath;
      }
    } finally { rig.dispose(); }
  });
  it("reports an actual reach failure without stretching the arm", () => {
    const rig = createAnatomyRig(new Group());
    const scene = machineDemoScene("cable-row-machine", "00000000-0000-4000-8000-000000000001");
    try {
      for (const side of ["left", "right"] as const) {
        rig.bones[`${side}-elbow`].position.multiplyScalar(0.25);
        rig.handBones[side].position.multiplyScalar(0.25);
      }
      const report = applyStudioMachine(rig, scene, 0)!;
      expect(report.hands.every(hand => hand.contactError > 0.005)).toBe(true);
      expect(report.warnings.filter(warning => warning.kind === "reach")).toHaveLength(2);
      expect(report.warnings.every(warning => warning.repair.length > 0)).toBe(true);
    } finally { rig.dispose(); }
  });
  it.each(["row", "regular", "reverse"] as const)("moves %s elbows continuously when the requested plane becomes unreachable", variant => {
    const rig = createAnatomyRig(new Group());
    const scene = machineDemoScene(variant === "row" ? "cable-row-machine" : "pec-deck", "00000000-0000-4000-8000-000000000001", "supinated", variant === "reverse" ? "reverse" : "regular");
    try {
      for (const machinePalm of ["inward", "outward"] as const) for (const machineElbowPath of ["beside-body", "shoulder-height"] as const) {
        Object.assign(scene.studio!.objects[0], { machinePalm, machineElbowPath });
        let previous: Vector3 | undefined;
        for (let step = 0; step <= 64; step++) {
          poseAnatomyRig(rig, {}, true); applyStudioMachine(rig, scene, step * 75);
          const elbow = rig.bones["left-elbow"].getWorldPosition(new Vector3());
          if (previous) expect(elbow.distanceTo(previous), `${variant} ${machinePalm} ${machineElbowPath} at ${step * 75}ms`).toBeLessThan(0.12);
          previous = elbow;
        }
      }
    } finally { rig.dispose(); }
  });
  it.each(["row", "regular", "reverse"] as const)("keeps actual atlas %s hands on handles across independent choices, with honest wrist/path reports", async variant => {
    const bytes = await readFile("public/models/z-anatomy/model.glb");
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    const rig = createAnatomyRig(gltf.scene);
    const scene = machineDemoScene(variant === "row" ? "cable-row-machine" : "pec-deck", "00000000-0000-4000-8000-000000000001", "supinated", variant === "reverse" ? "reverse" : "regular");
    const times = [...new Set([...Array.from({ length: 17 }, (_, i) => i * scene.durationMs / 16), ...scene.keyframes.map(frame => frame.timeMs), 75, 2325, 2475, 4725])].sort((a, b) => a - b);
    try {
      for (const scale of [0.75, 1, 1.3]) for (const machinePalm of ["inward", "outward"] as const) for (const machineElbowPath of ["beside-body", "shoulder-height"] as const) {
        const raw = scene.studio!.objects[0];
        Object.assign(raw, { machinePalm, machineElbowPath });
        raw.frames = raw.frames!.map(frame => ({ ...frame, scale, x: 1.1, z: -0.4, rotationY: 35 }));
        for (const time of times) {
          poseAnatomyRig(rig, {}, true);
          const report = applyStudioMachine(rig, scene, time)!;
          rig.root.updateMatrixWorld(true); rig.skeleton.update();
          expect(report.objectId).toBe(scene.studio!.objects[0].id);
          for (const side of ["left", "right"] as const) {
            const hand = rig.handBones[side], elbow = rig.bones[`${side}-elbow`], shoulder = rig.bones[`${side}-shoulder`];
            const sign = side === "left" ? 1 : -1;
            const target = studioPointToWorld(machineHandlePoint(sampleStudioObject(scene.studio!.objects[0], time), side), sampleStudioObject(scene.studio!.objects[0], time));
            const error = hand.localToWorld(new Vector3(sign * 0.03, -0.11, 0.12)).distanceTo(target);
            const actual = report.hands.find(value => value.side === side)!;
            expect(actual.contactError).toBeCloseTo(error, 6);
            if (error > 0.005 * scale) expect(report.warnings.some(warning => warning.side === side && warning.kind === "reach")).toBe(true);
            else {
              expect(error).toBeLessThan(0.005 * scale);
              for (const mesh of rig.meshes.filter(mesh => /Distal_phalanx_of_.*_finger_of_hand/.test(mesh.name) && mesh.name.endsWith(side === "left" ? "l" : "r"))) {
                let nearest = Infinity;
                for (let vertex = 0; vertex < mesh.geometry.getAttribute("position").count; vertex++) {
                  const point = mesh.localToWorld(mesh.getVertexPosition(vertex, new Vector3()));
                  nearest = Math.min(nearest, Math.hypot(point.x - target.x, point.z - target.z));
                }
                expect(nearest / scale, `${variant} ${machinePalm} ${machineElbowPath} ${time} ${mesh.name}`).toBeGreaterThan(0.015);
                expect(nearest / scale).toBeLessThan(0.035);
              }
            }
            const bend = new Vector3(0, -1, 0).applyQuaternion(hand.getWorldQuaternion(new Quaternion())).angleTo(hand.getWorldPosition(new Vector3()).sub(elbow.getWorldPosition(new Vector3()))) * 180 / Math.PI;
            expect(actual.wristBendDegrees).toBeCloseTo(bend, 4);
            if (bend > 45) expect(report.warnings.some(warning => warning.side === side && warning.kind === "wrist")).toBe(true);
            expect(elbow.getWorldPosition(new Vector3()).distanceTo(shoulder.getWorldPosition(new Vector3()))).toBeCloseTo(elbow.position.length() * rig.root.scale.x, 5);
            expect(hand.getWorldPosition(new Vector3()).distanceTo(elbow.getWorldPosition(new Vector3()))).toBeCloseTo(hand.position.length() * rig.root.scale.x, 5);
          }
        }
      }
    } finally { rig.dispose(); }
  });
});
