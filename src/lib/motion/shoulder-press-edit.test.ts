import { describe, expect, it } from "vitest";
import { applyStudioMachine, machineDemoScene, machineHandlePoint, setMachinePosition } from "./studio-machines";
import { Group, Plane, Quaternion, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { sampleWorkshopPose } from "./workshop";
import { machineDragValues, moveMachineWithMouse } from "./workshop-mouse";
import { sampleStudioObject, setStudioObjectAnimated } from "./studio";
import { createQuickScene } from "./quick-create";
import { setSeatOffsets, constrainSeatedEdit } from "./seated-pose";
import { editLeverMachinePose } from "./plate-row-pose";
import { shoulderPressGripRotation } from "./shoulder-press";

describe("independent shoulder press editing", () => {
  it.each([ ["wide", -10], ["wide", 10], ["neutral", -10], ["neutral", 10] ] as const)("bounds a %s-grip torso lean of %s before losing hand contact", (pressGrip, lean) => {
    const scene = createQuickScene("shoulder-press-machine");
    Object.assign(scene.studio!.objects[0], { pressGrip, frames: undefined, machinePosition: .375 });
    const requested = { ...scene, keyframes: scene.keyframes.map((frame, index) => index ? frame : ({ ...frame, poses: { ...frame.poses, torso: { x: lean, y: 0, z: 0 } } })) };
    const next = constrainSeatedEdit(scene, requested, 0);
    const rig = createAnatomyRig(new Group());
    try {
      expect(next.studio!.body).toEqual(scene.studio!.body);
      expect(Math.abs(next.keyframes[0].poses.torso?.x ?? 0)).toBeLessThanOrEqual(Math.abs(lean));
      for (let step = 0; step <= 16; step++) {
        const time = next.durationMs * step / 16;
        const object = sampleStudioObject(next.studio!.objects[0], time);
        expect([object.x, object.y, object.z, object.machinePosition]).toEqual([0, 0, 0, .375]);
        poseAnatomyRig(rig, sampleWorkshopPose(next.keyframes, time), true);
        const report = applyStudioMachine(rig, next, time);
        for (const hand of report!.hands) expect(hand.contactError).toBeLessThan(.005);
        for (const side of ["left", "right"] as const) {
          const palm = shoulderPressGripRotation(object, side);
          expect(rig.handBones[side].getWorldQuaternion(new Quaternion()).angleTo(palm) * 180 / Math.PI).toBeLessThanOrEqual(2.01);
          const normal = pressGrip === "wide" ? new Vector3(0, 0, 1) : new Vector3(side === "left" ? 1 : -1, 0, -1).normalize();
          const plane = new Plane().setFromNormalAndCoplanarPoint(normal.applyQuaternion(rig.bones.torso.getWorldQuaternion(new Quaternion())),
            rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3()));
          expect(Math.abs(plane.distanceToPoint(rig.bones[`${side}-elbow`].getWorldPosition(new Vector3())))).toBeLessThan(.035);
        }
      }
    } finally { rig.dispose(); }
  }, 15_000);
  it.each([0, .2, .5])("preserves the seated offset when leaning at travel %s", travel => {
    let scene = createQuickScene("shoulder-press-machine");
    scene.studio!.objects[0].pressGrip = "neutral";
    for (const side of ["left", "right"] as const) {
      const object = setStudioObjectAnimated(scene.studio!.objects[0], true, 0, scene.keyframes.map(frame => frame.timeMs));
      const next = { ...scene, studio: { ...scene.studio!, objects: [setMachinePosition(object, travel, 0, side)] } };
      scene = constrainSeatedEdit(scene, next, 0);
    }
    const shifted = setSeatOffsets(scene, scene.studio!.objects[0].id, 0, { seatOffsetX: .005 });
    const leaned = constrainSeatedEdit(shifted, editLeverMachinePose(shifted, 0, false, { torso: { x: 2, y: 0, z: 0 } }), 0);
    expect(sampleStudioObject(leaned.studio!.objects[0], 0).seatOffsetX).toBeGreaterThan(.003);
    expect(leaned.keyframes[0].poses.torso!.x).toBeGreaterThan(1);
  }, 15_000);
  it("drags one handle at the current moment without changing the other arm or earlier pose", () => {
    const scene = machineDemoScene("shoulder-press-machine", crypto.randomUUID()), object = scene.studio!.objects[0];
    object.frames = undefined; object.machinePosition = 0;
    const target = machineHandlePoint({ ...object, machinePositionLeft: .65 }, "left");
    const drag = machineDragValues(object, target, "left");
    const next = moveMachineWithMouse(scene, object.id, scene.durationMs / 2, drag, "quick");
    const at = sampleStudioObject(next.studio!.objects[0], scene.durationMs / 2);
    expect(at.machinePositionLeft).toBeCloseTo(.65, 6);
    expect(at.machinePositionRight ?? at.machinePosition).toBe(0);
    expect(sampleStudioObject(next.studio!.objects[0], 0).machinePositionLeft ?? 0).toBe(0);
  });
});
