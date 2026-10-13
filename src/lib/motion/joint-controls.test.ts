import { describe, expect, it } from "vitest";
import { Group, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { workshopSceneSchema } from "./scene-schema";
import * as workshop from "./workshop";

describe("manual arm joint controls", () => {
  it("limits backward shoulder travel while preserving forward and lateral overhead reach", () => {
    for (const side of ["left", "right"] as const) {
      expect(workshop.jointControlRange(`${side}-shoulder`, "x")).toEqual([-160, 50]);
      expect(workshop.jointControlRange(`${side}-shoulder`, "z")).toEqual(side === "left" ? [-170, 50] : [-50, 170]);
    }
  });

  it("clamps manual elbow bends to the hinge and keeps forearm turn available at the wrist", () => {
    expect(workshop.clampJointControlAngles).toBeTypeOf("function");
    for (const side of ["left", "right"] as const) {
      expect(workshop.clampJointControlAngles(`${side}-elbow`, { x: -15, y: 20, z: 150 })).toEqual({ x: 0, y: 0, z: 0 });
      expect(workshop.clampJointControlAngles(`${side}-elbow`, { x: 155, y: -20, z: -150 })).toEqual({ x: 150, y: 0, z: 0 });
      expect(workshop.clampJointControlAngles(`${side}-wrist`, { x: 85, y: 0, z: 0 })).toEqual({ x: 85, y: 0, z: 0 });
    }
  });

  it("keeps compound backward shoulder edits below the torso on a reclined body without stretching", () => {
    expect(workshop.clampJointControlAngles).toBeTypeOf("function");
    const rig = createAnatomyRig(new Group()), parent = new Group();
    parent.rotation.set(55 * Math.PI / 180, 30 * Math.PI / 180, 0);
    parent.add(rig.root);
    try {
      for (const side of ["left", "right"] as const) {
        const shoulder = `${side}-shoulder` as const, elbow = `${side}-elbow` as const;
        poseAnatomyRig(rig, {});
        const upperLength = rig.bones[shoulder].getWorldPosition(new Vector3()).distanceTo(rig.bones[elbow].getWorldPosition(new Vector3()));
        const lowerLength = rig.bones[elbow].getWorldPosition(new Vector3()).distanceTo(rig.handBones[side].getWorldPosition(new Vector3()));
        for (let step = 0; step <= 16; step++) {
          const sign = side === "left" ? 1 : -1;
          poseAnatomyRig(rig, {
            [shoulder]: workshop.clampJointControlAngles(shoulder, { x: step * 10, y: sign * 30, z: sign * 35 }),
            [elbow]: workshop.clampJointControlAngles(elbow, { x: step * 10, y: 20, z: sign * 150 }),
          });
          const origin = rig.bones[shoulder].getWorldPosition(new Vector3());
          const hinge = rig.bones[elbow].getWorldPosition(new Vector3());
          const hand = rig.handBones[side].getWorldPosition(new Vector3());
          expect(origin.distanceTo(hinge)).toBeCloseTo(upperLength, 6);
          expect(hinge.distanceTo(hand)).toBeCloseTo(lowerLength, 6);
          const direction = rig.bones[shoulder].parent!.worldToLocal(hinge.clone()).sub(rig.bones[shoulder].position);
          expect(direction.y).toBeLessThan(0);
          expect(Math.atan2(-direction.z, -direction.y) * 180 / Math.PI).toBeLessThan(65);
        }
        for (const angles of [{ x: -160, y: 0, z: 0 }, { x: 0, y: 0, z: side === "left" ? -170 : 170 }]) {
          poseAnatomyRig(rig, { [shoulder]: workshop.clampJointControlAngles(shoulder, angles) });
          const hinge = rig.bones[elbow].getWorldPosition(new Vector3());
          const local = rig.bones[shoulder].parent!.worldToLocal(hinge).sub(rig.bones[shoulder].position);
          expect(local.y).toBeGreaterThan(upperLength * .8);
        }
      }
    } finally { rig.dispose(); }
  });

  it("preserves existing saved rotations until that joint is edited", () => {
    const scene = structuredClone(workshop.blankWorkshopScene);
    scene.keyframes[0].poses["left-shoulder"] = { x: 150, y: 90, z: 160 };
    scene.keyframes[0].poses["left-elbow"] = { x: -15, y: 20, z: 150 };
    expect(workshopSceneSchema.safeParse(scene).success).toBe(true);
    expect(workshop.sampleWorkshopPose(scene.keyframes, 0)["left-shoulder"]).toEqual({ x: 150, y: 90, z: 160 });
  });

  it("blocks compound rotations that point the upper arm backward above the shoulder", () => {
    const rig = createAnatomyRig(new Group());
    try {
      for (const side of ["left", "right"] as const) {
        const joint = `${side}-shoulder` as const, sign = side === "left" ? 1 : -1;
        for (const angles of [
          { x: -160, y: -80 * sign, z: -90 * sign },
          { x: 50, y: 80 * sign, z: -90 * sign },
          { x: -80, y: -70 * sign, z: -150 * sign },
        ]) {
          const bounded = workshop.clampJointControlAngles(joint, angles);
          poseAnatomyRig(rig, { [joint]: bounded });
          const upper = rig.bones[`${side}-elbow`].getWorldPosition(new Vector3()).sub(rig.bones[joint].getWorldPosition(new Vector3())).normalize();
          // The atlas's resting humerus has a small carrying angle. Permit that
          // offset around the control's ideal -Y axis at straight overhead.
          if (upper.y > 0) expect(upper.z).toBeGreaterThan(-.18);
          else expect(Math.atan2(-upper.z, -upper.y) * 180 / Math.PI).toBeLessThan(65);
          const repeated = workshop.clampJointControlAngles(joint, bounded);
          for (const axis of ["x", "y", "z"] as const) expect(repeated[axis]).toBeCloseTo(bounded[axis], 6);
        }
      }
    } finally { rig.dispose(); }
  });
});
