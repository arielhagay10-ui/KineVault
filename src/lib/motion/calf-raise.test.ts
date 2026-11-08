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
import { calfRaise, calfRaiseCarriagePoint } from "./calf-raise";

const degrees = 180 / Math.PI;

describe("standing calf raise machine", () => {
  it("discovers the machine and saves its default repetition", () => {
    expect(searchWorkshopEquipment(workshopEquipmentOptions(), "calf raise")[0]?.slug).toBe("calf-raise-machine");
    const scene = createQuickScene("calf-raise-machine");
    expect(workshopSceneSchema.safeParse(JSON.parse(JSON.stringify(scene))).success).toBe(true);
    expect(scene.studio!.objects[0].frames!.length).toBeGreaterThanOrEqual(17);
    expect(activeSeat(scene)).toBeUndefined();
    for (const limb of ["left-hand", "right-hand", "left-foot", "right-foot"] as const) expect(limbPoseBlock(scene, limb)).toBeDefined();
    const seated = structuredClone(scene);
    seated.studio!.objects[0].seatOffsetZ = .05;
    expect(workshopSceneSchema.safeParse(seated).success).toBe(false);
  });

  it.each([false, true])("lifts the straight-legged figure on its flat toes with hands on the handles, transformed=%s", transformed => {
    const scene = createQuickScene("calf-raise-machine"), raw = scene.studio!.objects[0];
    if (transformed) {
      const placement = { x: -.8, y: .05, z: .4, rotationX: 0, rotationY: -30, rotationZ: 0, scale: 1.15 };
      Object.assign(raw, placement);
      raw.frames = raw.frames!.map(frame => ({ ...frame, ...placement }));
    }
    const rig = createAnatomyRig(new Group()), ankle: number[] = [];
    try {
      for (let i = 0; i <= 32; i++) {
        const time = scene.durationMs * i / 32, object = sampleStudioObject(raw, time);
        const facing = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), object.rotationY * Math.PI / 180);
        poseAnatomyRig(rig, {}, true);
        expect(applyStudioMachine(rig, scene, time)!.warnings, `warnings at ${i}`).toEqual([]);
        for (const side of ["left", "right"] as const) {
          expect(Math.abs(rig.bones[`${side}-knee`].rotation.x) * degrees, `${side} knee at ${i}`).toBeLessThan(.5);
          expect(rig.toeBones[side].getWorldQuaternion(new Quaternion()).angleTo(facing) * degrees, `${side} toes flat at ${i}`).toBeLessThan(.01);
          expect(rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(studioPointToWorld(machineGripPoint(object, side), object)), `${side} hand at ${i}`).toBeLessThan(.005);
          const shoulder = rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3()).sub(studioPointToWorld(calfRaiseCarriagePoint(object), object)).applyQuaternion(facing.clone().invert()).divideScalar(object.scale);
          expect(Math.abs(Math.abs(shoulder.x) - calfRaise.pad.x), `${side} shoulder under the pad at ${i}`).toBeLessThan(.1);
          expect(shoulder.y, `${side} pad above the shoulder at ${i}`).toBeCloseTo(-.102, 2);
        }
        ankle.push(rig.footBones.left.rotation.x * degrees);
        expect(machineDragValues(object, machineHandlePoint(object, "left")).machinePosition).toBeCloseTo(object.machinePosition!, 4);
      }
      // Dorsiflexed below the platform at the start, 20-30 degrees of plantarflexion at the top.
      expect(Math.min(...ankle)).toBeLessThan(-12);
      expect(Math.min(...ankle)).toBeGreaterThan(-20);
      expect(Math.max(...ankle)).toBeGreaterThan(20);
      expect(Math.max(...ankle)).toBeLessThan(30);
    } finally { rig.dispose(); }
  });

  it("keeps the real forefoot on the platform and the shoulders under the pads", async () => {
    const bytes = await readFile("public/models/z-anatomy/model.glb");
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    const rig = createAnatomyRig(gltf.scene), scene = createQuickScene("calf-raise-machine"), raw = scene.studio!.objects[0];
    const { platform, pad } = calfRaise, point = new Vector3(), heels: number[] = [];
    try {
      for (let i = 0; i <= 8; i++) {
        const time = scene.durationMs / 2 * i / 8, object = sampleStudioObject(raw, time), carriage = calfRaiseCarriagePoint(object);
        poseAnatomyRig(rig, {}, true); applyStudioMachine(rig, scene, time);
        rig.root.updateMatrixWorld(true); rig.skeleton.update();
        let forefoot = Infinity, toes = Infinity, heel = Infinity, padGap = Infinity;
        for (const mesh of rig.meshes) {
          const toe = /phalanx_of_\w+_finger_of_foot/.test(mesh.name), count = mesh.geometry.getAttribute("position").count;
          for (let vertex = 0; vertex < count; vertex++) {
            mesh.localToWorld(mesh.getVertexPosition(vertex, point));
            if (point.y < .6) {
              if (point.z > platform.edge && Math.abs(point.x) < platform.width / 2) forefoot = Math.min(forefoot, point.y - platform.top);
              if (toe) toes = Math.min(toes, point.y - platform.top);
              if (point.z < -.1) heel = Math.min(heel, point.y - platform.top);
            } else if (point.y > 2 && point.z > pad.back && point.z < pad.front && Math.abs(Math.abs(point.x) - pad.x) < pad.radius) {
              padGap = Math.min(padGap, Math.hypot(Math.abs(point.x) - pad.x, point.y - carriage.y) - pad.radius);
            }
          }
        }
        expect(forefoot, `forefoot at ${i}`).toBeGreaterThan(-.001);
        expect(forefoot, `forefoot at ${i}`).toBeLessThan(.002);
        expect(toes, `toes at ${i}`).toBeGreaterThan(0);
        expect(toes, `toes at ${i}`).toBeLessThan(.006);
        expect(padGap, `pad gap at ${i}`).toBeGreaterThan(0);
        expect(padGap, `pad gap at ${i}`).toBeLessThan(.004);
        heels.push(heel);
      }
      expect(heels[0]).toBeLessThan(-.04);
      expect(heels.at(-1)).toBeGreaterThan(.08);
    } finally { rig.dispose(); }
  }, 60_000);
});
