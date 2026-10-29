import { describe, expect, it } from "vitest";
import { Group, Quaternion, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { createQuickScene, generateMachineRepetition, searchWorkshopEquipment, workshopEquipmentOptions } from "./quick-create";
import { workshopSceneSchema } from "./scene-schema";
import { applyStudioMachine, machineGripPoint, setMachinePosition } from "./studio-machines";
import { sampleStudioObject, studioPointToWorld } from "./studio";
import { studioGripOffset } from "./studio-grip";
import { clampJointControlAngles, sampleWorkshopPose } from "./workshop";
import { armTorsoClearance } from "./barbell-contact";
import { seatedPadPenetration } from "./seated-pad-clearance";

describe("converging chest press", () => {
  it("discovers the machine and round trips independent grips and seating", () => {
    expect(searchWorkshopEquipment(workshopEquipmentOptions(), "converging chest press").some(item => item.slug === "chest-press-machine")).toBe(true);
    const scene = createQuickScene("chest-press-machine");
    Object.assign(scene.studio!.objects[0], { pressGrip: "angled", machinePositionLeft: .2, machinePositionRight: .8, seatOffsetZ: .02, seatFootSupport: false });
    expect(workshopSceneSchema.safeParse(scene).success).toBe(true);
  });

  it("generates a full rep after setting individual arm travel", () => {
    const scene = createQuickScene("chest-press-machine"), object = scene.studio!.objects[0];
    Object.assign(object, { machinePositionLeft: .2, machinePositionRight: .8 });
    const generated = generateMachineRepetition(scene, object.id, 0, 1).studio!.objects[0];
    for (const side of ["left", "right"] as const) {
      const start = machineGripPoint(sampleStudioObject(generated, 0), side);
      const finish = machineGripPoint(sampleStudioObject(generated, scene.durationMs / 2), side);
      expect(finish.z - start.z).toBeGreaterThan(.4);
    }
  });

  it.each(["wide", "angled", "neutral"] as const)("keeps %s contact, bounded joints and continuous motion through three reps", pressGrip => {
    const scene = createQuickScene("chest-press-machine");
    scene.studio!.objects[0].pressGrip = pressGrip;
    const rig = createAnatomyRig(new Group());
    const previous = new Map<string, Quaternion>();
    const lengths = new Map<string, number>();
    const widths: number[] = [], depths: number[] = [];
    try {
      for (let step = 0; step <= 192; step++) {
        const time = step % 64 / 64 * scene.durationMs;
        poseAnatomyRig(rig, sampleWorkshopPose(scene.keyframes, time), true);
        const report = applyStudioMachine(rig, scene, time);
        const object = sampleStudioObject(scene.studio!.objects[0], time);
        expect(report?.warnings, `${pressGrip} ${step} warnings`).toEqual([]);
        expect(seatedPadPenetration(rig, object), `${step} back clearance`).toBeLessThan(.001);
        for (const side of ["left", "right"] as const) {
          const hand = rig.handBones[side], elbow = rig.bones[`${side}-elbow`], shoulder = rig.bones[`${side}-shoulder`];
          const target = studioPointToWorld(machineGripPoint(object, side), object);
          expect(hand.localToWorld(studioGripOffset(side)).distanceTo(target), `${step} ${side} contact`).toBeLessThan(.004);
          expect(Math.max(...armTorsoClearance(rig, side)), `${step} ${side} torso clearance`).toBeLessThan(.001);
          for (const [part, bone] of [["hand", hand], ["forearm", rig.forearmBones[side]]] as const) {
            const rotation = bone.getWorldQuaternion(new Quaternion()), key = `${side}-${part}`;
            if (previous.has(key)) expect(rotation.angleTo(previous.get(key)!) * 180 / Math.PI, `${step} ${key} jump`).toBeLessThan(15);
            previous.set(key, rotation);
          }
          const positions = [shoulder, elbow, hand].map(bone => bone.getWorldPosition(new Vector3()));
          if (step === 32) expect(positions[1].clone().sub(positions[0]).angleTo(positions[2].clone().sub(positions[1])) * 180 / Math.PI, `${pressGrip} finish elbow bend`).toBeLessThan(40);
          for (let index = 0; index < 2; index++) {
            const key = `${side}-${index}`, length = positions[index].distanceTo(positions[index + 1]);
            if (!lengths.has(key)) lengths.set(key, length);
            expect(length).toBeCloseTo(lengths.get(key)!, 6);
          }
          for (const part of ["shoulder", "elbow"] as const) {
            const bone = rig.bones[`${side}-${part}`], radians = Math.PI / 180;
            const angles = { x: bone.rotation.x / radians * (part === "elbow" ? -1 : 1), y: bone.rotation.y / radians, z: -bone.rotation.z / radians };
            const guarded = clampJointControlAngles(`${side}-${part}`, angles);
            for (const axis of ["x", "y", "z"] as const) expect(angles[axis], `${step} ${side} ${part} ${axis}`).toBeCloseTo(guarded[axis], 3);
            const key = `${side}-${part}`, rotation = bone.getWorldQuaternion(new Quaternion());
            if (previous.has(key)) expect(rotation.angleTo(previous.get(key)!) * 180 / Math.PI, `${step} ${key} jump`).toBeLessThan(15);
            previous.set(key, rotation);
          }
        }
        widths.push(machineGripPoint(object, "left").x - machineGripPoint(object, "right").x);
        depths.push(machineGripPoint(object, "left").z);
      }
      expect(widths[32]).toBeLessThan(widths[0] - .15);
      expect(depths[32]).toBeGreaterThan(depths[0] + .4);
      const object = scene.studio!.objects[0];
      const changed = setMachinePosition({ ...object, frames: undefined, machinePositionRight: .3 }, .8, 0, "left");
      expect(changed.machinePositionRight).toBe(.3);
      expect(changed.machinePositionLeft).toBe(.8);
    } finally { rig.dispose(); }
  }, 20_000);
});
