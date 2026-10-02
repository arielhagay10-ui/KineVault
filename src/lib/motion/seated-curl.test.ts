import { readFile } from "node:fs/promises";
import { beforeAll, expect, it } from "vitest";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Group, Mesh, Quaternion, Vector3 } from "three";
import { createAnatomyRig, plantAnatomyFeet, poseAnatomyRig } from "./anatomy";
import { workshopSceneSchema } from "./scene-schema";
import { seatedCurlScene } from "./seated-curl";
import { inclineCurlScene } from "./incline-curl";
import { createAdjustableBench } from "./adjustable-bench";
import { sampleWorkshopPose } from "./workshop";

let source: Group;
beforeAll(async () => {
  const bytes = await readFile("public/models/z-anatomy/model.glb");
  source = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "")).scene;
});

it.each([seatedCurlScene, inclineCurlScene])("supports $motionStyle and clears body and bench with both complete dumbbells", (scene) => {
  expect(workshopSceneSchema.safeParse(scene).success).toBe(true);
  const inclined = scene.motionStyle === "incline-curl";
  const rig = createAnatomyRig(source);
  const bench = inclined ? createAdjustableBench() : null;
  const benchMeshes: Mesh[] = [];
  bench?.root.updateMatrixWorld(true);
  bench?.root.traverse(object => { if (object instanceof Mesh) { object.geometry.computeBoundingBox(); benchMeshes.push(object); } });
  const feet: Vector3[] = [], elbows: Vector3[] = [], start: Vector3[] = [], previous: Vector3[] = [];
  // The pad occupies y=.71–.83, x=±.24, z=-.19–.31 in renderer world units.
  const body = rig.meshes.filter(mesh => /gluteus|vastus|rectus_femoris|adductor|Hip_bone|pectoralis|abdom|oblique|latissimus/i.test(mesh.name));
  let minimumClearance = Infinity;
  try {
    for (let step = 0; step <= 32; step++) {
      const time = scene.durationMs * step / 32;
      const pose = sampleWorkshopPose(scene.keyframes, time);
      poseAnatomyRig(rig, pose, true, 0);
      plantAnatomyFeet(rig, scene.motionStyle, pose);
      const points = body.flatMap(mesh => Array.from({ length: mesh.geometry.getAttribute("position").count }, (_, vertex) =>
        mesh.localToWorld(mesh.getVertexPosition(vertex, new Vector3()))));
      for (const [index, side] of (["left", "right"] as const).entries()) {
        const sign = side === "left" ? 1 : -1;
        const hand = rig.handBones[side], elbow = rig.bones[`${side}-elbow`];
        const grip = hand.localToWorld(new Vector3(sign * 0.03, -0.15, 0.13));
        const foot = rig.footBones[side].getWorldPosition(new Vector3());
        const elbowPosition = elbow.getWorldPosition(new Vector3());
        if (step === 0) { feet[index] = foot; elbows[index] = elbowPosition; start[index] = grip.clone(); }
        expect(foot.distanceTo(feet[index])).toBeLessThan(0.001);
        expect(foot.y).toBeCloseTo(0.119, 3);
        expect(rig.footBones[side].getWorldQuaternion(new Quaternion()).angleTo(new Quaternion())).toBeLessThan(0.00001);
        expect(elbowPosition.distanceTo(elbows[index])).toBeLessThan(0.001);
        const upperArm = elbowPosition.clone().sub(rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3())).normalize();
        expect(upperArm.dot(new Vector3(0, -1, 0))).toBeGreaterThan(0.97);
        expect(hand.getWorldQuaternion(new Quaternion()).angleTo(rig.forearmBones[side].getWorldQuaternion(new Quaternion()))).toBeLessThan(0.00001);
        if (step === 0) expect(new Vector3(0, 0, 1).applyQuaternion(hand.getWorldQuaternion(new Quaternion())).z).toBeGreaterThan(0.98);
        if (step > 0 && step <= 16) expect(grip.y).toBeGreaterThan(previous[index].y);
        if (step > 16) expect(grip.y).toBeLessThan(previous[index].y);
        if (step === 16) expect(grip.y - start[index].y).toBeGreaterThan(0.75);
        if (step === 32) expect(grip.distanceTo(start[index])).toBeLessThan(0.00001);
        if (step > 0) expect(grip.distanceTo(previous[index])).toBeLessThan(0.14);
        previous[index] = grip;
        // Independently test the two plate cylinders and shaft in hand-local space.
        for (const point of points) {
          const local = hand.worldToLocal(point.clone()).sub(new Vector3(sign * 0.03, -0.15, 0.13));
          for (const center of [-0.12, 0.12]) {
            const axial = Math.max(0, Math.abs(local.x - center) - 0.035);
            const radial = Math.max(0, Math.hypot(local.y, local.z) - 0.095);
            minimumClearance = Math.min(minimumClearance, Math.hypot(axial, radial) * 0.85);
          }
          const axial = Math.max(0, Math.abs(local.x) - 0.14);
          const radial = Math.max(0, Math.hypot(local.y, local.z) - 0.024);
          expect(Math.hypot(axial, radial) * 0.85).toBeGreaterThan(0.01);
        }
        // Sample the complete plate surfaces against conservative bounds of the
        // actual bench meshes, including frame, feet and adjustment hardware.
        for (const center of [-0.12, 0.12]) for (const axial of [-0.035, 0, 0.035]) for (let ring = 0; ring < 16; ring++) {
          const angle = ring * Math.PI / 8;
          const point = hand.localToWorld(new Vector3(sign * 0.03 + center + axial, -0.15 + 0.095 * Math.cos(angle), 0.13 + 0.095 * Math.sin(angle)));
          for (const mesh of benchMeshes) {
            const local = mesh.worldToLocal(point.clone()), bounds = mesh.geometry.boundingBox!;
            expect(bounds.distanceToPoint(local)).toBeGreaterThan(0.01);
          }
        }
      }
      // The buttocks meet the pad without passing through its underside.
      if (bench) {
        for (const [target, pattern] of [[bench.seat, /gluteus_maximus/i], [bench.backrest, /latissimus|trapezius|iliocostalis|longissimus/i]] as const) {
          const gaps: number[] = [];
          for (const mesh of rig.meshes.filter(mesh => pattern.test(mesh.name))) {
            for (let vertex = 0; vertex < mesh.geometry.getAttribute("position").count; vertex++) {
              const local = target.worldToLocal(mesh.localToWorld(mesh.getVertexPosition(vertex, new Vector3())));
              const bounds = target.geometry.boundingBox!;
              if (Math.abs(local.x) < 0.2 && local.y > 0.05 && local.y < bounds.max.y - 0.02) gaps.push(local.z - bounds.max.z);
            }
          }
          expect(gaps.length).toBeGreaterThan(100);
          // Surface separation under 1.5 cm, without penetrating the padding.
          expect(Math.min(...gaps)).toBeGreaterThanOrEqual(-0.001);
          expect(Math.min(...gaps)).toBeLessThan(0.015);
        }
        const torsoUp = new Vector3(0, 1, 0).applyQuaternion(rig.bones.torso.getWorldQuaternion(new Quaternion()));
        expect(torsoUp.angleTo(new Vector3(0, 1, 0))).toBeCloseTo(Math.PI / 4, 4);
      } else {
        const seatPoints = points.filter(point => Math.abs(point.x) < 0.24 && point.z > -0.19 && point.z < 0.31 && point.y > 0.6 && point.y < 1);
        const seatedHeight = Math.min(...seatPoints.map(point => point.y));
        expect(seatedHeight).toBeGreaterThan(0.71);
        expect(seatedHeight).toBeLessThan(0.86);
      }
    }
    // 1 cm margin (~0.7% of the displayed body's height) around full plates.
    expect(minimumClearance).toBeGreaterThan(0.01);
  } finally { rig.dispose(); bench?.dispose(); }
}, 60000);
