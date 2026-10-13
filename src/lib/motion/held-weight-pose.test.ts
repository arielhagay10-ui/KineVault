import { describe, expect, it } from "vitest";
import { Euler, Group, Quaternion, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { automaticWeightTransform, poseArmDrivenWeight, solveDumbbellGrip, weightAtPalm } from "./automatic-weight-grip";
import { canCarryWithArm, carryHeldWeights, editHeldWeightPose, sampleHeldWeightPose } from "./held-weight-pose";
import { createStudioObject, sampleStudioObject, studioPointToWorld } from "./studio";
import { resolveStudioObject } from "./studio-constraints";
import { applyStudioSeating } from "./studio-seat";
import { studioGripOffset, weightGripPoint } from "./studio-grip";
import { workshopSceneSchema } from "./scene-schema";
import { editWorkshopMoment } from "./workshop-freedom";
import { blankWorkshopScene, identityTransform, sampleWorkshopPose, type StudioObject } from "./workshop";

describe("posing while holding a weight", () => {
  it("keeps an unscaled bar attached when a resized figure bends an overhand grip", () => {
    let scene = structuredClone(blankWorkshopScene);
    scene.studio!.body.scale = 2;
    for (const frame of scene.keyframes) for (const side of ["left", "right"] as const) frame.poses[`${side}-wrist`] = { x: 90, y: 0, z: 0 };
    const bar = { ...createStudioObject("barbell", "bar", 0), attachment: "both" as const };
    scene.studio!.objects = [{ ...bar, ...automaticWeightTransform(scene.studio!.body, bar, "both", scene, 0) }];
    const rig = createAnatomyRig(new Group()), parent = new Group(); parent.scale.setScalar(2); parent.add(rig.root);
    let previous: Quaternion | undefined;
    try {
      for (let bend = 85; bend <= 90; bend++) {
        scene = editHeldWeightPose(scene, 0, "selected", { "left-elbow": { x: bend, y: 0, z: 0 }, "right-elbow": { x: bend, y: 0, z: 0 } });
        const pose = sampleWorkshopPose(scene.keyframes, 0); poseAnatomyRig(rig, pose, true);
        const solved = poseArmDrivenWeight(rig, scene.studio!.objects[0], pose);
        expect(solved.limited).toBe(false);
        for (const side of ["left", "right"] as const) expect(rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(studioPointToWorld(weightGripPoint(bar, side), solved.transform))).toBeLessThan(.001);
        const shoulder = rig.bones["right-shoulder"].quaternion.clone();
        if (previous) expect(shoulder.angleTo(previous)).toBeLessThan(.1);
        previous = shoulder;
      }
    } finally { rig.dispose(); }
  });
  it.each([1, 2].flatMap(bodyScale => [undefined, -90, 0, 90].map(wristRoll => ({ bodyScale, wristRoll }))))("keeps a shared bar continuous throughout the full elbow bend range with body scale $bodyScale and wrist roll $wristRoll", ({ bodyScale, wristRoll }) => {
    let scene = structuredClone(blankWorkshopScene);
    const bar = { ...createStudioObject("barbell", "bar", 0), scale: bodyScale, attachment: "both" as const };
    scene.studio!.body.scale = bodyScale;
    scene.studio!.objects = [{ ...bar, ...automaticWeightTransform(scene.studio!.body, bar, "both", scene, 0) }];
    if (wristRoll !== undefined) for (const frame of scene.keyframes) for (const side of ["left", "right"] as const) frame.poses[`${side}-wrist`] = { x: wristRoll, y: 0, z: 0 };
    const rig = createAnatomyRig(new Group()), parent = new Group(); parent.scale.setScalar(bodyScale); parent.add(rig.root);
    let previousAxis: Vector3 | undefined, previousShoulder: Quaternion | undefined;
    try {
      for (let bend = 0; bend <= 155; bend++) {
        scene = editHeldWeightPose(scene, 0, "selected", {
          "left-elbow": { x: bend, y: 0, z: 0 }, "right-elbow": { x: bend, y: 0, z: 0 },
        });
        const pose = sampleWorkshopPose(scene.keyframes, 0);
        poseAnatomyRig(rig, pose, true);
        const solved = poseArmDrivenWeight(rig, scene.studio!.objects[0], pose);
        const axis = new Vector3(1, 0, 0).applyEuler(new Euler(solved.transform.rotationX * Math.PI / 180, solved.transform.rotationY * Math.PI / 180, solved.transform.rotationZ * Math.PI / 180));
        const shoulder = rig.bones["right-shoulder"].quaternion.clone();
        if (previousAxis) expect(axis.angleTo(previousAxis), `bar jump at ${bend} degrees`).toBeLessThan(.1);
        // Compensation becomes steeper at the hinge limit, but must never
        // switch to the former opposite shoulder configuration (~3 radians).
        if (previousShoulder) expect(shoulder.angleTo(previousShoulder), `shoulder jump at ${bend} degrees`).toBeLessThan(.2);
        expect(solved.limited, `contact at ${bend} degrees ${JSON.stringify({distance:rig.handBones.right.localToWorld(studioGripOffset('right')).distanceTo(studioPointToWorld(weightGripPoint(bar,'right'),solved.transform)),alignment:Math.abs(new Vector3(1,0,0).applyQuaternion(rig.handBones.right.getWorldQuaternion(new Quaternion())).dot(axis)),shoulder:rig.bones['right-shoulder'].rotation.toArray(),elbow:rig.bones['right-elbow'].rotation.toArray()})}`).toBe(false);
        for (const side of ["left", "right"] as const) expect(rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(studioPointToWorld(weightGripPoint(bar, side), solved.transform)), `${side} contact at ${bend} degrees`).toBeLessThan(.005);
        previousAxis = axis; previousShoulder = shoulder;
      }
    } finally { rig.dispose(); }
  });
  it("keeps the shared bar and both arms unchanged when editing a knee", () => {
    let scene = structuredClone(blankWorkshopScene);
    const bar = { ...createStudioObject("barbell", "bar", 0), attachment: "both" as const };
    scene.studio!.objects = [{ ...bar, ...automaticWeightTransform(identityTransform, bar, "both", scene, 0) }];
    scene = editHeldWeightPose(scene, 1, "selected", { "right-elbow": { x: 85, y: 0, z: 0 } });
    const next = editHeldWeightPose(scene, 1, "selected", { "left-knee": { x: -50, y: 0, z: 0 } });
    expect(next.studio).toEqual(scene.studio);
    expect(next.keyframes[0]).toEqual(scene.keyframes[0]); expect(next.keyframes[2]).toEqual(scene.keyframes[2]);
    for (const side of ["left", "right"] as const) for (const part of ["shoulder", "elbow", "wrist"] as const) expect(next.keyframes[1].poses[`${side}-${part}`]).toEqual(scene.keyframes[1].poses[`${side}-${part}`]);
  });
  it("returns to the same shared-bar geometry after repeated extreme elbow edits", () => {
    let scene = structuredClone(blankWorkshopScene);
    const bar = { ...createStudioObject("barbell", "bar", 0), attachment: "both" as const };
    scene.studio!.objects = [{ ...bar, ...automaticWeightTransform(identityTransform, bar, "both", scene, 0) }];
    const edit = (bend: number) => {
      scene = editHeldWeightPose(scene, 1, "selected", {
        "left-elbow": { x: bend, y: 0, z: 0 }, "right-elbow": { x: bend, y: 0, z: 0 },
      });
    };
    edit(42);
    const first = structuredClone(scene);
    for (const bend of [145, 0, 145, 0, 145, 0, 42]) edit(bend);
    const rig = createAnatomyRig(new Group());
    try {
      for (let step = 0; step <= 16; step++) {
        const time = step * 200;
        const palms = [first, scene].map(value => {
          const pose = sampleWorkshopPose(value.keyframes, time), item = resolveStudioObject(value, value.studio!.objects[0], time);
          poseAnatomyRig(rig, pose, true); poseArmDrivenWeight(rig, item, pose);
          return ["left", "right"].map(side => rig.handBones[side as "left" | "right"].getWorldPosition(new Vector3()));
        });
        palms[0].forEach((palm, index) => expect(palm.distanceTo(palms[1][index]), `hand ${index} at ${time}ms`).toBeLessThan(.001));
      }
    } finally { rig.dispose(); }
  });
  it("does not accumulate follower compensation when alternating the driving elbow", () => {
    let scene = structuredClone(blankWorkshopScene);
    const bar = { ...createStudioObject("barbell", "bar", 0), attachment: "both" as const };
    scene.studio!.objects = [{ ...bar, ...automaticWeightTransform(identityTransform, bar, "both", scene, 0) }];
    const edit = (side: "left" | "right", x: number) => { scene = editHeldWeightPose(scene, 1, "selected", { [`${side}-elbow`]: { x, y: 0, z: 0 } }); };
    edit("left", 42); edit("right", 42); const first = structuredClone(scene);
    for (let repeat = 0; repeat < 3; repeat++) { edit("left", 145); edit("right", 0); edit("left", 0); edit("right", 145); }
    edit("left", 42); edit("right", 42);
    const rig = createAnatomyRig(new Group());
    try {
      for (let step = 0; step <= 16; step++) {
        const time = step * 200;
        const palms = [first, scene].map(value => {
          const pose = sampleWorkshopPose(value.keyframes, time), item = resolveStudioObject(value, value.studio!.objects[0], time);
          poseAnatomyRig(rig, pose, true); const solved = poseArmDrivenWeight(rig, item, pose);
          expect(solved.limited).toBe(false);
          return ["left", "right"].map(side => rig.handBones[side as "left" | "right"].getWorldPosition(new Vector3()));
        });
        palms[0].forEach((palm, index) => expect(palm.distanceTo(palms[1][index]), `hand ${index} at ${time}ms`).toBeLessThan(.001));
      }
    } finally { rig.dispose(); }
  });
  it("aligns both closed hands with the bar shaft while bending both elbows", () => {
    let scene = structuredClone(blankWorkshopScene);
    const bar = { ...createStudioObject("barbell", "bar", 0), attachment: "both" as const };
    scene.studio!.objects = [{ ...bar, ...automaticWeightTransform(identityTransform, bar, "both", scene, 0) }];
    const rig = createAnatomyRig(new Group());
    try {
      for (const bend of [20, 50, 85]) {
        const baseline = sampleHeldWeightPose(scene, 0);
        scene = editHeldWeightPose(scene, 0, "selected", {
          "left-elbow": { ...baseline["left-elbow"]!, x: bend }, "right-elbow": { ...baseline["right-elbow"]!, x: bend },
        });
        const pose = sampleWorkshopPose(scene.keyframes, 0);
        poseAnatomyRig(rig, pose, true);
        const solved = poseArmDrivenWeight(rig, scene.studio!.objects[0], pose);
        const transform = solved.transform;
        const axis = new Vector3(1, 0, 0).applyEuler(new Euler(transform.rotationX * Math.PI / 180, transform.rotationY * Math.PI / 180, transform.rotationZ * Math.PI / 180));
        for (const side of ["left", "right"] as const) {
          const handAxis = new Vector3(1, 0, 0).applyQuaternion(rig.handBones[side].getWorldQuaternion(new Quaternion()));
          expect(Math.abs(axis.dot(handAxis)), `${side} grip at ${bend}°`).toBeGreaterThan(.985);
          expect(rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(studioPointToWorld(weightGripPoint(bar, side), transform))).toBeLessThan(.005);
        }
      }
    } finally { rig.dispose(); }
  });
  it("keeps supinated barbell contacts through a saved and reloaded full rep", () => {
    let scene = structuredClone(blankWorkshopScene);
    const bar = { ...createStudioObject("barbell", "00000000-0000-4000-8000-000000000001", 0), attachment: "both" as const };
    for (const frame of scene.keyframes) for (const side of ["left", "right"] as const) frame.poses[`${side}-wrist`] = { x: -90, y: 0, z: 0 };
    scene.studio!.objects = [{ ...bar, ...automaticWeightTransform(identityTransform, bar, "both", scene, 0) }];
    for (const bend of [85, 155, 0, 155, 0, 155]) scene = editHeldWeightPose(scene, 1, "selected", {
      "left-elbow": { x: bend, y: 0, z: 0 }, "right-elbow": { x: bend, y: 0, z: 0 },
    });
    const saved = workshopSceneSchema.parse(JSON.parse(JSON.stringify(scene))), rig = createAnatomyRig(new Group());
    try {
      for (let step = 0; step <= 16; step++) {
        const time = step * 200, pose = sampleWorkshopPose(saved.keyframes, time), item = resolveStudioObject(saved, saved.studio!.objects[0], time);
        poseAnatomyRig(rig, pose, true); const solved = poseArmDrivenWeight(rig, item, pose);
        expect(solved.limited, `supinated at ${time}ms`).toBe(false);
        for (const side of ["left", "right"] as const) {
          expect(rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(studioPointToWorld(weightGripPoint(item, side), solved.transform))).toBeLessThan(.005);
          const roll = rig.forearmBones[side].quaternion;
          expect(2 * Math.acos(Math.abs(roll.w)), `${side} palm at ${time}ms`).toBeLessThan(Math.PI / 4);
        }
      }
    } finally { rig.dispose(); }
  });
  it.each(["left", "right"] as const)("bends the %s elbow while retaining both barbell grips and other moments", side => {
    const slug = "barbell";
    const scene = structuredClone(blankWorkshopScene);
    const weight = { ...createStudioObject(slug, "00000000-0000-4000-8000-000000000001", 0), attachment: "both" as const };
    scene.studio!.objects = [{ ...weight, ...automaticWeightTransform(identityTransform, weight, "both", scene, 0) }];
    const original = structuredClone(scene);
    expect(canCarryWithArm(weight)).toBe(true);
    const next = editHeldWeightPose(scene, 1, "selected", { [`${side}-elbow`]: { x: 85, y: 0, z: 0 } });
    expect(scene).toEqual(original);
    const saved = workshopSceneSchema.parse(JSON.parse(JSON.stringify(next)));
    expect(saved.studio!.objects[0].attachment).toBe("both");
    expect(sampleStudioObject(saved.studio!.objects[0], 0)).toMatchObject(JSON.parse(JSON.stringify(sampleStudioObject(scene.studio!.objects[0], 0))));
    const before = sampleStudioObject(scene.studio!.objects[0], 1600), after = sampleStudioObject(saved.studio!.objects[0], 1600);
    expect(new Vector3(after.x, after.y, after.z).distanceTo(new Vector3(before.x, before.y, before.z))).toBeGreaterThan(.08);
    const rig = createAnatomyRig(new Group());
    try {
      for (const time of [0, 400, 800, 1200, 1600, 2400, 3200]) {
        const pose = sampleWorkshopPose(saved.keyframes, time), item = resolveStudioObject(saved, saved.studio!.objects[0], time);
        poseAnatomyRig(rig, pose, true);
        const solved = poseArmDrivenWeight(rig, item, pose);
        const shaft = new Vector3(1, 0, 0).applyEuler(new Euler(solved.transform.rotationX * Math.PI / 180, solved.transform.rotationY * Math.PI / 180, solved.transform.rotationZ * Math.PI / 180));
        const contacts = ["left", "right"].map(side => ({ side, distance: rig.handBones[side as "left" | "right"].localToWorld(studioGripOffset(side as "left" | "right")).distanceTo(studioPointToWorld(weightGripPoint(item, side as "left" | "right"), solved.transform)), alignment: Math.abs(new Vector3(1, 0, 0).applyQuaternion(rig.handBones[side as "left" | "right"].getWorldQuaternion(new Quaternion())).dot(shaft)) }));
        expect(solved.limited, `${slug} at ${time}ms ${JSON.stringify(contacts)}`).toBe(false);
        for (const side of ["left", "right"] as const) {
          const grip = studioPointToWorld(weightGripPoint(item, side), solved.transform);
          expect(rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(grip)).toBeLessThan(.005);
        }
      }
    } finally { rig.dispose(); }
    expect(sampleHeldWeightPose(saved, 1600)[`${side}-elbow`]!.x).toBe(85);
    expect(canCarryWithArm({ ...weight, elbowLocks: { right: { x: 0, y: 1, z: 0 } } })).toBe(false);
  });
  it("switches the driving side at another pose without moving the saved start", () => {
    const scene = structuredClone(blankWorkshopScene);
    const weight = { ...createStudioObject("barbell", "00000000-0000-4000-8000-000000000001", 0), attachment: "both" as const };
    scene.studio!.objects = [{ ...weight, ...automaticWeightTransform(identityTransform, weight, "both", scene, 0) }];
    const first = editHeldWeightPose(scene, 0, "selected", { "left-elbow": { ...sampleHeldWeightPose(scene, 0)["left-elbow"]!, x: 45 } });
    const before = resolveStudioObject(first, first.studio!.objects[0], 0);
    let finish = first;
    for (const bend of [85, 145, 0, 145, 0, 85]) finish = editHeldWeightPose(finish, 1, "selected", { "right-elbow": { ...sampleHeldWeightPose(finish, 1600)["right-elbow"]!, x: bend } });
    const moment = editWorkshopMoment(finish, 800);
    const next = editHeldWeightPose(moment.scene, moment.index, "selected", { "right-elbow": { ...sampleHeldWeightPose(finish, 800)["right-elbow"]!, x: 60 } });
    workshopSceneSchema.parse(JSON.parse(JSON.stringify(next)));
    const after = resolveStudioObject(next, next.studio!.objects[0], 0);
    expect(sampleHeldWeightPose(next, 1600)["right-elbow"]!.x).toBe(85);
    expect(sampleHeldWeightPose(next, 0)["left-elbow"]!.x).toBeCloseTo(45, 0);
    const rig = createAnatomyRig(new Group());
    try {
      for (const time of Array.from({ length: 17 }, (_, index) => index * 200)) {
        const pose = sampleWorkshopPose(next.keyframes, time), item = resolveStudioObject(next, next.studio!.objects[0], time);
        poseAnatomyRig(rig, pose, true);
        const solved = poseArmDrivenWeight(rig, item, pose);
        const shaft = new Vector3(1, 0, 0).applyEuler(new Euler(solved.transform.rotationX * Math.PI / 180, solved.transform.rotationY * Math.PI / 180, solved.transform.rotationZ * Math.PI / 180));
        const contacts = ["left", "right"].map(side => ({ side, distance: rig.handBones[side as "left" | "right"].localToWorld(studioGripOffset(side as "left" | "right")).distanceTo(studioPointToWorld(weightGripPoint(item, side as "left" | "right"), solved.transform)), alignment: Math.abs(new Vector3(1, 0, 0).applyQuaternion(rig.handBones[side as "left" | "right"].getWorldQuaternion(new Quaternion())).dot(shaft)) }));
        expect(solved.limited, `repeated edit at ${time}ms: ${JSON.stringify(contacts)}`).toBe(false);
      }
    } finally { rig.dispose(); }
    for (const side of ["left", "right"] as const) {
      expect(studioPointToWorld(weightGripPoint(before, side), before).distanceTo(studioPointToWorld(weightGripPoint(after, side), after))).toBeLessThan(.005);
    }
  });
  it.each([undefined, "weight"] as const)("retains %s weight-driven posing until a joint edit explicitly takes control", poseDriver => {
    const scene = structuredClone(blankWorkshopScene);
    const shoulder = { x: 15, y: 12, z: 0 }, elbow = { x: 35, y: 0, z: 0 };
    scene.keyframes.forEach(frame => { frame.poses = { "left-shoulder": shoulder, "left-elbow": elbow }; });
    const weight: StudioObject = { ...createStudioObject("dumbbell", "weight", 0), attachment: "left", poseDriver };
    const targetScene = structuredClone(scene);
    targetScene.keyframes.forEach(frame => { frame.poses["left-elbow"] = { x: 85, y: 0, z: 0 }; });
    scene.studio!.objects = [{ ...weight, ...automaticWeightTransform(identityTransform, weight, "left", targetScene, 0) }];
    const rig = createAnatomyRig(new Group());
    try {
      const target = studioPointToWorld(weightGripPoint(weight, "left"), scene.studio!.objects[0]);
      for (let step = 0; step <= 16; step++) {
        const pose = sampleHeldWeightPose(scene, step * 200);
        poseAnatomyRig(rig, pose, true);
        expect(rig.handBones.left.localToWorld(studioGripOffset("left")).distanceTo(target)).toBeLessThan(.002);
        expect(pose["left-elbow"]!.x).toBeCloseTo(85, 0);
      }
      const next = editHeldWeightPose(scene, 1, "selected", { "left-shoulder": shoulder });
      expect(next.studio!.objects[0].poseDriver).toBe("arm");
      expect(sampleHeldWeightPose(next, 1600)["left-elbow"]).toEqual(elbow);
      expect(next.studio!.objects[0].attachment).toBe("left");
    } finally { rig.dispose(); }
  });
  it.each(["left", "right"] as const)("preserves the %s elbow throughout a shoulder-only lying raise and carries the handle on the palm", side => {
    const scene = structuredClone(blankWorkshopScene);
    const bench = { ...createStudioObject("bench", "bench", 0), benchAngle: 0, x: .3, rotationY: 25 };
    const elbow = { x: 15, y: 0, z: 0 };
    const wrist = { x: -10, y: 0, z: 0 };
    scene.keyframes = [0, 800, 1600, 3200].map((timeMs, index) => ({ timeMs, poses: {
      [`${side}-shoulder`]: { x: [5, 50, 100, 5][index], y: 0, z: side === "left" ? -8 : 8 },
      [`${side}-elbow`]: { ...elbow }, [`${side}-wrist`]: { ...wrist },
    } }));
    const weight = { ...createStudioObject("dumbbell", "weight", 0), attachment: side, gripOffsets: { [side]: { x: .02, y: -.01, z: .015 } } };
    scene.studio = { body: { ...identityTransform, rotationY: 15, scale: 1.2 }, objects: [bench, weight], seating: { benchId: bench.id, facing: "supine" } };
    scene.studio.objects[1] = { ...weight, frames: [0, 1600, 3200].map(timeMs => ({ timeMs, ...automaticWeightTransform(scene.studio!.body, weight, side, scene, timeMs) })) };
    const before = structuredClone(scene);
    const next = editHeldWeightPose(scene, 1, "selected", { [`${side}-shoulder`]: { x: 70, y: 0, z: side === "left" ? -8 : 8 } });
    expect(scene).toEqual(before);
    expect(next.keyframes[1].poses[`${side}-elbow`]).toEqual(elbow);
    expect(next.keyframes[1].poses[`${side}-wrist`]).toEqual(wrist);
    const carried = next.studio!.objects[1];
    expect(carried.attachment).toBe(side);
    expect(carried.poseDriver).toBe("arm");
    expect(carried.gripOffsets).toEqual(weight.gripOffsets);
    const saved = JSON.parse(JSON.stringify(next)) as typeof next;
    const rig = createAnatomyRig(new Group()), parent = new Group();
    parent.rotation.y = 15 * Math.PI / 180; parent.scale.setScalar(1.2); parent.add(rig.root);
    try {
      let previousPalm: Vector3 | undefined;
      for (let step = 0; step <= 16; step++) {
        const time = step * 200, pose = sampleHeldWeightPose(saved, time);
        expect(pose[`${side}-elbow`]).toEqual(elbow);
        poseAnatomyRig(rig, pose, true); applyStudioSeating(rig, saved.studio, time, pose);
        const item = sampleStudioObject(saved.studio!.objects[1], time);
        const placed = weightAtPalm(rig, item, side);
        const palm = rig.handBones[side].localToWorld(studioGripOffset(side));
        expect(studioPointToWorld(weightGripPoint(item, side), placed).distanceTo(palm)).toBeLessThan(.000001);
        const resolved = resolveStudioObject(saved, saved.studio!.objects[1], time);
        expect(studioPointToWorld(weightGripPoint(resolved, side), resolved).distanceTo(palm)).toBeLessThan(.000001);
        expect(new Vector3(placed.x, placed.y, placed.z).toArray().every(Number.isFinite)).toBe(true);
        expect(placed.scale).toBe(weight.scale);
        if (previousPalm) expect(palm.distanceTo(previousPalm)).toBeLessThan(.4);
        previousPalm = palm;
      }
      const startPose = sampleHeldWeightPose(saved, 0), endPose = sampleHeldWeightPose(saved, 3200);
      poseAnatomyRig(rig, startPose, true); applyStudioSeating(rig, saved.studio, 0, startPose);
      const startPalm = rig.handBones[side].localToWorld(studioGripOffset(side));
      poseAnatomyRig(rig, endPose, true); applyStudioSeating(rig, saved.studio, 3200, endPose);
      expect(startPalm.distanceTo(rig.handBones[side].localToWorld(studioGripOffset(side)))).toBeLessThan(.000001);
    } finally { rig.dispose(); }
  });
  it("includes a moving bench's middle moment when carrying a weight with only endpoint frames", () => {
    const scene = structuredClone(blankWorkshopScene);
    const bench = { ...createStudioObject("bench", "bench", 0), x: 0 };
    const item = { ...createStudioObject("dumbbell", "weight", 0), attachment: "left" as const };
    scene.studio!.seating = { benchId: bench.id, facing: "front" };
    scene.studio!.objects = [bench, { ...item, frames: [0, 3200].map(timeMs => ({ timeMs, ...automaticWeightTransform(scene.studio!.body, item, "left", scene, timeMs) })) }];
    const moved = structuredClone(scene);
    moved.studio!.objects[0].frames = [0, 1600, 3200].map(timeMs => ({ ...bench, timeMs, x: timeMs === 1600 ? 1 : 0 }));
    const next = carryHeldWeights(scene, moved);
    expect(next.studio!.objects[1].frames?.map(frame => frame.timeMs)).toEqual([0, 1600, 3200]);
    const original = sampleStudioObject(scene.studio!.objects[1], 1600), carried = sampleStudioObject(next.studio!.objects[1], 1600);
    expect(carried.x - original.x).toBeCloseTo(1, 6);
    expect(carried.y).toBeCloseTo(original.y, 6);
    for (let time = 0; time <= 3200; time += 200) {
      const before = sampleStudioObject(scene.studio!.objects[1], time), after = sampleStudioObject(next.studio!.objects[1], time);
      expect(after.x - before.x).toBeCloseTo(sampleStudioObject(moved.studio!.objects[0], time).x, 6);
    }
  });
  it("keeps the palm on the handle when resizing the person while retaining the dumbbell's size", () => {
    const scene = structuredClone(blankWorkshopScene);
    const item = { ...createStudioObject("dumbbell", "weight", 0), attachment: "left" as const };
    scene.studio!.objects = [{ ...item, ...automaticWeightTransform(scene.studio!.body, item, "left", scene, 0) }];
    const next = carryHeldWeights(scene, { ...scene, studio: { ...scene.studio!, body: { ...scene.studio!.body, scale: 2 } } });
    const placed = sampleStudioObject(next.studio!.objects[0], 0);
    const expected = automaticWeightTransform(next.studio!.body, item, "left", next, 0);
    expect(placed.scale).toBe(item.scale);
    expect(studioPointToWorld(weightGripPoint(placed, "left"), placed).distanceTo(studioPointToWorld(weightGripPoint(item, "left"), expected))).toBeLessThan(.001);
  });
  it.each(["front", "supine", "prone"] as const)("carries both held dumbbells into %s seating without changing their body-relative grips", facing => {
    const scene = structuredClone(blankWorkshopScene);
    const bench = { ...createStudioObject("bench", "bench", 0), benchAngle: 30, x: .5, rotationY: 25 };
    const weights = (["left", "right"] as const).map((side, index) => ({ ...createStudioObject("dumbbell", side, index), attachment: side, gripOffsets: { [side]: { x: .01, y: -.02, z: .015 } } }));
    scene.studio!.objects = [bench, ...weights];
    scene.studio!.objects = [bench, ...weights.map(item => ({ ...item, frames: scene.keyframes.map(frame => ({ timeMs: frame.timeMs, ...automaticWeightTransform(scene.studio!.body, item, item.attachment, scene, frame.timeMs) })) }))];
    const next = carryHeldWeights(scene, { ...scene, studio: { ...scene.studio!, seating: { benchId: bench.id, facing } } });
    const rig = createAnatomyRig(new Group());
    try {
      for (let step = 0; step <= 16; step++) {
        const time = step * 200, pose = sampleWorkshopPose(next.keyframes, time);
        poseAnatomyRig(rig, pose, true); applyStudioSeating(rig, next.studio, time, pose);
        for (const side of ["left", "right"] as const) {
          const item = sampleStudioObject(next.studio!.objects.find(item => item.id === side)!, time);
          expect(studioPointToWorld(weightGripPoint(item, side), item).distanceTo(rig.handBones[side].localToWorld(studioGripOffset(side)))).toBeLessThan(.001);
          expect(item.gripOffsets).toEqual(weights.find(item => item.id === side)!.gripOffsets);
        }
      }
    } finally { rig.dispose(); }
    const standing = carryHeldWeights(next, { ...next, studio: { ...next.studio!, seating: undefined } });
    for (const side of ["left", "right"] as const) for (const time of [0, 1600, 3200]) {
      const initial = sampleStudioObject(scene.studio!.objects.find(item => item.id === side)!, time);
      const returned = sampleStudioObject(standing.studio!.objects.find(item => item.id === side)!, time);
      expect(new Vector3(returned.x, returned.y, returned.z).distanceTo(new Vector3(initial.x, initial.y, initial.z))).toBeLessThan(.001);
    }
  });
  it.each(["left", "right"] as const)("moves the %s weight with an elbow edit, keeping the other poses and hand unchanged", side => {
    const scene = structuredClone(blankWorkshopScene);
    const bench = { ...createStudioObject("bench", "bench", 0), benchAngle: 65, x: .3, rotationY: 20 };
    const other: "left" | "right" = side === "left" ? "right" : "left";
    const weight = { ...createStudioObject("dumbbell", "weight", 0), attachment: side, gripOffsets: { [side]: { x: .02, y: -.01, z: .015 } } };
    const peer = { ...createStudioObject("dumbbell", "peer", 1), attachment: other };
    scene.studio = { body: { ...identityTransform, rotationY: 15 }, objects: [bench, weight, peer], seating: { benchId: bench.id, facing: "supine" } };
    scene.keyframes = [0, 1600, 3200].map(timeMs => ({ timeMs, poses: {
      [`${side}-shoulder`]: { x: 10, y: 12, z: side === "left" ? -12 : 12 }, [`${side}-elbow`]: { x: 25, y: 0, z: 0 },
    } }));
    scene.studio!.objects = [bench, ...[weight, peer].map(item => ({ ...item, ...automaticWeightTransform(scene.studio!.body, item, item.attachment, scene, 0) }))];
    const before = structuredClone(scene);
    const next = editHeldWeightPose(scene, 1, "selected", { [`${side}-elbow`]: { x: 80, y: 0, z: 0 } });
    expect(scene).toEqual(before);
    expect(next.keyframes[0]).toEqual(scene.keyframes[0]); expect(next.keyframes[2]).toEqual(scene.keyframes[2]);
    expect(next.studio!.objects[2]).toEqual(scene.studio!.objects[2]);
    expect(next.studio!.objects[1].gripOffsets).toEqual(weight.gripOffsets);
    expect(next.studio!.objects[1].attachment).toBe(side);
    expect(sampleStudioObject(next.studio!.objects[1], 0)).toMatchObject({ x: scene.studio!.objects[1].x, y: scene.studio!.objects[1].y, z: scene.studio!.objects[1].z });
    expect(sampleHeldWeightPose(next, 1600)[`${side}-elbow`]!.x).toBeCloseTo(80, 0);
    for (const time of [0, 3200]) for (const part of ["shoulder", "elbow"] as const) {
      const slug = `${side}-${part}` as const, original = sampleHeldWeightPose(scene, time)[slug]!, unchanged = sampleHeldWeightPose(next, time)[slug]!;
      for (const axis of ["x", "y", "z"] as const) expect(unchanged[axis]).toBeCloseTo(original[axis], 6);
    }
    for (const time of [1599, 1601]) expect(sampleHeldWeightPose(next, time)[`${side}-elbow`]!.x).toBeCloseTo(80, 0);
    const rig = createAnatomyRig(new Group()), parent = new Group(); parent.rotation.y = 15 * Math.PI / 180; parent.add(rig.root);
    try {
      const pose = sampleWorkshopPose(next.keyframes, 1600);
      poseAnatomyRig(rig, pose, true); applyStudioSeating(rig, next.studio, 1600, pose);
      const expectedPalm = rig.handBones[side].localToWorld(studioGripOffset(side));
      const placed = sampleStudioObject(next.studio!.objects[1], 1600);
      expect(studioPointToWorld(weightGripPoint(placed, side), placed).distanceTo(expectedPalm)).toBeLessThan(.001);
      expect(expectedPalm.distanceTo(new Vector3(scene.studio!.objects[1].x, scene.studio!.objects[1].y, scene.studio!.objects[1].z))).toBeGreaterThan(.15);
      for (let step = 0; step <= 16; step++) {
        const time = step * 200, sampled = sampleWorkshopPose(next.keyframes, time), item = sampleStudioObject(next.studio!.objects[1], time);
        poseAnatomyRig(rig, sampled, true); applyStudioSeating(rig, next.studio, time, sampled);
        const result = solveDumbbellGrip(rig, item, sampled, studioPointToWorld(weightGripPoint(item, side), item))!;
        expect(studioPointToWorld(weightGripPoint(item, side), result.transform).distanceTo(rig.handBones[side].localToWorld(studioGripOffset(side)))).toBeLessThan(.001);
        expect(result.limited).toBe(false);
      }
    } finally { rig.dispose(); }
  });
  it("updates each pose's own held weight position when applying a joint to all poses", () => {
    const scene = structuredClone(blankWorkshopScene);
    const item = { ...createStudioObject("dumbbell", "weight", 0), attachment: "left" as const };
    scene.keyframes[1].poses["left-shoulder"] = { x: 40, y: 0, z: -12 };
    scene.studio!.objects = [{ ...item, frames: scene.keyframes.map(frame => ({ timeMs: frame.timeMs, ...automaticWeightTransform(identityTransform, item, "left", scene, frame.timeMs) })) }];
    const next = editHeldWeightPose(scene, 0, "all", { "left-elbow": { x: 60, y: 0, z: 0 } });
    for (const frame of next.keyframes) expect(sampleHeldWeightPose(next, frame.timeMs)["left-elbow"]!.x).toBeCloseTo(60, 0);
    expect(sampleStudioObject(next.studio!.objects[0], 1600).z).not.toBeCloseTo(sampleStudioObject(next.studio!.objects[0], 0).z, 1);
  });
  it("preserves implicit wrists and the opposite weight when editing a preset scene", () => {
    const scene = structuredClone(blankWorkshopScene); scene.motionStyle = "incline-curl";
    scene.keyframes.forEach(frame => { frame.poses["left-elbow"] = { x: 80, y: 0, z: 0 }; });
    const weight = { ...createStudioObject("dumbbell", "right", 0), attachment: "right" as const };
    scene.studio!.objects = [{ ...weight, ...automaticWeightTransform(identityTransform, weight, "right", scene, 0) }];
    const next = editHeldWeightPose(scene, 1, "selected", { "left-elbow": { x: 50, y: 0, z: 0 } });
    expect(next.motionStyle).toBe(scene.motionStyle);
    for (const frame of next.keyframes) for (const side of ["left", "right"] as const) expect(frame.poses[`${side}-wrist`]).toBeUndefined();
    expect(next.studio!.objects).toEqual(scene.studio!.objects);
  });
});
