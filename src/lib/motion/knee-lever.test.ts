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
import { kneeLever, kneeLeverLever, kneeLeverSlugs } from "./knee-lever";
import { jointLimits } from "./workshop";

const x = new Vector3(1, 0, 0);
const shin = /tibialis_anterior|extensor_(digitorum|hallucis)_longus|fibular|gastrocnemius|soleus|tibialis_posterior|flexor_(digitorum|hallucis)_longus|popliteus/i;
const thigh = /vastus|rectus_femoris|sartor|gracil|semi(tend|memb)|biceps_femoris|adductor_(longus|brevis|magnus)|iliotibial|tensor_fasc/i;
const back = /trapezius|latissimus|rhomboid|infraspinatus|teres|deltoid|gluteus/i;

describe.each(kneeLeverSlugs)("%s", slug => {
  it("discovers the machine and saves its default repetition", () => {
    expect(searchWorkshopEquipment(workshopEquipmentOptions(), "leg extension")[0]?.slug).toBe("leg-extension-machine");
    const scene = createQuickScene(slug);
    expect(workshopSceneSchema.safeParse(JSON.parse(JSON.stringify(scene))).success).toBe(true);
    expect(scene.studio!.objects[0].frames!.length).toBeGreaterThanOrEqual(17);
    expect(activeSeat(scene)).toBeUndefined();
    for (const limb of ["left-hand", "right-hand", "left-foot", "right-foot"] as const) expect(limbPoseBlock(scene, limb)).toBeDefined();
  });

  it.each([false, true])("keeps knees on the lever axis and hands on the handles, transformed=%s", transformed => {
    const scene = createQuickScene(slug), raw = scene.studio!.objects[0];
    if (transformed) {
      const placement = { x: 1.2, y: .1, z: -.6, rotationX: 0, rotationY: 35, rotationZ: 0, scale: 1.2 };
      Object.assign(raw, placement);
      raw.frames = raw.frames!.map(frame => ({ ...frame, ...placement }));
    }
    const rig = createAnatomyRig(new Group()), flexion: number[] = [];
    try {
      for (let i = 0; i <= 32; i++) {
        const time = scene.durationMs * i / 32, object = sampleStudioObject(raw, time), lever = kneeLeverLever(object);
        poseAnatomyRig(rig, {}, true);
        const report = applyStudioMachine(rig, scene, time)!;
        expect(report.warnings, `warnings at ${i}`).toEqual([]);
        for (const side of ["left", "right"] as const) {
          const knee = rig.bones[`${side}-knee`].getWorldPosition(new Vector3());
          const local = knee.clone().sub(studioPointToWorld(lever.pivot, object)).applyQuaternion(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -object.rotationY * Math.PI / 180));
          expect(Math.hypot(local.y, local.z) / object.scale, `${side} knee axis at ${i}`).toBeLessThan(.005);
          const grip = studioPointToWorld(machineGripPoint(object, side), object);
          expect(rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(grip), `${side} hand at ${i}`).toBeLessThan(.005);
          for (const part of ["hip", "knee", "ankle"] as const) {
            const joint = `${side}-${part}` as const, bone = rig.bones[joint];
            for (const axisName of ["x", "y", "z"] as const) {
              const angle = bone.rotation[axisName] * 180 / Math.PI * (axisName === "z" || axisName === "x" && part !== "hip" ? -1 : 1);
              expect(angle, `${joint}.${axisName} at ${i}`).toBeGreaterThanOrEqual(jointLimits[joint][axisName][0] - 1e-6);
              expect(angle, `${joint}.${axisName} at ${i}`).toBeLessThanOrEqual(jointLimits[joint][axisName][1] + 1e-6);
            }
          }
        }
        flexion.push(rig.bones["left-knee"].rotation.x * 180 / Math.PI);
        expect(machineDragValues(object, machineHandlePoint(object, "left")).machinePosition).toBeCloseTo(object.machinePosition!, 5);
      }
      expect(Math.max(...flexion)).toBeGreaterThan(85);
      expect(Math.min(...flexion)).toBeLessThan(12);
    } finally { rig.dispose(); }
  });

  it("rests the real shin on the roller, thighs on the seat and the back against its pad", async () => {
    const bytes = await readFile("public/models/z-anatomy/model.glb");
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    const rig = createAnatomyRig(gltf.scene), scene = createQuickScene(slug), raw = scene.studio!.objects[0];
    const seatTop = kneeLever.seat.center[1] + kneeLever.seat.size[1] / 2, seatFront = kneeLever.seat.center[2] + kneeLever.seat.size[2] / 2;
    const backCenter = new Vector3(...kneeLever.back.center), recline = kneeLever.reclineDegrees * Math.PI / 180;
    try {
      for (let i = 0; i <= 8; i++) {
        const time = scene.durationMs / 2 * i / 8, object = sampleStudioObject(raw, time), lever = kneeLeverLever(object);
        poseAnatomyRig(rig, {}, true); applyStudioMachine(rig, scene, time);
        rig.root.updateMatrixWorld(true); rig.skeleton.update();
        const inverse = new Quaternion().setFromAxisAngle(x, -lever.angle), point = new Vector3();
        let roller = Infinity, seat = Infinity, calf = Infinity, pad = Infinity;
        for (const mesh of rig.meshes) {
          const part = shin.test(mesh.name) ? "shin" : thigh.test(mesh.name) ? "thigh" : back.test(mesh.name) ? "back" : undefined;
          if (!part) continue;
          for (let vertex = 0; vertex < mesh.geometry.getAttribute("position").count; vertex++) {
            mesh.localToWorld(mesh.getVertexPosition(vertex, point));
            if (part === "back") {
              const local = point.clone().sub(backCenter).applyAxisAngle(x, -recline);
              if (Math.abs(local.x) < kneeLever.back.size[0] / 2 && Math.abs(local.y) < kneeLever.back.size[1] / 2) pad = Math.min(pad, local.z - kneeLever.back.size[2] / 2);
              continue;
            }
            if (part === "shin" && Math.abs(point.x) < kneeLever.pad.width / 2) {
              const local = point.clone().sub(lever.pivot).applyQuaternion(inverse);
              roller = Math.min(roller, Math.hypot(local.y - lever.grip.y, local.z - lever.grip.z) - kneeLever.pad.radius);
            }
            if (Math.abs(point.x) < kneeLever.seat.size[0] / 2 && point.z < seatFront && point.z > seatFront - kneeLever.seat.size[2]) {
              if (part === "thigh") seat = Math.min(seat, point.y - seatTop);
              else calf = Math.min(calf, Math.max(point.y - seatTop, seatFront - point.z));
            }
          }
        }
        expect(roller, `roller gap at ${i}`).toBeGreaterThan(0);
        expect(roller, `roller gap at ${i}`).toBeLessThan(.006);
        expect(seat, `thigh above seat at ${i}`).toBeGreaterThan(0);
        expect(seat, `thigh above seat at ${i}`).toBeLessThan(.015);
        expect(calf, `calf clear of the seat front at ${i}`).toBeGreaterThan(.03);
        expect(pad, `back pad gap at ${i}`).toBeGreaterThan(0);
        expect(pad, `back pad gap at ${i}`).toBeLessThan(.01);
      }
    } finally { rig.dispose(); }
  }, 60_000);
});
