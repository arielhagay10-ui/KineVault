import { describe, expect, it } from "vitest";
import { Group, Quaternion, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { createStudioObject } from "./studio";
import { cableLocalGrip, studioCableFrame } from "./studio-cable";
import { reachStudioGrip, studioGripOffset, weightGripPoint } from "./studio-grip";
import { workshopSceneSchema } from "./scene-schema";
import { cableAttachmentSlugs, blankWorkshopScene, identityTransform, type RigPose } from "./workshop";

const id = "00000000-0000-4000-8000-000000000001";
const handleKinds = cableAttachmentSlugs.filter(kind => kind !== "cuff");
describe("workshop cable attachments and kettlebells", () => {
  it("keeps the wide lat bar rigid and both palms attached through an overhead pull", () => {
    const rig = createAnatomyRig(new Group()), body = new Group(), tower = new Group(); body.add(rig.root);
    tower.position.set(.95, 0, 1.2);
    try {
      for (let step = 0; step <= 16; step++) {
        const pull = Math.sin(step / 16 * Math.PI);
        const pose: RigPose = {
          "left-shoulder": { x: -145 + 60 * pull, y: 0, z: 0 }, "right-shoulder": { x: -145 + 60 * pull, y: 0, z: 0 },
          "left-elbow": { x: 20 + 70 * pull, y: 0, z: 0 }, "right-elbow": { x: 20 + 70 * pull, y: 0, z: 0 },
        };
        poseAnatomyRig(rig, pose, true);
        const frame = studioCableFrame(rig, { ...createStudioObject("cable-machine", id, 0), cableAttachment: "lat-bar", attachment: "both", pulleyHeight: 2.8 }, tower, pose);
        expect(frame.reachable, `overhead sample ${step}`).toBe(true);
        for (const side of ["left", "right"] as const) {
          const target = new Vector3(side === "left" ? .5 : -.5, -.08, 0).applyQuaternion(frame.rotation).add(frame.center);
          expect(rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(target)).toBeLessThan(1e-5);
        }
      }
    } finally { rig.dispose(); }
  });
  it("preserves attachment choices and height and rejects incompatible grips/settings", () => {
    const cable = createStudioObject("cable-machine", id, 0);
    for (const kind of handleKinds) {
      for (const attachment of ["none", "left", "right", ...(kind === "d-handle" ? [] : ["both"])] as const) {
        const studio = { body: identityTransform, objects: [{ ...cable, attachment, cableAttachment: kind, pulleyHeight: 1.75 }] };
        expect(workshopSceneSchema.parse(JSON.parse(JSON.stringify({ ...blankWorkshopScene, studio }))).studio).toEqual(studio);
      }
    }
    for (const invalid of [
      { ...cable, cableAttachment: "unknown" }, { ...cable, cableAttachment: null },
      { ...cable, attachment: "both" }, { ...cable, attachment: "both", cableAttachment: "d-handle" },
      { ...cable, slug: "kettlebell", cableAttachment: "rope" }, { ...cable, pulleyHeight: 3.21 },
      { ...cable, pulleyHeight: 0.19 }, { ...cable, pulleyHeight: NaN },
    ]) expect(workshopSceneSchema.safeParse({ ...blankWorkshopScene, studio: { body: identityTransform, objects: [invalid] } }).success).toBe(false);
    const bell = { ...createStudioObject("kettlebell", id, 0), attachment: "both" as const, elbowLocks: { left: { x: 0, y: 1, z: 0 } } };
    expect(workshopSceneSchema.safeParse({ ...blankWorkshopScene, studio: { body: identityTransform, objects: [bell] } }).success).toBe(true);
    expect(workshopSceneSchema.safeParse({ ...blankWorkshopScene, studio: { body: identityTransform, objects: [bell, { ...cable, id: "00000000-0000-4000-8000-000000000002", attachment: "right" }] } }).success).toBe(false);
  });

  for (const kind of handleKinds) for (const side of ["left", "right"] as const) {
    it(`keeps the ${kind} shaft in the ${side} palm through 17 wrist/arm samples with a transformed tower and body`, () => {
      const rig = createAnatomyRig(new Group());
      const body = new Group(); body.position.set(0.5, 0.2, -0.4); body.rotation.y = 0.7; body.scale.setScalar(1.3); body.add(rig.root);
      const tower = new Group(); tower.position.set(-1, 0.1, 0.6); tower.rotation.set(0.1, -0.5, 0.2); tower.scale.setScalar(0.75);
      try {
        for (let step = 0; step <= 16; step++) {
          const pose: RigPose = { [`${side}-elbow`]: { x: 30 + 60 * Math.sin(step / 16 * Math.PI), y: 0, z: 0 }, [`${side}-wrist`]: { x: -90 + step * 180 / 16, y: 0, z: 0 } };
          poseAnatomyRig(rig, pose, side); body.updateMatrixWorld(true);
          const palm = rig.handBones[side].localToWorld(studioGripOffset(side));
          const handRotation = rig.handBones[side].getWorldQuaternion(new Quaternion());
          const frame = studioCableFrame(rig, { ...createStudioObject("cable-machine", id, 0), cableAttachment: kind, attachment: side, pulleyHeight: 0.2 + step * 2.3 / 16 }, tower, pose);
          expect(frame.reachable).toBe(true);
          if (kind === "rope") {
            expect(frame.ropeGrips).toHaveLength(2);
            const tail = frame.ropeGrips[1];
            const sign = tail.side === "left" ? 1 : -1;
            expect(new Vector3(-sign * 0.08, 0, 0).multiplyScalar(frame.scale).applyQuaternion(tail.rotation).add(tail.point).distanceTo(frame.connection)).toBeCloseTo(0.4 * frame.scale, 6);
          }
          const grip = kind === "rope" ? frame.ropeGrips[0] : cableLocalGrip(kind, side);
          const point = kind === "rope" ? grip.point : grip.point.clone().multiplyScalar(frame.scale).applyQuaternion(frame.rotation).add(frame.center);
          const rotation = kind === "rope" ? grip.rotation : frame.rotation.clone().multiply(grip.rotation);
          expect(point.distanceTo(palm)).toBeLessThan(1e-6);
          expect(new Vector3(1, 0, 0).applyQuaternion(rotation).dot(new Vector3(1, 0, 0).applyQuaternion(handRotation))).toBeCloseTo(1, 6);
          expect(tower.worldToLocal(frame.pulley.clone()).y).toBeCloseTo(0.2 + step * 2.3 / 16, 6);
          expect([...frame.connection.toArray(), ...frame.rotation.toArray()].every(Number.isFinite)).toBe(true);
        }
      } finally { rig.dispose(); }
    });
  }

  for (const kind of handleKinds.filter(kind => kind !== "d-handle")) {
    it(`fits a newly held ${kind} to the resting arms`, () => {
      const rig = createAnatomyRig(new Group()), body = new Group(), tower = new Group(); body.add(rig.root);
      try {
        poseAnatomyRig(rig, {}, true);
        const frame = studioCableFrame(rig, { ...createStudioObject("cable-machine", id, 0), cableAttachment: kind, attachment: "both" }, tower, {});
        expect(frame.reachable).toBe(true);
        for (const side of ["left", "right"] as const) {
          const grip = kind === "rope" ? frame.ropeGrips.find(item => item.side === side)! : cableLocalGrip(kind, side);
          const target = kind === "rope" ? grip.point : grip.point.clone().multiplyScalar(frame.scale).applyQuaternion(frame.rotation).add(frame.center);
          expect(rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(target)).toBeLessThan(1e-5);
        }
      } finally { rig.dispose(); }
    });
    it(`moves ${kind} smoothly from resting arms through a curl and back`, () => {
      const rig = createAnatomyRig(new Group()), body = new Group(), tower = new Group(); body.add(rig.root);
      const previous: Partial<Record<"left" | "right", Quaternion>> = {};
      try {
        for (let step = 0; step <= 16; step++) {
          const angle = 70 * Math.sin(step / 16 * Math.PI);
          const pose: RigPose = { "left-elbow": { x: angle, y: 0, z: 0 }, "right-elbow": { x: angle, y: 0, z: 0 } };
          poseAnatomyRig(rig, pose, true);
          const frame = studioCableFrame(rig, { ...createStudioObject("cable-machine", id, 0), cableAttachment: kind, attachment: "both" }, tower, pose);
          expect(frame.reachable, `${kind} sample ${step}`).toBe(true);
          for (const side of ["left", "right"] as const) {
            const rotation = rig.handBones[side].getWorldQuaternion(new Quaternion());
            if (previous[side]) expect(rotation.angleTo(previous[side]!), `${kind} ${side} sample ${step}`).toBeLessThan(0.55);
            previous[side] = rotation;
          }
        }
      } finally { rig.dispose(); }
    });
    it(`keeps both palms on ${kind} without stretching arm segments through a full cycle`, () => {
      const rig = createAnatomyRig(new Group()), body = new Group(), tower = new Group(); body.add(rig.root);
      tower.position.set(-1, 0, 1);
      try {
        for (const scale of [0.5, 1, 2]) for (let step = 0; step <= 16; step++) {
          // Match the author's independently scalable body and equipment.
          body.scale.setScalar(scale); tower.scale.setScalar(scale); body.rotation.y = 0.4;
          const pose: RigPose = { "left-elbow": { x: 50 + 40 * Math.sin(step / 16 * Math.PI), y: 0, z: 0 }, "right-elbow": { x: 50 + 40 * Math.sin(step / 16 * Math.PI), y: 0, z: 0 } };
          poseAnatomyRig(rig, pose, true); body.updateMatrixWorld(true);
          const lengths = (["left", "right"] as const).map(side => ({ upper: rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3()).distanceTo(rig.bones[`${side}-elbow`].getWorldPosition(new Vector3())), lower: rig.handBones[side].getWorldPosition(new Vector3()).distanceTo(rig.bones[`${side}-elbow`].getWorldPosition(new Vector3())) }));
          const frame = studioCableFrame(rig, { ...createStudioObject("cable-machine", id, 0), cableAttachment: kind, attachment: "both" }, tower, pose);
          expect(frame.reachable, `${kind} scale ${scale} sample ${step}`).toBe(true);
          for (const [index, side] of (["left", "right"] as const).entries()) {
            const grip = kind === "rope" ? frame.ropeGrips[index] : cableLocalGrip(kind, side);
            const point = kind === "rope" ? grip.point : grip.point.clone().multiplyScalar(frame.scale).applyQuaternion(frame.rotation).add(frame.center);
            expect(rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(point)).toBeLessThan(1e-5);
            const rotation = kind === "rope" ? grip.rotation : frame.rotation.clone().multiply(grip.rotation);
            expect(Math.abs(new Vector3(1, 0, 0).applyQuaternion(rig.handBones[side].getWorldQuaternion(new Quaternion())).dot(new Vector3(1, 0, 0).applyQuaternion(rotation)))).toBeGreaterThan(0.999);
            expect(rig.handBones[side].quaternion.angleTo(new Quaternion())).toBeLessThan(1e-5);
            const elbow = rig.bones[`${side}-elbow`].getWorldPosition(new Vector3());
            expect(elbow.distanceTo(rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3()))).toBeCloseTo(lengths[index].upper, 6);
            expect(elbow.distanceTo(rig.handBones[side].getWorldPosition(new Vector3()))).toBeCloseTo(lengths[index].lower, 6);
            if (kind === "rope") {
              const tip = new Vector3(side === "left" ? -0.08 : 0.08, 0, 0).multiplyScalar(frame.scale).applyQuaternion(rotation).add(point);
              expect(tip.distanceTo(frame.connection)).toBeCloseTo(0.4 * scale, 6);
            }
          }
        }
      } finally { rig.dispose(); }
    });
  }

  it("keeps kettlebell grips in contact with neutral wrists and its body below the handle", () => {
    const rig = createAnatomyRig(new Group()), bell = new Group();
    try {
      for (const attachment of ["left", "right", "both"] as const) for (let step = 0; step <= 16; step++) {
        poseAnatomyRig(rig, {}, attachment === "both" ? true : attachment);
        bell.position.set(attachment === "both" ? 0 : attachment === "left" ? 0.45 : -0.45, 1.3 + 0.3 * Math.sin(step / 16 * Math.PI), 0.4);
        bell.rotation.y = Math.sin(step / 16 * Math.PI) * 0.3; bell.updateMatrixWorld(true);
        const object = { ...createStudioObject("kettlebell", id, 0), attachment };
        for (const side of attachment === "both" ? ["left", "right"] as const : [attachment]) {
          const grip = bell.localToWorld(weightGripPoint(object, side));
          expect(reachStudioGrip(rig, side, grip, bell.getWorldQuaternion(new Quaternion())), `${attachment} ${side} sample ${step}`).toBeLessThan(1e-5);
          expect(rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(grip)).toBeLessThan(1e-5);
          expect(rig.handBones[side].quaternion.angleTo(new Quaternion())).toBeLessThan(1e-5);
          expect(bell.localToWorld(new Vector3(0, -0.08, 0)).y + 0.153).toBeLessThan(grip.y - 0.02);
        }
      }
    } finally { rig.dispose(); }
  });

  it("keeps released attachments above the floor at the lowest pulley setting", () => {
    const rig = createAnatomyRig(new Group()), tower = new Group();
    try {
      poseAnatomyRig(rig, {}, true);
      for (const kind of cableAttachmentSlugs) {
        const frame = studioCableFrame(rig, { ...createStudioObject("cable-machine", id, 0), cableAttachment: kind, attachment: "none", pulleyHeight: 0.2 }, tower, {});
        expect([...frame.center.toArray(), ...frame.rotation.toArray()].every(Number.isFinite)).toBe(true);
        expect(frame.center.y).toBeGreaterThan(0.3);
      }
    } finally { rig.dispose(); }
  });
});
