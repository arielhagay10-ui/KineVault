import { describe, expect, it } from "vitest";
import { Group, Quaternion, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { workshopSceneSchema } from "./scene-schema";
import { createStudioObject } from "./studio";
import { studioCableFrame } from "./studio-cable";
import { reachStudioGrip, studioGripOffset, weightGripPoint } from "./studio-grip";
import { blankWorkshopScene, identityTransform, jointLimits, type RigPose } from "./workshop";
import { applyStudioSeating } from "./studio-seat";

const id = "00000000-0000-4000-8000-000000000001";
describe("seated cable workshop", () => {
  it("keeps seated ankles inside their joint range even after solving the legs and adding a foot pose", () => {
    const rig = createAnatomyRig(new Group());
    try {
      for (const facing of ["front", "left", "right", "back"] as const) for (const benchAngle of [45, 65, 85]) {
        const bench = { ...createStudioObject("bench", id, 0), benchAngle };
        for (let step = 0; step <= 16; step++) {
          const pose: RigPose = step === 0 ? {} : { "right-ankle": { x: -45 + 65 * step / 16, y: 20, z: 30 } };
          poseAnatomyRig(rig, pose);
          applyStudioSeating(rig, { body: identityTransform, objects: [bench], seating: { benchId: id, facing } }, step * 300, pose);
          for (const side of ["left", "right"] as const) {
            const foot = rig.footBones[side];
            const angles = { x: -foot.rotation.x * 180 / Math.PI, y: foot.rotation.y * 180 / Math.PI, z: -foot.rotation.z * 180 / Math.PI };
            for (const axis of ["x", "y", "z"] as const) {
              const limits = jointLimits[`${side}-ankle`][axis];
              expect(angles[axis]).toBeGreaterThanOrEqual(limits[0] - 0.000001);
              expect(angles[axis]).toBeLessThanOrEqual(limits[1] + 0.000001);
            }
            if (!step) {
              const shin = rig.bones[`${side}-knee`].getWorldPosition(new Vector3()).sub(foot.getWorldPosition(new Vector3())).normalize();
              expect(shin.angleTo(new Vector3(0, 1, 0))).toBeLessThan(25 * Math.PI / 180);
            }
          }
        }
      }
    } finally { rig.dispose(); }
  });
  it("keeps the pelvis on a moved bench and both feet planted in all three outward directions", () => {
    const rig = createAnatomyRig(new Group()), body = new Group(); body.add(rig.root);
    const bench = { ...createStudioObject("bench", id, 0), x: 0.4, z: -0.3, rotationY: 30, scale: 1.2 };
    const bodyTransform = { ...identityTransform, x: -0.2, z: 0.5, rotationY: -25, scale: 1.2 };
    body.position.set(bodyTransform.x, 0, bodyTransform.z); body.rotation.y = -25 * Math.PI / 180; body.scale.setScalar(1.2);
    try {
      for (const [facing, yaw] of [["front", 0], ["left", 90], ["right", -90]] as const) {
        let feet: Vector3[] = [];
        for (let step = 0; step <= 16; step++) {
          const pose = { "left-shoulder": { x: 0, y: 0, z: -step * 5 } };
          poseAnatomyRig(rig, pose);
          applyStudioSeating(rig, { body: bodyTransform, objects: [bench], seating: { benchId: id, facing } }, step * 200, pose);
          body.updateMatrixWorld(true);
          const pelvis = rig.bones.pelvis.getWorldPosition(new Vector3());
          const benchRotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 6);
          const expected = new Vector3(0, 0.82, 0.56).multiplyScalar(1.2).applyQuaternion(benchRotation).add(new Vector3(0.4, 0, -0.3));
          expect(pelvis.distanceTo(expected)).toBeLessThan(0.025);
          const forward = new Vector3(0, 0, 1).applyQuaternion(rig.root.getWorldQuaternion(new Quaternion()));
          expect(forward.angleTo(new Vector3(Math.sin((30 + yaw) * Math.PI / 180), 0, Math.cos((30 + yaw) * Math.PI / 180)))).toBeLessThan(0.00001);
          const current = [rig.footBones.left, rig.footBones.right].map(foot => foot.getWorldPosition(new Vector3()));
          if (!step) feet = current;
          for (const [i, foot] of current.entries()) {
            expect(foot.distanceTo(feet[i])).toBeLessThan(0.00001);
            expect(foot.y).toBeCloseTo(0.119 * 1.2, 4);
          }
        }
      }
    } finally { rig.dispose(); }
  });
  it("round trips seating, high pulleys and both cuff positions", () => {
    const bench = createStudioObject("bench", id, 0);
    for (const facing of ["front", "left", "right", "back"]) for (const cuffPosition of ["wrist", "upper-arm"]) {
      const studio = { body: identityTransform, seating: { benchId: id, facing }, objects: [bench, {
        ...createStudioObject("cable-machine", "00000000-0000-4000-8000-000000000002", 1),
        cableAttachment: "cuff", cuffPosition, attachment: "left", pulleyHeight: 3,
      }] };
      expect(workshopSceneSchema.parse(JSON.parse(JSON.stringify({ ...blankWorkshopScene, studio }))).studio).toEqual(studio);
    }
  });
  it("rejects detached seating, invalid cuff sites and two arms on one cuff", () => {
    const cable = { ...createStudioObject("cable-machine", id, 0), cableAttachment: "cuff", cuffPosition: "upper-arm", attachment: "left" };
    for (const objects of [[{ ...cable, attachment: "both" }], [{ ...cable, slug: "bench" }], [{ ...cable, cuffPosition: "ankle" }], [{ ...cable, pulleyHeight: 3.21 }]]) {
      expect(workshopSceneSchema.safeParse({ ...blankWorkshopScene, studio: { body: identityTransform, objects } }).success).toBe(false);
    }
    expect(workshopSceneSchema.safeParse({ ...blankWorkshopScene, studio: { body: identityTransform, objects: [], seating: { benchId: id, facing: "front" } } }).success).toBe(false);
  });
  it("separates two kettlebell grips enough for two hands without stretching arms", () => {
    const rig = createAnatomyRig(new Group()), bell = new Group();
    const object = { ...createStudioObject("kettlebell", id, 0), attachment: "both" as const };
    try {
      for (let step = 0; step <= 16; step++) {
        poseAnatomyRig(rig, {}, true);
        bell.position.set(0, 1.3 + 0.4 * Math.sin(step / 16 * Math.PI), 0.4); bell.updateMatrixWorld(true);
        const hands: Vector3[] = [];
        for (const side of ["left", "right"] as const) {
          const target = bell.localToWorld(weightGripPoint(object, side));
          const upper = rig.bones[`${side}-elbow`].position.length() * 0.85;
          expect(reachStudioGrip(rig, side, target, new Quaternion())).toBeLessThan(0.005);
          hands.push(rig.handBones[side].localToWorld(studioGripOffset(side)));
          expect(rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3()).distanceTo(rig.bones[`${side}-elbow`].getWorldPosition(new Vector3()))).toBeCloseTo(upper, 6);
        }
        expect(hands[0].distanceTo(hands[1])).toBeGreaterThan(0.2);
      }
    } finally { rig.dispose(); }
  });
  it("attaches cuffs to the arm without moving the pose or closing the hand", () => {
    const rig = createAnatomyRig(new Group()), tower = new Group(), body = new Group(); body.add(rig.root);
    body.position.set(0.3, 0.1, -0.2); body.rotation.y = 0.7; body.scale.setScalar(1.2);
    tower.position.set(1, 0, 1); tower.scale.setScalar(0.7);
    try {
      for (const side of ["left", "right"] as const) for (const cuffPosition of ["wrist", "upper-arm"] as const) for (let step = 0; step <= 16; step++) {
        const pose = { [`${side}-shoulder`]: { x: -40, y: 0, z: (side === "left" ? -1 : 1) * (20 + step * 4) }, [`${side}-elbow`]: { x: 95, y: 0, z: 0 } };
        poseAnatomyRig(rig, pose); body.updateMatrixWorld(true);
        const shoulder = rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3());
        const elbow = rig.bones[`${side}-elbow`].getWorldPosition(new Vector3());
        const wrist = rig.handBones[side].getWorldPosition(new Vector3());
        const rotation = rig.handBones[side].getWorldQuaternion(new Quaternion());
        const frame = studioCableFrame(rig, { ...createStudioObject("cable-machine", id, 0), attachment: side, cableAttachment: "cuff", cuffPosition }, tower, pose);
        const expected = cuffPosition === "wrist" ? wrist : elbow.clone().lerp(shoulder, 0.22);
        expect(frame.center.distanceTo(expected)).toBeLessThan(0.00001);
        expect(rig.handBones[side].getWorldQuaternion(new Quaternion()).angleTo(rotation)).toBeLessThan(0.00001);
        expect(rig.bones[`${side}-elbow`].getWorldPosition(new Vector3()).distanceTo(elbow)).toBeLessThan(0.00001);
        const axis = new Vector3(0, 1, 0).applyQuaternion(frame.rotation);
        const arm = (cuffPosition === "wrist" ? elbow.clone().sub(wrist) : shoulder.clone().sub(elbow)).normalize();
        expect(Math.abs(axis.dot(arm))).toBeGreaterThan(0.999);
        expect(frame.connection.distanceTo(frame.center)).toBeGreaterThan(0.04);
      }
    } finally { rig.dispose(); }
  });
});
