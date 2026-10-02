import { describe, expect, it } from "vitest";
import { Group, Quaternion, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { constrainSupportedWeight, reachStudioGrip, studioForearmReach, studioGripOffset } from "./studio-grip";

describe("studio weight grips", () => {
  it("keeps grip contact on the locked curl arc when equipment keyframes interpolate in a straight line", () => {
    const rig = createAnatomyRig(new Group());
    try {
      const wrist = { x: -90, y: 0, z: 0 };
      const pose = { "right-shoulder": { x: 45, y: 0, z: 0 }, "right-wrist": wrist };
      poseAnatomyRig(rig, { ...pose, "right-elbow": { x: 20, y: 0, z: 0 } }, "right");
      const anchor = rig.bones["right-elbow"].getWorldPosition(new Vector3());
      const start = rig.handBones.right.localToWorld(studioGripOffset("right"));
      poseAnatomyRig(rig, { ...pose, "right-elbow": { x: 110, y: 0, z: 0 } }, "right");
      const end = rig.handBones.right.localToWorld(studioGripOffset("right"));
      const radius = studioForearmReach(rig, "right");
      let previous: Vector3 | null = null;
      for (let step = 0; step <= 16; step++) {
        poseAnatomyRig(rig, pose, "right");
        const progress = step <= 8 ? step / 8 : (16 - step) / 8;
        const target = constrainSupportedWeight(start.clone().lerp(end, progress), [{ center: anchor, radius }]);
        expect(reachStudioGrip(rig, "right", target, new Quaternion(), wrist, anchor)).toBeLessThan(1e-5);
        expect(rig.bones["right-elbow"].getWorldPosition(new Vector3()).distanceTo(anchor)).toBeLessThan(1e-5);
        expect(rig.handBones.right.localToWorld(studioGripOffset("right")).distanceTo(target)).toBeLessThan(1e-5);
        // A 90° curl over eight intervals must not jump over 22.5° in one interval.
        if (previous) expect(target.clone().sub(anchor).angleTo(previous.clone().sub(anchor))).toBeLessThan(Math.PI / 8);
        previous = target;
      }
    } finally { rig.dispose(); }
  });

  it("projects a rigid bar onto the common reach of two supported elbows", () => {
    const supports = [{ center: new Vector3(-0.15, 1.4, 0), radius: 0.45 }, { center: new Vector3(0.15, 1.4, 0), radius: 0.45 }];
    for (let step = 0; step <= 16; step++) {
      const target = constrainSupportedWeight(new Vector3(0.2, 1.1 + step * 0.04, 0.3), supports);
      for (const support of supports) expect(target.distanceTo(support.center)).toBeCloseTo(support.radius, 6);
    }
  });
  it("keeps a supported elbow fixed through 17 curl samples without stretching either arm segment", () => {
    const rig = createAnatomyRig(new Group()), reference = createAnatomyRig(new Group());
    try {
      for (const side of ["left", "right"] as const) {
        const wrist = { x: -90, y: 0, z: 0 };
        const start = { [`${side}-shoulder`]: { x: 45, y: 0, z: 0 }, [`${side}-elbow`]: { x: 20, y: 0, z: 0 }, [`${side}-wrist`]: wrist };
        poseAnatomyRig(reference, start, side);
        const anchor = reference.bones[`${side}-elbow`].getWorldPosition(new Vector3());
        const upperLength = reference.bones[`${side}-shoulder`].getWorldPosition(new Vector3()).distanceTo(anchor);
        const lowerLength = reference.handBones[side].getWorldPosition(new Vector3()).distanceTo(anchor);
        let previous: Quaternion | null = null;
        for (let step = 0; step <= 16; step++) {
          const flexion = 20 + 90 * Math.sin(step / 16 * Math.PI);
          poseAnatomyRig(reference, { ...start, [`${side}-elbow`]: { x: flexion, y: 0, z: 0 } }, side);
          const target = reference.handBones[side].localToWorld(studioGripOffset(side));
          const rotation = reference.handBones[side].getWorldQuaternion(new Quaternion());
          poseAnatomyRig(rig, { [`${side}-wrist`]: wrist }, side);
          expect(reachStudioGrip(rig, side, target, rotation, wrist, anchor)).toBeLessThan(1e-5);
          const elbow = rig.bones[`${side}-elbow`].getWorldPosition(new Vector3());
          expect(elbow.distanceTo(anchor)).toBeLessThan(1e-5);
          expect(rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3()).distanceTo(elbow)).toBeCloseTo(upperLength, 6);
          expect(rig.handBones[side].getWorldPosition(new Vector3()).distanceTo(elbow)).toBeCloseTo(lowerLength, 6);
          expect(rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(target)).toBeLessThan(1e-5);
          expect(rig.handBones[side].quaternion.angleTo(new Quaternion())).toBeLessThan(1e-5);
          const current = rig.handBones[side].getWorldQuaternion(new Quaternion());
          if (previous) expect(current.angleTo(previous)).toBeLessThan(0.4);
          previous = current;
        }
        poseAnatomyRig(rig, start, side);
        expect(reachStudioGrip(rig, side, new Vector3(10, 10, 10), new Quaternion(), wrist, anchor)).toBeGreaterThan(1);
        expect(rig.bones[`${side}-elbow`].getWorldPosition(new Vector3()).distanceTo(anchor)).toBeLessThan(1e-5);
      }
    } finally { rig.dispose(); reference.dispose(); }
  });
  it("keeps both palms on the bar and wrists neutral throughout a moved bar path", () => {
    const rig = createAnatomyRig(new Group());
    try {
      for (let step = 0; step <= 16; step++) {
        const progress = step / 16;
        poseAnatomyRig(rig, {}, true);
        for (const side of ["left", "right"] as const) {
          const target = new Vector3(side === "left" ? 0.4 : -0.4, 1.4 + progress * 0.4, 0.35);
          const error = reachStudioGrip(rig, side, target, new Quaternion());
          expect(error).toBeLessThan(1e-5);
          expect(rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(target)).toBeLessThan(1e-5);
          expect(rig.handBones[side].quaternion.angleTo(new Quaternion())).toBeLessThan(1e-5);
          const shaft = new Vector3(1, 0, 0).applyQuaternion(rig.handBones[side].getWorldQuaternion(new Quaternion()));
          expect(shaft.dot(new Vector3(1, 0, 0))).toBeCloseTo(1, 5);
        }
      }
    } finally { rig.dispose(); }
  });

  it("preserves grip contact after moving, turning and scaling the figure", () => {
    const rig = createAnatomyRig(new Group());
    const body = new Group(); body.position.set(1, 0.2, -1); body.rotation.y = Math.PI / 4; body.scale.setScalar(1.3); body.add(rig.root);
    try {
      poseAnatomyRig(rig, {}, "right"); body.updateMatrixWorld(true);
      const target = body.localToWorld(new Vector3(-0.45, 1.5, 0.4));
      expect(reachStudioGrip(rig, "right", target, body.getWorldQuaternion(new Quaternion()))).toBeLessThan(1e-5);
      expect(rig.handBones.right.localToWorld(studioGripOffset("right")).distanceTo(target)).toBeLessThan(1e-5);
    } finally { rig.dispose(); }
  });

  it("reports unreachable equipment instead of claiming contact", () => {
    const rig = createAnatomyRig(new Group());
    try {
      poseAnatomyRig(rig, {}, true);
      expect(reachStudioGrip(rig, "left", new Vector3(10, 1.5, 0), new Quaternion())).toBeGreaterThan(1);
    } finally { rig.dispose(); }
  });
  it("turns each held palm independently while retaining grip contact and authored wrist bends", () => {
    const rig = createAnatomyRig(new Group());
    try {
      for (const side of ["left", "right"] as const) {
        const target = new Vector3(side === "left" ? 0.4 : -0.4, 1.5, 0.35);
        const rotations: Quaternion[] = [];
        for (const turn of [-90, 0, 90]) {
          const wrist = { x: turn, y: 20, z: -10 };
          poseAnatomyRig(rig, { [`${side}-wrist`]: wrist }, true);
          const bend = rig.handBones[side].quaternion.clone();
          expect(reachStudioGrip(rig, side, target, new Quaternion(), wrist)).toBeLessThan(1e-5);
          expect(rig.handBones[side].quaternion.angleTo(bend)).toBeLessThan(1e-5);
          const rotation = rig.handBones[side].getWorldQuaternion(new Quaternion());
          rotations.push(rotation);
        }
        expect(rotations[0].angleTo(rotations[2])).toBeGreaterThan(2);
        expect(rotations[0].angleTo(rotations[1])).toBeGreaterThan(1);
      }
    } finally { rig.dispose(); }
  });
  it("allows free forearm turns without shifting the wrist and keeps the other arm unchanged", () => {
    const rig = createAnatomyRig(new Group());
    try {
      const elbow = { x: 90, y: 0, z: 0 };
      poseAnatomyRig(rig, { "left-elbow": elbow, "left-wrist": { x: -90, y: 0, z: 0 } });
      const position = rig.handBones.left.getWorldPosition(new Vector3());
      const rotation = rig.handBones.left.getWorldQuaternion(new Quaternion());
      const right = rig.handBones.right.getWorldQuaternion(new Quaternion());
      poseAnatomyRig(rig, { "left-elbow": elbow, "left-wrist": { x: 90, y: 0, z: 0 } });
      expect(rig.handBones.left.getWorldPosition(new Vector3()).distanceTo(position)).toBeLessThan(1e-5);
      expect(rig.handBones.left.getWorldQuaternion(new Quaternion()).angleTo(rotation)).toBeCloseTo(Math.PI, 5);
      expect(rig.handBones.right.getWorldQuaternion(new Quaternion()).angleTo(right)).toBeLessThan(1e-5);
    } finally { rig.dispose(); }
  });
  it("faces the palms upward and downward for the corresponding held bar presets", () => {
    const rig = createAnatomyRig(new Group());
    try {
      for (const side of ["left", "right"] as const) {
        for (const turn of [-90, 90]) {
          const wrist = { x: turn, y: 0, z: 0 };
          poseAnatomyRig(rig, { [`${side}-wrist`]: wrist }, true);
          const error = reachStudioGrip(rig, side, new Vector3(side === "left" ? 0.4 : -0.4, 1.5, 0.4), new Quaternion(), wrist);
          expect(error).toBeLessThan(1e-5);
          const palm = new Vector3(0, 0, 1).applyQuaternion(rig.handBones[side].getWorldQuaternion(new Quaternion()));
          expect(palm.y * (turn === -90 ? 1 : -1), `${side} turn ${turn}, palm ${palm.toArray()}`).toBeGreaterThan(0.1);
          const gripAxis = new Vector3(1, 0, 0).applyQuaternion(rig.handBones[side].getWorldQuaternion(new Quaternion()));
          expect(Math.abs(gripAxis.x)).toBeGreaterThan(0.999);
        }
      }
    } finally { rig.dispose(); }
  });
  it("turns a held palm smoothly through a full supination-to-pronation animation", () => {
    const rig = createAnatomyRig(new Group());
    try {
      for (const side of ["left", "right"] as const) {
        let previous: Quaternion | null = null;
        for (let step = 0; step <= 16; step++) {
          const wrist = { x: -90 + step * 180 / 16, y: 0, z: 0 };
          poseAnatomyRig(rig, { [`${side}-wrist`]: wrist }, true);
          expect(reachStudioGrip(rig, side, new Vector3(side === "left" ? 0.4 : -0.4, 1.5, 0.4), new Quaternion(), wrist)).toBeLessThan(1e-5);
          const current = rig.handBones[side].getWorldQuaternion(new Quaternion());
          if (previous) expect(current.angleTo(previous), `${side} step ${step}`).toBeLessThan(0.6);
          previous = current;
        }
      }
    } finally { rig.dispose(); }
  });
});
