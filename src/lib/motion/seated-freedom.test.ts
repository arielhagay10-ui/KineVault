import { describe, expect, it } from "vitest";
import { Group, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { applyStudioMachine, machineDemoScene } from "./studio-machines";
import { applyStudioSeating } from "./studio-seat";
import { createStudioObject } from "./studio";
import { identityTransform, type RigPose } from "./workshop";

const id = "00000000-0000-4000-8000-000000000001";
const pose: RigPose = { torso: { x: -10, y: 8, z: 0 }, "left-hip": { x: -65, y: 10, z: 0 }, "left-knee": { x: -80, y: 0, z: 0 } };

describe("supported seating freedom", () => {
  it.each(["row-machine", "shoulder-press-machine", "lat-pulldown-machine", "cable-row-machine", "pec-deck", "leg-press"] as const)("preserves authored torso and slides the pelvis on %s", slug => {
    const scene = machineDemoScene(slug, id), object = scene.studio!.objects[0];
    object.frames = undefined;
    const rig = createAnatomyRig(new Group());
    try {
      poseAnatomyRig(rig, pose, true);
      const torso = rig.bones.torso.quaternion.clone();
      applyStudioMachine(rig, scene, 0);
      expect(rig.bones.torso.quaternion.angleTo(torso)).toBeLessThan(1e-6);
      const before = rig.bones.pelvis.getWorldPosition(new Vector3());
      Object.assign(object, { seatOffsetX: .05, seatOffsetZ: .08 });
      poseAnatomyRig(rig, pose, true); applyStudioMachine(rig, scene, 0);
      const delta = rig.bones.pelvis.getWorldPosition(new Vector3()).sub(before);
      expect(delta.x).toBeCloseTo(.05, 5);
      expect(delta.y).toBeCloseTo(0, 5);
      expect(delta.z).toBeCloseTo(.08, 5);
    } finally { rig.dispose(); }
  });

  it.each(["row-machine", "shoulder-press-machine", "lat-pulldown-machine", "cable-row-machine", "pec-deck"] as const)("keeps authored legs when optional foot support is released on %s", slug => {
    const scene = machineDemoScene(slug, id);
    Object.assign(scene.studio!.objects[0], { seatFootSupport: false });
    const rig = createAnatomyRig(new Group());
    try {
      poseAnatomyRig(rig, pose, true);
      const hip = rig.bones["left-hip"].quaternion.clone(), knee = rig.bones["left-knee"].quaternion.clone();
      applyStudioMachine(rig, scene, 0);
      expect(rig.bones["left-hip"].quaternion.angleTo(hip)).toBeLessThan(1e-6);
      expect(rig.bones["left-knee"].quaternion.angleTo(knee)).toBeLessThan(1e-6);
    } finally { rig.dispose(); }
  });

  it("supports bench sliding and independent legs without cancelling torso lean", () => {
    const bench = createStudioObject("bench", id, 0);
    Object.assign(bench, { seatOffsetX: .05, seatOffsetZ: .08, seatFootSupport: false });
    const studio = { body: identityTransform, objects: [bench], seating: { benchId: id, facing: "front" as const } };
    const rig = createAnatomyRig(new Group());
    try {
      poseAnatomyRig(rig, pose, true);
      const torso = rig.bones.torso.quaternion.clone(), hip = rig.bones["left-hip"].quaternion.clone();
      applyStudioSeating(rig, studio, 0, pose);
      const pelvis = rig.bones.pelvis.getWorldPosition(new Vector3());
      expect(pelvis.x).toBeCloseTo(bench.x + .05, 5);
      expect(pelvis.z).toBeCloseTo(bench.z + .56 + .08, 5);
      expect(rig.bones.torso.quaternion.angleTo(torso)).toBeLessThan(1e-6);
      expect(rig.bones["left-hip"].quaternion.angleTo(hip)).toBeLessThan(1e-6);
    } finally { rig.dispose(); }
  });
});
