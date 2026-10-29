import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { createQuickScene, equipmentGroup, searchWorkshopEquipment, workshopEquipmentOptions } from "./quick-create";
import { studioLayoutSchema } from "./scene-schema";
import { createStudioObject } from "./studio";
import { machineCarriagePoint, machineGripPoint, machineHandlePoint, machineLever } from "./studio-machines";
import { identityTransform, type StudioObject } from "./workshop";
import { Group } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { applyStudioMachine } from "./studio-machines";
import { machineDragValues } from "./workshop-mouse";
import { studioGripOffset } from "./studio-grip";
import { applyStudioSupports, supportContactPoint } from "./support-contacts";
import { sampleHeldWeightPose } from "./held-weight-pose";
import { workshopSceneSchema } from "./scene-schema";

describe("versatile equipment", () => {
  it.each(["row-machine", "shoulder-press-machine", "stool", "plyo-box", "resistance-band"])("discovers and round trips %s", slug => {
    expect(workshopEquipmentOptions().some(item => item.slug === slug)).toBe(true);
    const scene = createQuickScene(slug);
    expect(studioLayoutSchema.safeParse(JSON.parse(JSON.stringify(scene.studio))).success).toBe(true);
  });

  it("finds props and machines through familiar names", () => {
    const options = workshopEquipmentOptions();
    for (const [query, slug] of [["plate loaded row", "row-machine"], ["shoulder press", "shoulder-press-machine"], ["jump box", "plyo-box"], ["elastic band", "resistance-band"], ["stool", "stool"]]) {
      expect(searchWorkshopEquipment(options, query)[0]?.slug).toBe(slug);
    }
    expect(equipmentGroup("stool")).toBe("Supports");
    expect(equipmentGroup("plyo-box")).toBe("Supports");
    expect(equipmentGroup("resistance-band")).toBe("Weights");
  });

  it("lets Smith bars cover a low pull or overhead press without moving the frame", () => {
    const object = { ...createStudioObject("smith-machine", crypto.randomUUID(), 0), machineRange: { min: .4, max: 2.8 } };
    expect(machineCarriagePoint({ ...object, machinePosition: 0 }).y).toBeCloseTo(.4);
    expect(machineCarriagePoint({ ...object, machinePosition: 1 }).y).toBeCloseTo(2.8);
    expect(studioLayoutSchema.safeParse({ body: identityTransform, objects: [object] }).success).toBe(true);
    expect(studioLayoutSchema.safeParse({ body: identityTransform, objects: [{ ...object, machineRange: { min: 2, max: 1 } }] }).success).toBe(false);
  });

  it("moves press handles upward and row handles toward the body along lever arcs", () => {
    const press = createStudioObject("shoulder-press-machine" as StudioObject["slug"], crypto.randomUUID(), 0);
    const row = createStudioObject("row-machine" as StudioObject["slug"], crypto.randomUUID(), 0);
    const start = machineHandlePoint({ ...press, machinePosition: 0 }, "left");
    const finish = machineHandlePoint({ ...press, machinePosition: 1 }, "left");
    expect(finish.y - start.y).toBeGreaterThan(.5);
    expect(machineHandlePoint({ ...row, machinePosition: 0 }, "left").z - machineHandlePoint({ ...row, machinePosition: 1 }, "left").z).toBeGreaterThan(.4);
    expect(start.distanceTo(new Vector3(0, 0, 0))).toBeGreaterThan(1);
  });

  it.each(["smith-machine", "row-machine", "shoulder-press-machine"] as const)("allows a single %s grip without moving the figure", slug => {
    const scene = createQuickScene(slug), object = scene.studio!.objects[0];
    Object.assign(object, { machineUse: false, attachment: "left" });
    expect(studioLayoutSchema.safeParse(scene.studio).success).toBe(true);
    const rig = createAnatomyRig(new Group());
    try {
      poseAnatomyRig(rig, {}, true);
      const position = rig.root.position.clone(), rotation = rig.root.quaternion.clone();
      const freeArm = rig.bones["right-shoulder"].quaternion.clone();
      applyStudioMachine(rig, scene, 0);
      expect(rig.root.position.distanceTo(position)).toBeLessThan(1e-6);
      expect(rig.root.quaternion.angleTo(rotation)).toBeLessThan(1e-6);
      expect(rig.bones["right-shoulder"].quaternion.angleTo(freeArm)).toBeLessThan(1e-6);
    } finally { rig.dispose(); }
  });

  it.each(["smith-machine", "row-machine", "shoulder-press-machine"] as const)("keeps captured %s poses valid with free grips", slug => {
    const scene = createQuickScene(slug);
    Object.assign(scene.studio!.objects[0], { machineUse: false, attachment: "both", frames: undefined, machinePosition: .5 });
    scene.keyframes[0].poses = sampleHeldWeightPose(scene, 0);
    const parsed = workshopSceneSchema.safeParse(scene);
    expect(parsed.success, parsed.success ? undefined : JSON.stringify(parsed.error.issues)).toBe(true);
  });

  it.each(["row-machine", "shoulder-press-machine"] as const)("maps %s mouse travel onto its actual arc", slug => {
    const object = createStudioObject(slug, crypto.randomUUID(), 0);
    for (let i = 0; i <= 16; i++) {
      const point = machineHandlePoint({ ...object, machinePosition: i / 16 }, "left");
      expect(machineDragValues(object, point).machinePosition).toBeCloseTo(i / 16, 5);
    }
  });

  it.each(["row-machine", "shoulder-press-machine"] as const)("keeps a custom %s grip in its handle axes", slug => {
    const object = { ...createStudioObject(slug, crypto.randomUUID(), 0), gripOffsets: { left: { x: 0, y: .1, z: .03 } } };
    for (let i = 0; i <= 16; i++) {
      const sampled = { ...object, machinePosition: i / 16 }, lever = machineLever(sampled, "left");
      const offset = new Vector3(0, .1, .03);
      if (slug === "row-machine") offset.applyAxisAngle(new Vector3(1, 0, 0), lever.angle);
      const expected = offset.add(machineHandlePoint(sampled, "left"));
      expect(machineGripPoint(sampled, "left").distanceTo(expected)).toBeLessThan(1e-6);
    }
  });

  it.each(["row-machine", "shoulder-press-machine"] as const)("keeps the preset hands on %s grips throughout travel", slug => {
    const scene = createQuickScene(slug), rig = createAnatomyRig(new Group());
    const object = scene.studio!.objects[0];
    try {
      for (let i = 0; i <= 16; i++) {
        object.frames = undefined; object.machinePosition = i / 16;
        poseAnatomyRig(rig, {}, true); applyStudioMachine(rig, scene, 0);
        for (const side of ["left", "right"] as const) {
          const target = machineHandlePoint(object, side);
          const hand = rig.handBones[side].localToWorld(studioGripOffset(side));
          expect(hand.distanceTo(target), `${slug} ${side} at ${i}`).toBeLessThan(.005);
        }
      }
    } finally { rig.dispose(); }
  });

  it("preserves an elbow support when a free Smith grip is beyond its reach", () => {
    const scene = createQuickScene("smith-machine"), rig = createAnatomyRig(new Group());
    Object.assign(scene.studio!.objects[0], { machineUse: false, attachment: "left", frames: undefined, machinePosition: .5 });
    try {
      poseAnatomyRig(rig, { "left-elbow": { x: 90, y: 0, z: 0 } }, true);
      const point = supportContactPoint(rig, "left-elbow", new Vector3(0, 1, 0));
      const stool = { ...createStudioObject("stool", crypto.randomUUID(), 0), x: 0, y: 0, z: 0 };
      scene.studio!.objects.push(stool);
      scene.studio!.supports = [{ region: "left-elbow", objectId: stool.id, surface: "body", point: { x: point.x, y: point.y, z: point.z }, normal: { x: 0, y: 1, z: 0 }, turn: 0 }];
      expect(studioLayoutSchema.safeParse(scene.studio).success).toBe(true);
      applyStudioSupports(rig, scene.studio, 0, {});
      const before = supportContactPoint(rig, "left-elbow");
      applyStudioMachine(rig, scene, 0);
      expect(supportContactPoint(rig, "left-elbow").distanceTo(before)).toBeLessThan(.005);
    } finally { rig.dispose(); }
  });
});
