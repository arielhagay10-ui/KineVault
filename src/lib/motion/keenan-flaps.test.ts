import { readFile } from "node:fs/promises";
import { beforeAll, expect, it } from "vitest";
import { Euler, Group, Quaternion, Raycaster, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { keenanFlapsScene } from "./keenan-flaps";
import { applyStudioSeating } from "./studio-seat";
import { studioCableFrame } from "./studio-cable";
import { studioPointToWorld } from "./studio";
import { sampleWorkshopPose, jointLimits } from "./workshop";
import { workshopSceneSchema } from "./scene-schema";

let source: Group;
beforeAll(async () => {
  const bytes = await readFile("public/models/z-anatomy/model.glb");
  source = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "")).scene;
});

it("faces the bench toward the stack, leans slightly right and puts the pulley just above the shoulder", () => {
  const rig = createAnatomyRig(source);
  const bench = keenanFlapsScene.studio!.objects[0], object = keenanFlapsScene.studio!.objects[1], tower = new Group();
  tower.position.set(object.x, object.y, object.z);
  tower.rotation.set(object.rotationX * Math.PI / 180, object.rotationY * Math.PI / 180, object.rotationZ * Math.PI / 180);
  try {
    for (let step = 0; step <= 16; step++) {
      const pose = sampleWorkshopPose(keenanFlapsScene.keyframes, step * 300);
      poseAnatomyRig(rig, pose); applyStudioSeating(rig, keenanFlapsScene.studio, step * 300, pose);
      const frame = studioCableFrame(rig, object, tower, pose);
      const shoulder = rig.bones["right-shoulder"].getWorldPosition(new Vector3());
      const seat = studioPointToWorld({ x: 0, y: 0, z: 0.56 }, bench);
      const towardStack = tower.position.clone().sub(seat).setY(0).normalize();
      const benchFront = studioPointToWorld({ x: 0, y: 0, z: -1 }, bench).sub(new Vector3(bench.x, bench.y, bench.z)).normalize();
      expect(benchFront.angleTo(towardStack)).toBeLessThan(0.000001);
      expect(frame.pulley.y - shoulder.y).toBeGreaterThan(0.1);
      expect(frame.pulley.y - shoulder.y).toBeLessThan(0.3);
      const lean = new Euler().setFromQuaternion(rig.bones.torso.quaternion);
      expect(lean.z * 180 / Math.PI).toBeGreaterThan(5);
      expect(lean.z * 180 / Math.PI).toBeLessThan(12);
      expect(Math.abs(lean.y)).toBeLessThan(0.000001);
      const towerFront = new Vector3(0, 0, 1).applyQuaternion(tower.quaternion);
      expect(towerFront.angleTo(towardStack.negate())).toBeLessThan(0.000001);
    }
  } finally { rig.dispose(); }
});

it("uses one cuff, a stationary support arm and frontal-plane shoulder adduction with natural knee hinges", () => {
  const rig = createAnatomyRig(source);
  let support: Vector3 | undefined;
  try {
    expect(keenanFlapsScene.studio!.objects.filter(item => item.slug === "cable-machine")).toHaveLength(1);
    for (let step = 0; step <= 16; step++) {
      const pose = sampleWorkshopPose(keenanFlapsScene.keyframes, step * 300);
      poseAnatomyRig(rig, pose); applyStudioSeating(rig, keenanFlapsScene.studio, step * 300, pose);
      const shoulder = rig.bones["right-shoulder"].getWorldPosition(new Vector3());
      const elbow = rig.bones["right-elbow"].getWorldPosition(new Vector3());
      const forward = new Vector3(0, 0, 1).applyQuaternion(rig.bones.torso.getWorldQuaternion(new Quaternion()));
      expect(Math.abs(elbow.sub(shoulder).dot(forward))).toBeLessThan(0.02);
      const hand = rig.handBones.left.getWorldPosition(new Vector3());
      support ??= hand;
      expect(hand.distanceTo(support)).toBeLessThan(0.00001);
      for (const side of ["left", "right"] as const) {
        const knee = rig.bones[`${side}-knee`];
        expect(knee.rotation.x).toBeGreaterThan(0);
        expect(knee.rotation.x).toBeLessThan(120 * Math.PI / 180);
        expect(Math.abs(knee.rotation.y) + Math.abs(knee.rotation.z)).toBeLessThan(0.00001);
        const foot = rig.footBones[side];
        expect(-foot.rotation.x * 180 / Math.PI).toBeLessThanOrEqual(jointLimits[`${side}-ankle`].x[1] + 0.000001);
        expect(-foot.rotation.x * 180 / Math.PI).toBeGreaterThanOrEqual(jointLimits[`${side}-ankle`].x[0] - 0.000001);
        const shin = knee.getWorldPosition(new Vector3()).sub(foot.getWorldPosition(new Vector3()));
        expect(shin.angleTo(new Vector3(0, 1, 0))).toBeLessThan(25 * Math.PI / 180);
      }
    }
  } finally { rig.dispose(); }
});

it("keeps a chest-supported Keenan flap on the pad with fixed feet, elbow bends and arm cuffs through a full rep", () => {
  expect(workshopSceneSchema.safeParse(keenanFlapsScene).success).toBe(true);
  const rig = createAnatomyRig(source), body = new Group(); body.add(rig.root);
  const feet: Vector3[] = [], cuffs: Vector3[] = [], previous: Vector3[] = [];
  const bench = keenanFlapsScene.studio!.objects[0];
  const angle = bench.benchAngle! * Math.PI / 180;
  const normal = new Vector3(0, Math.cos(angle), Math.sin(angle)), padBase = new Vector3(0, 0.673, 0.253);
  const inverseBench = new Quaternion().setFromEuler(new Euler(bench.rotationX * Math.PI / 180, bench.rotationY * Math.PI / 180, bench.rotationZ * Math.PI / 180)).invert();
  const chest = rig.meshes.filter(mesh => /pectoralis_major/.test(mesh.name));
  const soles = rig.meshes.filter(mesh => /calcaneus|metatarsal/.test(mesh.name.toLowerCase()));
  const trunk = rig.meshes.filter(mesh => /pectoralis_major|latissimus|sternum|rib|scapula|clavicle|oblique|rectus_abdominis/i.test(mesh.name));
  let chestGap = Infinity;
  try {
    for (let step = 0; step <= 16; step++) {
      const time = step * 300, pose = sampleWorkshopPose(keenanFlapsScene.keyframes, time);
      poseAnatomyRig(rig, pose); applyStudioSeating(rig, keenanFlapsScene.studio, time, pose);
      body.updateMatrixWorld(true); rig.skeleton.update();
      expect(soles.length).toBeGreaterThan(0);
      let soleHeight = Infinity;
      for (const mesh of soles) {
        const points = mesh.geometry.getAttribute("position");
        for (let vertex = 0; vertex < points.count; vertex++) {
          soleHeight = Math.min(soleHeight, mesh.localToWorld(mesh.getVertexPosition(vertex, new Vector3())).y);
        }
      }
      expect(soleHeight).toBeGreaterThan(-0.005);
      expect(soleHeight).toBeLessThan(0.025);
      for (const mesh of chest) {
        const points = mesh.geometry.getAttribute("position");
        for (let vertex = 0; vertex < points.count; vertex++) {
          const point = mesh.localToWorld(mesh.getVertexPosition(vertex, new Vector3())).sub(new Vector3(bench.x, bench.y, bench.z)).applyQuaternion(inverseBench).divideScalar(bench.scale);
          if (Math.abs(point.x) < 0.19) chestGap = Math.min(chestGap, point.sub(padBase).dot(normal));
        }
      }
      for (const [index, side] of (["left", "right"] as const).entries()) {
        const elbow = rig.bones[`${side}-elbow`].getWorldPosition(new Vector3());
        const shoulder = rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3());
        const hand = rig.handBones[side].getWorldPosition(new Vector3());
        const foot = rig.footBones[side].getWorldPosition(new Vector3());
        expect(rig.handBones[side].quaternion.angleTo(new Quaternion())).toBeLessThan(0.00001);
        expect(rig.bones[`${side}-elbow`].rotation.x).toBeCloseTo(-(side === "right" ? 30 : 100) * Math.PI / 180, 6);
        expect(foot.y).toBeCloseTo(0.119, 4);
        if (!step) feet[index] = foot;
        expect(foot.distanceTo(feet[index])).toBeLessThan(0.00001);
        if (side === "left") continue;
        const object = keenanFlapsScene.studio!.objects[1], tower = new Group(); tower.position.set(object.x, object.y, object.z);
        tower.rotation.set(object.rotationX * Math.PI / 180, object.rotationY * Math.PI / 180, object.rotationZ * Math.PI / 180);
        const frame = studioCableFrame(rig, object, tower, pose);
        for (const mesh of trunk) mesh.computeBoundingSphere();
        const cable = frame.pulley.clone().sub(frame.connection);
        const ray = new Raycaster(frame.connection, cable.clone().normalize(), 0.03, cable.length());
        expect(ray.intersectObjects(trunk, false), "cable clears the torso and pad-supported chest").toHaveLength(0);
        expect(frame.center.distanceTo(elbow.clone().lerp(shoulder, 0.22))).toBeLessThan(0.00001);
        expect(frame.pulley.distanceTo(frame.connection)).toBeGreaterThan(0.7);
        expect(frame.center.distanceTo(hand)).toBeGreaterThan(0.3);
        if (!step) cuffs[index] = frame.center;
        if (step === 8) expect(frame.center.y).toBeLessThan(cuffs[index].y - 0.2);
        if (step === 16) expect(frame.center.distanceTo(cuffs[index])).toBeLessThan(0.00001);
        if (previous[index]) expect(frame.center.distanceTo(previous[index])).toBeLessThan(0.2);
        previous[index] = frame.center;
      }
    }
    expect(chestGap, "pad supports the chest within 2 cm of its front face").toBeGreaterThan(0.025);
    expect(chestGap, "pad supports the chest within 2 cm of its front face").toBeLessThan(0.065);
  } finally { rig.dispose(); }
});
