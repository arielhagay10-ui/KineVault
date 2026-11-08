import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { Group, Quaternion, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { createQuickScene, searchWorkshopEquipment, workshopEquipmentOptions } from "./quick-create";
import { workshopSceneSchema } from "./scene-schema";
import { applyStudioMachine, machineGripPoint, machineHandlePoint } from "./studio-machines";
import { sampleStudioObject, studioPointToWorld } from "./studio";
import { studioGripOffset } from "./studio-grip";
import { machineDragValues } from "./workshop-mouse";
import { limbPoseBlock } from "./limb-pose";
import { activeSeat } from "./seated-pose";
import { lateralRaise, lateralRaiseLever } from "./lateral-raise";

const arm = /biceps_brachii|triceps|brachialis|brachioradialis|coracobrachialis/i;
const back = /trapezius|latissimus|rhomboid|infraspinatus|teres|gluteus/i;

describe("lateral raise machine", () => {
  it("discovers the machine and saves its default repetition", () => {
    expect(searchWorkshopEquipment(workshopEquipmentOptions(), "lateral raise")[0]?.slug).toBe("lateral-raise-machine");
    const scene = createQuickScene("lateral-raise-machine");
    expect(workshopSceneSchema.safeParse(JSON.parse(JSON.stringify(scene))).success).toBe(true);
    expect(scene.studio!.objects[0].frames!.length).toBeGreaterThanOrEqual(17);
    expect(activeSeat(scene)).toBeUndefined();
    for (const limb of ["left-hand", "right-hand", "left-foot", "right-foot"] as const) expect(limbPoseBlock(scene, limb)).toBeDefined();
  });

  it.each([false, true])("abducts both arms about the shoulder axes with hands on the handles, transformed=%s", transformed => {
    const scene = createQuickScene("lateral-raise-machine"), raw = scene.studio!.objects[0];
    if (transformed) {
      const placement = { x: -.8, y: .05, z: .4, rotationX: 0, rotationY: -30, rotationZ: 0, scale: 1.15 };
      Object.assign(raw, placement);
      raw.frames = raw.frames!.map(frame => ({ ...frame, ...placement }));
    }
    const rig = createAnatomyRig(new Group()), abduction: number[] = [];
    try {
      for (let i = 0; i <= 32; i++) {
        const time = scene.durationMs * i / 32, object = sampleStudioObject(raw, time);
        poseAnatomyRig(rig, {}, true);
        expect(applyStudioMachine(rig, scene, time)!.warnings, `warnings at ${i}`).toEqual([]);
        const facing = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), object.rotationY * Math.PI / 180);
        for (const side of ["left", "right"] as const) {
          const shoulder = rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3()), elbow = rig.bones[`${side}-elbow`], hand = rig.handBones[side];
          expect(shoulder.distanceTo(studioPointToWorld(lateralRaiseLever(object, side).pivot, object)) / object.scale, `${side} shoulder on axis at ${i}`).toBeLessThan(.005);
          expect(hand.localToWorld(studioGripOffset(side)).distanceTo(studioPointToWorld(machineGripPoint(object, side), object)), `${side} hand at ${i}`).toBeLessThan(.005);
          expect(Math.abs(elbow.rotation.y) + Math.abs(elbow.rotation.z), `${side} elbow hinge at ${i}`).toBeLessThan(.001);
          const upper = elbow.getWorldPosition(new Vector3()).sub(shoulder), lower = hand.getWorldPosition(new Vector3()).sub(elbow.getWorldPosition(new Vector3()));
          expect(upper.angleTo(lower) * 180 / Math.PI, `${side} elbow flexion at ${i}`).toBeGreaterThan(80);
          expect(upper.angleTo(lower) * 180 / Math.PI, `${side} elbow flexion at ${i}`).toBeLessThan(100);
          const local = upper.applyQuaternion(facing.clone().invert());
          if (side === "left") abduction.push(Math.atan2(local.x, -local.y) * 180 / Math.PI);
          expect(Math.abs(local.z) / upper.length(), `${side} arm stays in the frontal plane at ${i}`).toBeLessThan(.1);
        }
        expect(machineDragValues(object, machineHandlePoint(object, "left")).machinePosition).toBeCloseTo(object.machinePosition!, 5);
      }
      expect(Math.min(...abduction)).toBeGreaterThan(8);
      expect(Math.min(...abduction)).toBeLessThan(16);
      expect(Math.max(...abduction)).toBeGreaterThan(84);
      expect(Math.max(...abduction)).toBeLessThan(92);
    } finally { rig.dispose(); }
  });

  it("rests the real upper arms on the pads and the back against its pad", async () => {
    const bytes = await readFile("public/models/z-anatomy/model.glb");
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    const rig = createAnatomyRig(gltf.scene), scene = createQuickScene("lateral-raise-machine"), raw = scene.studio!.objects[0];
    const { pad, back: backPad } = lateralRaise, z = new Vector3(0, 0, 1);
    try {
      for (let i = 0; i <= 8; i++) {
        const time = scene.durationMs / 2 * i / 8, object = sampleStudioObject(raw, time);
        poseAnatomyRig(rig, {}, true); applyStudioMachine(rig, scene, time);
        rig.root.updateMatrixWorld(true); rig.skeleton.update();
        const gaps = { left: Infinity, right: Infinity }, point = new Vector3();
        let backGap = Infinity;
        for (const mesh of rig.meshes) {
          const isArm = arm.test(mesh.name), isBack = back.test(mesh.name);
          if (!isArm && !isBack) continue;
          for (let vertex = 0; vertex < mesh.geometry.getAttribute("position").count; vertex++) {
            mesh.localToWorld(mesh.getVertexPosition(vertex, point));
            if (isBack) {
              if (Math.abs(point.x) < backPad.size[0] / 2 && Math.abs(point.y - backPad.center[1]) < backPad.size[1] / 2) backGap = Math.min(backGap, point.z - backPad.center[2] - backPad.size[2] / 2);
              continue;
            }
            const side = point.x > 0 ? "left" : "right", lever = lateralRaiseLever(object, side), sign = side === "left" ? 1 : -1;
            const local = point.clone().sub(lever.pivot).applyAxisAngle(z, -lever.angle);
            if (local.z < pad.back || local.z > pad.front) continue;
            gaps[side] = Math.min(gaps[side], Math.hypot(local.x - sign * pad.lateral, local.y - pad.along) - pad.radius);
          }
        }
        for (const side of ["left", "right"] as const) {
          expect(gaps[side], `${side} arm pad gap at ${i}`).toBeGreaterThan(0);
          expect(gaps[side], `${side} arm pad gap at ${i}`).toBeLessThan(.006);
        }
        expect(backGap, `back pad gap at ${i}`).toBeGreaterThan(0);
        expect(backGap, `back pad gap at ${i}`).toBeLessThan(.01);
      }
    } finally { rig.dispose(); }
  }, 60_000);
});
