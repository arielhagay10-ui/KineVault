import { readFile } from "node:fs/promises";
import { Group, Quaternion, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { beforeAll, describe, expect, it } from "vitest";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { applyStudioSeating } from "./studio-seat";
import { createStudioObject } from "./studio";
import { workshopSceneSchema } from "./scene-schema";
import { blankWorkshopScene, identityTransform, type BenchFacing } from "./workshop";
import { suggestSceneDetails } from "../private-exercises/details";

const benchId = "00000000-0000-4000-8000-000000000098";
let source: Group;
beforeAll(async () => {
  const bytes = await readFile("public/models/z-anatomy/model.glb");
  source = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "")).scene;
});
describe("lying on an adjustable bench", () => {
  it.each(["supine", "prone"])("saves and restores a %s body position", facing => {
    const scene = { ...blankWorkshopScene, studio: { body: identityTransform, objects: [createStudioObject("bench", benchId, 0)], seating: { benchId, facing } } };
    expect(workshopSceneSchema.safeParse(JSON.parse(JSON.stringify(scene))).success).toBe(true);
    expect(suggestSceneDetails(scene as typeof blankWorkshopScene, [], [{ slug: "seated", name: "Seated" }]).bodyPosition).toBeNull();
  });
  it.each(["supine", "prone"])("aligns the %s torso to the pad throughout an animated rep", facing => {
    const rig = createAnatomyRig(new Group()), body = new Group(); body.add(rig.root);
    body.position.set(-.2, .1, .3); body.rotation.y = -.3; body.scale.setScalar(1.2);
    try {
      for (const benchAngle of [0, 25, 45, 85]) {
        const bench = { ...createStudioObject("bench", benchId, 0), benchAngle, x: .4, y: .1, z: -.3, rotationY: 30, scale: 1.2 };
        const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 6);
        const up = new Vector3(0, Math.sin(benchAngle * Math.PI / 180), -Math.cos(benchAngle * Math.PI / 180)).applyQuaternion(rotation);
        const normal = new Vector3(0, Math.cos(benchAngle * Math.PI / 180), Math.sin(benchAngle * Math.PI / 180)).applyQuaternion(rotation);
        let pelvis: Vector3 | undefined;
        for (let frame = 0; frame <= 16; frame++) {
          const pose = { "left-elbow": { x: 20 + 80 * Math.sin(frame / 16 * Math.PI), y: 0, z: 0 } };
          poseAnatomyRig(rig, pose);
          applyStudioSeating(rig, { body: { ...identityTransform, scale: 1.2 }, objects: [bench], seating: { benchId, facing: facing as BenchFacing } }, frame * 200, pose);
          const torso = rig.bones.torso.getWorldQuaternion(new Quaternion());
          expect(new Vector3(0, 1, 0).applyQuaternion(torso).angleTo(up)).toBeLessThan(.00001);
          expect(new Vector3(0, 0, facing === "supine" ? 1 : -1).applyQuaternion(torso).angleTo(normal)).toBeLessThan(.00001);
          const current = rig.bones.pelvis.getWorldPosition(new Vector3());
          if (!pelvis) pelvis = current.clone();
          expect(current.distanceTo(pelvis)).toBeLessThan(.00001);
          expect(rig.bones["left-elbow"].rotation.x).toBeCloseTo(-pose["left-elbow"].x * Math.PI / 180, 6);
        }
      }
    } finally { rig.dispose(); }
  });
  it.each(["supine", "prone"])("supports actual %s anatomy without sinking into the pad or floor", facing => {
    const rig = createAnatomyRig(source);
    const contact = rig.meshes.filter(mesh => (facing === "supine" ? /latissimus|trapezius|gluteus_maximus/i : /pectoralis_major/i).test(mesh.name));
    const soles = rig.meshes.filter(mesh => /calcaneus|metatarsal/.test(mesh.name.toLowerCase()));
    try {
      for (const benchAngle of [0, 25, 45, 85]) {
        const angle = benchAngle * Math.PI / 180;
        const normal = new Vector3(0, Math.cos(angle), Math.sin(angle));
        const along = new Vector3(0, Math.sin(angle), -Math.cos(angle));
        const bench = { ...createStudioObject("bench", benchId, 0), ...identityTransform, benchAngle };
        for (let step = 0; step <= 16; step++) {
          const pose = { "left-elbow": { x: 20 + 80 * Math.sin(step / 16 * Math.PI), y: 0, z: 0 } };
          poseAnatomyRig(rig, pose);
          applyStudioSeating(rig, { body: identityTransform, objects: [bench], seating: { benchId, facing: facing as BenchFacing } }, step * 200, pose);
          rig.root.updateMatrixWorld(true); rig.skeleton.update();
          let gap = Infinity, sole = Infinity;
          for (const mesh of contact) for (let vertex = 0; vertex < mesh.geometry.getAttribute("position").count; vertex++) {
            const point = mesh.localToWorld(mesh.getVertexPosition(vertex, new Vector3()));
            const local = point.clone().sub(new Vector3(0, .673, .253));
            const distance = local.dot(along);
            if (Math.abs(point.x) < .18 && distance > .05 && distance < 1.55) gap = Math.min(gap, local.dot(normal) - .054);
          }
          for (const mesh of soles) for (let vertex = 0; vertex < mesh.geometry.getAttribute("position").count; vertex++) {
            sole = Math.min(sole, mesh.localToWorld(mesh.getVertexPosition(vertex, new Vector3())).y);
          }
          expect(gap, `${facing} pad contact at ${benchAngle} degrees`).toBeGreaterThan(-.005);
          expect(gap, `${facing} pad contact at ${benchAngle} degrees`).toBeLessThan(.03);
          expect(sole, `${facing} sole at ${benchAngle} degrees`).toBeGreaterThan(-.01);
          expect(sole, `${facing} sole at ${benchAngle} degrees`).toBeLessThan(.03);
        }
      }
    } finally { rig.dispose(); }
  });
});
