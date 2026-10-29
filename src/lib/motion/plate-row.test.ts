import { describe, expect, it } from "vitest";
import { Group, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { machineDemoScene, applyStudioMachine, machineGripPoint } from "./studio-machines";
import { studioLayoutSchema, workshopSceneSchema } from "./scene-schema";
import { studioGripOffset } from "./studio-grip";
import { plateRow } from "./plate-row";
import { sampleStudioObject } from "./studio";
import { editPlateRowPose, releasePlateRowFeet } from "./plate-row-pose";
import { sampleHeldWeightPose } from "./held-weight-pose";
import { moveMachineWithMouse } from "./workshop-mouse";

describe("plate-loaded row", () => {
  it("animates an individual handle at the selected moment without an animation toggle", () => {
    const scene = machineDemoScene("row-machine", crypto.randomUUID()), raw = scene.studio!.objects[0];
    raw.frames = undefined; raw.machinePosition = 0;
    const next = moveMachineWithMouse(scene, raw.id, scene.durationMs / 2, { machinePosition: .8, side: "left" }, "advanced");
    const object = next.studio!.objects[0];
    expect(sampleStudioObject(object, 0).machinePositionLeft ?? 0).toBe(0);
    expect(sampleStudioObject(object, scene.durationMs / 2).machinePositionLeft).toBe(.8);
    expect(sampleStudioObject(object, scene.durationMs / 2).machinePositionRight ?? 0).toBe(0);
    expect(workshopSceneSchema.safeParse(next).success).toBe(true);
  });
  it("starts at the anatomical elbow extension limit without twisting the hinge", () => {
    const scene = machineDemoScene("row-machine", crypto.randomUUID());
    const rig = createAnatomyRig(new Group());
    try {
      poseAnatomyRig(rig, {}, true); applyStudioMachine(rig, scene, 0);
      for (const side of ["left", "right"] as const) {
        const elbow = rig.bones[`${side}-elbow`];
        expect(Math.abs(elbow.rotation.x), `${side} elbow flexion at start`).toBeLessThan(.001);
        expect(Math.abs(elbow.rotation.y), `${side} elbow sideways`).toBeLessThan(1e-6);
        expect(Math.abs(elbow.rotation.z), `${side} elbow twist`).toBeLessThan(1e-6);
      }
    } finally { rig.dispose(); }
  });

  it("retains seated support with one hand attached and leaves the other arm editable", () => {
    const scene = machineDemoScene("row-machine", crypto.randomUUID());
    Object.assign(scene.studio!.objects[0], { attachment: "left", rowSeatHeight: .7, rowGrip: "wide" });
    expect(studioLayoutSchema.safeParse(scene.studio).success).toBe(true);
    const rig = createAnatomyRig(new Group());
    try {
      poseAnatomyRig(rig, { "right-shoulder": { x: -20, y: 10, z: 20 }, "right-elbow": { x: 75, y: 0, z: 0 } }, true);
      const freeArm = rig.bones["right-shoulder"].quaternion.clone();
      applyStudioMachine(rig, scene, 0);
      expect(rig.bones["right-shoulder"].quaternion.angleTo(freeArm)).toBeLessThan(1e-6);
      expect(rig.handBones.left.localToWorld(studioGripOffset("left")).distanceTo(machineGripPoint(scene.studio!.objects[0], "left"))).toBeLessThan(.005);
    } finally { rig.dispose(); }
  });

  it.each(["neutral", "wide"] as const)("keeps %s grips and footplate contacts through 17 samples at each seat height", rowGrip => {
    const scene = machineDemoScene("row-machine", crypto.randomUUID()), object = scene.studio!.objects[0];
    const rig = createAnatomyRig(new Group());
    try {
      for (const height of [.56, .66, .78]) for (let i = 0; i <= 16; i++) {
        Object.assign(object, { rowGrip, rowSeatHeight: height, frames: undefined, machinePosition: i / 16 });
        poseAnatomyRig(rig, {}, true); const report = applyStudioMachine(rig, scene, 0);
        for (const side of ["left", "right"] as const) {
          const gap = rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(machineGripPoint(object, side));
          if (rowGrip === "neutral" && height === .78 && i === 0) {
            expect(gap).toBeGreaterThan(.005);
            expect(report?.warnings.some(warning => warning.side === side && warning.kind === "reach")).toBe(true);
          } else expect(gap, `${rowGrip} ${height} ${i} ${side}`).toBeLessThan(.005);
          const sole = rig.footBones[side].localToWorld(new Vector3(0, -.14, .065));
          const top = new Vector3(0, plateRow.foot.thickness / 2, 0)
            .applyAxisAngle(new Vector3(1, 0, 0), plateRow.foot.angle)
            .add(new Vector3((side === "left" ? 1 : -1) * plateRow.foot.x, plateRow.foot.y, plateRow.foot.z));
          const normal = new Vector3(0, 1, 0).applyAxisAngle(new Vector3(1, 0, 0), plateRow.foot.angle);
          expect(sole.sub(top).dot(normal)).toBeCloseTo(0, 3);
          const knee = rig.bones[`${side}-knee`].getWorldPosition(new Vector3());
          expect(Math.abs(knee.x)).toBeGreaterThan(.15);
          expect(Math.abs(knee.x)).toBeLessThan(.43);
          const chest = rig.bones.torso.localToWorld(new Vector3(0, .62, .315));
          expect(Math.abs(chest.z - (plateRow.pad.z - .07))).toBeLessThan(.002);
          if (height === plateRow.seat.standard) expect(report?.hands.find(hand => hand.side === side)?.wristBendDegrees, `${rowGrip} ${height} ${i} ${side} wrist`).toBeLessThan(45);
        }
      }
    } finally { rig.dispose(); }
  });

  it("moves the edited arm's lever and preserves the other lever's path", () => {
    const scene = machineDemoScene("row-machine", crypto.randomUUID());
    const pose = sampleHeldWeightPose(scene, 0);
    const edited = editPlateRowPose(scene, 0, false, { "left-elbow": { ...pose["left-elbow"]!, x: 85 } });
    const object = sampleStudioObject(edited.studio!.objects[0], 0);
    expect(object.machinePositionLeft).toBeGreaterThan(.1);
    expect(object.machinePositionRight ?? object.machinePosition).toBe(0);
    expect(studioLayoutSchema.safeParse(edited.studio).success).toBe(true);
    expect(workshopSceneSchema.safeParse(edited).success).toBe(true);
    expect(sampleStudioObject(edited.studio!.objects[0], scene.durationMs / 2).machinePositionRight ?? 1).toBe(1);
  });

  it("keeps both legs in place when releasing foot support, then permits a single knee edit", () => {
    const scene = machineDemoScene("row-machine", crypto.randomUUID());
    const displayed = sampleHeldWeightPose(scene, 0), free = releasePlateRowFeet(scene);
    expect(free.studio!.objects[0].rowFootSupport).toBe(false);
    for (const frame of free.keyframes) expect(frame.poses["right-knee"]).toEqual(displayed["right-knee"]);
    const edited = editPlateRowPose(scene, 0, false, { "left-knee": { x: -70, y: 0, z: 0 } });
    expect(edited.keyframes[0].poses["right-knee"]).toEqual(displayed["right-knee"]);
    expect(edited.keyframes[1].poses["left-knee"]).toEqual(displayed["left-knee"]);
    expect(workshopSceneSchema.safeParse(edited).success).toBe(true);
  });
});
