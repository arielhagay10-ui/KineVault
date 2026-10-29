import { describe, expect, it } from "vitest";
import { Group, Quaternion, Vector3 } from "three";
import { createQuickScene, searchWorkshopEquipment, workshopEquipmentOptions } from "./quick-create";
import { workshopSceneSchema } from "./scene-schema";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { applyStudioMachine, machineGripPoint, machineHandlePoint } from "./studio-machines";
import { sampleStudioObject, studioPointToWorld } from "./studio";
import { studioGripOffset } from "./studio-grip";
import { machineDragValues } from "./workshop-mouse";
import { releaseTBarFeet } from "./t-bar-row-pose";
import { limbPoseBlock } from "./limb-pose";

describe("chest-supported T-bar row", () => {
  it("releases feet without moving them or releasing a hand", () => {
    const scene = createQuickScene("t-bar-row-machine"), free = releaseTBarFeet(scene);
    expect(free.studio!.objects[0].rowFootSupport).toBe(false);
    expect(limbPoseBlock(free, "left-foot")).toBeUndefined();
    expect(workshopSceneSchema.safeParse(free).success).toBe(true);
    const rig = createAnatomyRig(new Group());
    try {
      for (const frame of scene.keyframes) {
        poseAnatomyRig(rig, frame.poses, true); applyStudioMachine(rig, scene, frame.timeMs);
        const feet = ["left", "right"].map(side => rig.footBones[side as "left" | "right"].getWorldPosition(new Vector3()));
        poseAnatomyRig(rig, free.keyframes.find(item => item.timeMs === frame.timeMs)!.poses, true); applyStudioMachine(rig, free, frame.timeMs);
        for (const [i, side] of (["left", "right"] as const).entries()) expect(rig.footBones[side].getWorldPosition(new Vector3()).distanceTo(feet[i])).toBeLessThan(.001);
      }
    } finally { rig.dispose(); }
  });

  it("keeps both handle sets on one physical arc and permits one attached hand", () => {
    const scene = createQuickScene("t-bar-row-machine"), object = scene.studio!.objects[0];
    for (const position of [0, .5, 1]) {
      const neutral = machineHandlePoint({ ...object, machinePosition: position, rowGrip: "neutral" }, "left");
      const wide = machineHandlePoint({ ...object, machinePosition: position, rowGrip: "wide" }, "left");
      expect(wide.distanceTo(neutral)).toBeCloseTo(Math.hypot(.15, .04, .05), 6);
    }
    Object.assign(object, { rowGrip: "wide", attachment: "left" });
    expect(limbPoseBlock(scene, "left-hand")).toBeDefined();
    expect(limbPoseBlock(scene, "right-hand")).toBeUndefined();
    expect(workshopSceneSchema.safeParse(scene).success).toBe(true);
    const rig = createAnatomyRig(new Group());
    try {
      poseAnatomyRig(rig, {}, true);
      const freeArm = rig.bones["right-shoulder"].quaternion.clone();
      applyStudioMachine(rig, scene, 0);
      expect(rig.bones["right-shoulder"].quaternion.angleTo(freeArm)).toBeLessThan(1e-6);
    } finally { rig.dispose(); }
  });
  it("retains chest-pad alignment when an old scene has an authored torso bend", () => {
    const scene = createQuickScene("t-bar-row-machine"), rig = createAnatomyRig(new Group());
    try {
      poseAnatomyRig(rig, { torso: { x: 20, y: 20, z: 20 } }, true);
      applyStudioMachine(rig, scene, 0);
      const anterior = new Vector3(0, 0, 1).applyQuaternion(rig.bones.torso.getWorldQuaternion(new Quaternion()));
      expect(anterior.dot(new Vector3(0, -Math.SQRT1_2, Math.SQRT1_2))).toBeCloseTo(1, 6);
    } finally { rig.dispose(); }
  });
  it("discovers a separate machine and preserves its default repetition", () => {
    const match = searchWorkshopEquipment(workshopEquipmentOptions(), "t bar row")[0];
    expect(match?.slug).toBe("t-bar-row-machine");
    const scene = createQuickScene("t-bar-row-machine");
    expect(workshopSceneSchema.safeParse(JSON.parse(JSON.stringify(scene))).success).toBe(true);
    expect(scene.studio!.objects[0].frames!.length).toBeGreaterThanOrEqual(17);
  });

  it.each([[false, "neutral"], [true, "neutral"], [false, "wide"], [true, "wide"]] as const)("keeps shared travel and contacts, transformed=%s grip=%s", (transformed, rowGrip) => {
    const scene = createQuickScene("t-bar-row-machine"), raw = scene.studio!.objects[0];
    Object.assign(raw, { rowGrip, attachment: "both" });
    if (transformed) {
      const placement = { x: 1.2, y: .1, z: -.6, rotationX: 0, rotationY: 35, rotationZ: 0, scale: 1.2 };
      Object.assign(raw, placement);
      raw.frames = raw.frames!.map(frame => ({ ...frame, ...placement }));
    }
    const rig = createAnatomyRig(new Group());
    const chests: Vector3[] = [], feet: Vector3[][] = [[], []];
    try {
      for (let i = 0; i <= 32; i++) {
        const time = scene.durationMs * i / 32, object = sampleStudioObject(raw, time);
        poseAnatomyRig(rig, {}, true); applyStudioMachine(rig, scene, time);
        chests.push(rig.bones.torso.localToWorld(new Vector3(0, .62, .315)));
        for (const [index, side] of (["left", "right"] as const).entries()) {
          const target = studioPointToWorld(machineGripPoint(object, side), object);
          expect(rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(target), `${side} at ${i}`).toBeLessThan(.005);
          const hand = rig.handBones[side], elbow = rig.bones[`${side}-elbow`];
          if (i === 0) {
            const upper = elbow.getWorldPosition(new Vector3()).sub(rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3()));
            const lower = hand.getWorldPosition(new Vector3()).sub(elbow.getWorldPosition(new Vector3()));
            expect(upper.angleTo(lower) * 180 / Math.PI, `${side} starts extended`).toBeLessThan(20);
          }
          expect(Math.abs(elbow.rotation.y), `${side} elbow twist at ${i}`).toBeLessThan(.001);
          expect(Math.abs(elbow.rotation.z), `${side} elbow tilt at ${i}`).toBeLessThan(.001);
          const bend = new Vector3(0, -1, 0).applyQuaternion(hand.getWorldQuaternion(new Quaternion()))
            .angleTo(hand.getWorldPosition(new Vector3()).sub(elbow.getWorldPosition(new Vector3()))) * 180 / Math.PI;
          expect(bend, `${side} wrist at ${i}`).toBeLessThan(15);
          feet[index].push(rig.footBones[side].localToWorld(new Vector3(0, -.14, .065)));
        }
        expect(machineDragValues(object, machineHandlePoint(object, "left")).machinePosition).toBeCloseTo(object.machinePosition!, 5);
        expect(machineHandlePoint(object, "left").y).toBeCloseTo(machineHandlePoint(object, "right").y, 6);
      }
      for (const samples of [chests, ...feet]) for (const point of samples) expect(point.distanceTo(samples[0])).toBeLessThan(.001);
    } finally { rig.dispose(); }
  });
});
