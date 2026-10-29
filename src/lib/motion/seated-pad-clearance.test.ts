import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { Group, Quaternion, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { seatedPadPenetration } from "./seated-pad-clearance";
import { applyStudioMachine, machineDemoScene } from "./studio-machines";
import { createStudioObject } from "./studio";
import { applyStudioSeating } from "./studio-seat";
import { blankWorkshopScene, type WorkshopScene } from "./workshop";
import { constrainSeatedEdit } from "./seated-pose";
import { shoulderPress } from "./shoulder-press";
import { supportSurfaceFrame } from "./support-surfaces";

const id = "00000000-0000-4000-8000-000000000001";
function bench(facing: "front" | "back" | "left" | "right"): WorkshopScene {
  return { ...blankWorkshopScene, studio: { body: { ...blankWorkshopScene.studio!.body }, objects: [{ ...createStudioObject("bench", id, 0), benchAngle: 85 }], seating: { benchId: id, facing } } };
}
function penetration(scene: WorkshopScene, x: number, y = 0) {
  const rig = createAnatomyRig(new Group()), pose = { torso: { x, y, z: 0 } };
  const edited = { ...scene, keyframes: scene.keyframes.map(frame => ({ ...frame, poses: pose })) };
  try {
    poseAnatomyRig(rig, pose, true); applyStudioSeating(rig, edited.studio, 0, pose); applyStudioMachine(rig, edited, 0);
    return seatedPadPenetration(rig, edited.studio!.objects[0], edited.studio?.seating);
  } finally { rig.dispose(); }
}
it("detects leaning through the shoulder press back pad while keeping leaning away free", () => {
  const scene = machineDemoScene("shoulder-press-machine", id);
  expect(penetration(scene, 0)).toBe(0);
  expect(penetration(scene, -5)).toBeGreaterThan(.01);
  expect(penetration(scene, -35)).toBeGreaterThan(.2);
  expect(penetration(scene, 35)).toBe(0);
});
it("detects both sides of supported bench contact without an infinite pad plane", () => {
  expect(penetration(bench("front"), 0)).toBe(0);
  expect(penetration(bench("front"), -25)).toBeGreaterThan(.04);
  expect(penetration(bench("back"), 5)).toBeGreaterThan(.03);
  expect(penetration(bench("back"), -15)).toBe(0);
  const beside = bench("front");
  // Move the complete rig beside the pad rather than extending its finite footprint.
  const rig = createAnatomyRig(new Group());
  try {
    poseAnatomyRig(rig, { torso: { x: -25, y: 0, z: 0 } }); applyStudioSeating(rig, beside.studio, 0, {});
    rig.root.position.x += 2; rig.root.updateMatrixWorld(true);
    expect(seatedPadPenetration(rig, beside.studio!.objects[0], beside.studio!.seating)).toBe(0);
  } finally { rig.dispose(); }
});
it("checks the upper back and chest edges when leaning or twisting into a bench", () => {
  expect(penetration(bench("front"), -15)).toBeGreaterThan(.005);
  expect(penetration(bench("back"), 0, 23.8)).toBeGreaterThan(.01);
});
it.each(["row-machine", "pec-deck", "leg-press"] as const)("measures %s pad contact in its actual facing direction", slug => {
  const scene = machineDemoScene(slug, id), before = penetration(scene, 0), into = slug === "row-machine" ? 5 : -5;
  expect(penetration(scene, into)).toBeGreaterThan(before + .01);
  expect(penetration(scene, -into)).toBeLessThanOrEqual(before);
  if (slug === "pec-deck") {
    scene.studio!.objects[0].machineMode = "reverse";
    expect(penetration(scene, 5)).toBeGreaterThan(penetration(scene, 0) + .01);
  }
});
it("does not invent torso pads on machines without them", () => {
  expect(penetration(machineDemoScene("lat-pulldown-machine", id), -35)).toBe(0);
  expect(penetration(machineDemoScene("cable-row-machine", id), -35)).toBe(0);
});
it("normalizes pad depth across rotated and resized equipment", () => {
  const scene = machineDemoScene("shoulder-press-machine", id), original = penetration(scene, -15);
  Object.assign(scene.studio!.objects[0], { x: 3, y: 1, z: -2, rotationY: 70, scale: 1.7, frames: undefined });
  expect(penetration(scene, -15)).toBeCloseTo(original, 8);
});
it("keeps the real rendered upper torso out of shoulder and bench pads after clamping", async () => {
  const bytes = await readFile("public/models/z-anatomy/model.glb");
  const source = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "")).scene;
  const rig = createAnatomyRig(source), torsoIndex = rig.skeleton.bones.indexOf(rig.bones.torso);
  const vertices = rig.meshes.filter(mesh => /pectoralis_major|trapezius|latissimus/.test(mesh.name)).flatMap(mesh => {
    const indices = mesh.geometry.getAttribute("skinIndex"), weights = mesh.geometry.getAttribute("skinWeight"), selected: number[] = [];
    for (let index = 0; index < indices.count; index++) {
      let torsoWeight = 0;
      for (let part = 0; part < 4; part++) if (indices.getComponent(index, part) === torsoIndex) torsoWeight += weights.getComponent(index, part);
      if (torsoWeight > .9) selected.push(index);
    }
    return [{ mesh, selected }];
  });
  const collisions = (scene: WorkshopScene) => {
    const object = scene.studio!.objects[0], pose = scene.keyframes[0].poses;
    poseAnatomyRig(rig, pose, true); applyStudioSeating(rig, scene.studio, 0, pose); applyStudioMachine(rig, scene, 0);
    rig.root.updateMatrixWorld(true); rig.skeleton.update();
    const frame = object.slug === "bench" ? supportSurfaceFrame(object, "pad") : undefined;
    let count = 0;
    for (const { mesh, selected } of vertices) for (const index of selected) {
      const point = mesh.localToWorld(mesh.getVertexPosition(index, new Vector3()));
      if (frame) {
        point.sub(frame.origin).applyQuaternion(frame.rotation.clone().invert()).divideScalar(frame.scale);
        if (Math.abs(point.x) < .22 && point.y > 0 && point.y < 1.62 && Math.abs(point.z) < .045) count++;
      } else {
        point.sub(new Vector3(...shoulderPress.back.center)).applyQuaternion(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 8 * Math.PI / 180));
        if (Math.abs(point.x) < .2 && Math.abs(point.y) < .52 && Math.abs(point.z) < .065) count++;
      }
    }
    return count;
  };
  try {
    for (const [scene, lean] of [[machineDemoScene("shoulder-press-machine", id), -5], [bench("front"), -25]] as const) {
      const requested = { ...scene, keyframes: scene.keyframes.map((frame, index) => index ? frame : { ...frame, poses: { ...frame.poses, torso: { x: lean, y: 0, z: 0 } } }) };
      expect(collisions(scene)).toBe(0);
      expect(collisions(requested)).toBeGreaterThan(0);
      const guarded = constrainSeatedEdit(scene, requested, 0);
      expect(Math.abs(guarded.keyframes[0].poses.torso!.x)).toBeLessThan(Math.abs(lean));
      expect(collisions(guarded)).toBe(0);
    }
  } finally { rig.dispose(); }
}, 30_000);
