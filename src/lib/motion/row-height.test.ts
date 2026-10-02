import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { createQuickScene, generateMachineRepetition } from "./quick-create";
import { studioLayoutSchema } from "./scene-schema";
import { sampleStudioObject, setStudioObjectAnimated, updateStudioObjectTransform } from "./studio";
import { applyStudioMachine, machineCarriagePoint, machineDemoScene, setMachineHandleHeight, setMachinePosition } from "./studio-machines";

describe("independent cable row handle height", () => {
  it("changes the handle height without moving the seated machine", () => {
    const scene = createQuickScene("cable-row-machine");
    const raw = scene.studio!.objects[0];
    const object = { ...raw, frames: undefined, machineHandleHeight: 1.45 };
    expect(machineCarriagePoint(object).y).toBe(1.45);
    expect(machineCarriagePoint({ ...object, machinePosition: 0 }).z).not.toBe(machineCarriagePoint({ ...object, machinePosition: 1 }).z);
    expect(object.y).toBe(raw.y);
  });

  it("generates upward and downward repetitions preserving placement, poses and highlights", () => {
    for (const [start, finish] of [[1.1, 1.45], [1.45, 1.1]]) {
      const scene = createQuickScene("cable-row-machine");
      scene.studio!.presentation!.highlight = "group:abs";
      const raw = scene.studio!.objects[0];
      const updated = generateMachineRepetition(scene, raw.id, .15, .85, { start, finish });
      const object = updated.studio!.objects[0];
      expect(machineCarriagePoint(sampleStudioObject(object, 0)).y).toBeCloseTo(start);
      expect(machineCarriagePoint(sampleStudioObject(object, scene.durationMs / 2)).y).toBeCloseTo(finish);
      expect(machineCarriagePoint(sampleStudioObject(object, scene.durationMs)).y).toBeCloseTo(start);
      expect(updated.keyframes).toBe(scene.keyframes);
      expect(updated.studio!.presentation).toEqual(scene.studio!.presentation);
      for (const frame of object.frames!) expect([frame.x, frame.y, frame.z]).toEqual([raw.x, raw.y, raw.z]);
      expect(studioLayoutSchema.safeParse(updated.studio).success).toBe(true);
    }
  });

  it("keeps authored heights when changing travel, transforms or stopping animation", () => {
    const scene = createQuickScene("cable-row-machine");
    const raw = scene.studio!.objects[0];
    const changed = generateMachineRepetition(scene, raw.id, 0, 1, { start: 1.1, finish: 1.45 });
    const next = generateMachineRepetition(changed, raw.id, .1, .8).studio!.objects[0];
    const atFinish = sampleStudioObject(next, scene.durationMs / 2);
    expect(machineCarriagePoint(atFinish).y).toBeCloseTo(1.45);
    expect(machineCarriagePoint(sampleStudioObject(setMachinePosition(next, .4, scene.durationMs / 2), scene.durationMs / 2)).y).toBeCloseTo(1.45);
    const moved = updateStudioObjectTransform(next, { ...atFinish, x: 2 }, scene.durationMs / 2, true);
    expect(machineCarriagePoint(sampleStudioObject(moved, scene.durationMs / 2)).y).toBeCloseTo(1.45);
    expect(machineCarriagePoint(setStudioObjectAnimated(next, false, scene.durationMs / 2, [])).y).toBeCloseTo(1.45);
  });

  it("retains the legacy horizontal height when no height was authored", () => {
    const object = machineDemoScene("cable-row-machine", "00000000-0000-4000-8000-000000000001").studio!.objects[0];
    for (let i = 0; i <= 16; i++) expect(machineCarriagePoint(sampleStudioObject(object, i * 300)).y).toBe(1.23);
  });

  it("edits only the current handle-height moment and retains its travel and placement", () => {
    const scene = createQuickScene("cable-row-machine"), object = scene.studio!.objects[0];
    const time = scene.durationMs / 2;
    const updated = setMachineHandleHeight(object, 1.4, time);
    expect(machineCarriagePoint(sampleStudioObject(updated, time)).y).toBe(1.4);
    expect(machineCarriagePoint(sampleStudioObject(updated, 0)).y).toBe(1.23);
    expect(sampleStudioObject(updated, time).machinePosition).toBe(sampleStudioObject(object, time).machinePosition);
    expect(updated.frames!.filter(frame => frame.timeMs !== time)).toEqual(object.frames!.filter(frame => frame.timeMs !== time));
    expect(setMachineHandleHeight(object, NaN, time)).toBe(object);
    expect(machineCarriagePoint(setMachineHandleHeight({ ...object, frames: undefined }, 9, 0)).y).toBe(1.85);
  });

  it("rejects invalid heights and heights on other equipment", () => {
    const scene = createQuickScene("cable-row-machine"), object = scene.studio!.objects[0];
    for (const value of [null, -1, 2, "1.2", Infinity]) {
      expect(studioLayoutSchema.safeParse({ ...scene.studio, objects: [{ ...object, machineHandleHeight: value }] }).success).toBe(false);
    }
    const other = { ...object, slug: "pec-deck", machineHandleHeight: 1.4 };
    expect(studioLayoutSchema.safeParse({ ...scene.studio, objects: [other] }).success).toBe(false);
    expect(() => generateMachineRepetition(scene, object.id, 0, 1, { start: 1, finish: 2 })).toThrow();
  });

  it("keeps both actual atlas hands in contact across an angled repetition and a clean return", async () => {
    const bytes = await readFile("public/models/z-anatomy/model.glb");
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    const rig = createAnatomyRig(gltf.scene);
    const original = createQuickScene("cable-row-machine");
    try {
      for (const [start, finish] of [[1.1, 1.45], [1.45, 1.1]]) {
        const scene = generateMachineRepetition(original, original.studio!.objects[0].id, .15, .85, { start, finish });
        const firstHands: Vector3[] = [];
        let previous: Vector3[] | undefined;
        for (let i = 0; i <= 32; i++) {
          poseAnatomyRig(rig, {}, true);
          const report = applyStudioMachine(rig, scene, i * scene.durationMs / 32)!;
          expect(report.hands.every(hand => hand.contactError < .005)).toBe(true);
          const hands = [rig.handBones.left, rig.handBones.right].map(hand => hand.getWorldPosition(new Vector3()));
          if (i === 0) firstHands.push(...hands.map(hand => hand.clone()));
          if (previous) hands.forEach((hand, index) => expect(hand.distanceTo(previous![index])).toBeLessThan(.12));
          if (i === 32) hands.forEach((hand, index) => expect(hand.distanceTo(firstHands[index])).toBeLessThan(1e-6));
          previous = hands;
        }
      }
    } finally { rig.dispose(); }
  });
});
