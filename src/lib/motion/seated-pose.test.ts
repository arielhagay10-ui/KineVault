import { describe, expect, it } from "vitest";
import { applyStudioMachine, machineDemoScene } from "./studio-machines";
import { sampleHeldWeightPose } from "./held-weight-pose";
import { releaseSeatedFeet, resetSeatPose, setSeatOffsets } from "./seated-pose";
import { sampleStudioObject } from "./studio";
import { workshopSceneSchema } from "./scene-schema";
import { constrainSeatedEdit } from "./seated-pose";
import { createStudioObject } from "./studio";
import { blankWorkshopScene, jointLimits } from "./workshop";
import { Group, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { applyStudioSeating } from "./studio-seat";
import { editWorkshopMoment } from "./workshop-freedom";
import { legPressFootContact } from "./leg-press";

const id = "00000000-0000-4000-8000-000000000001";
describe("seat pose editing", () => {
  it("retains the displayed feet when releasing support at a scrubbed moment", () => {
    const bench = { ...createStudioObject("bench", id, 0), benchAngle: 45 };
    let scene = { ...blankWorkshopScene, studio: { body: { ...blankWorkshopScene.studio!.body }, objects: [bench], seating: { benchId: id, facing: "front" as const } } };
    scene = setSeatOffsets(scene, id, 0, { seatOffsetX: -.1, seatOffsetZ: -.12 }) as typeof scene;
    scene = setSeatOffsets(scene, id, 1600, { seatOffsetX: .1, seatOffsetZ: .12 }) as typeof scene;
    const after = releaseSeatedFeet(editWorkshopMoment(scene, 800).scene), rig = createAnatomyRig(new Group());
    const foot = (value: typeof scene) => {
      const pose = sampleHeldWeightPose(value, 800);
      poseAnatomyRig(rig, pose, true); applyStudioSeating(rig, value.studio, 800, pose);
      return rig.footBones.left.getWorldPosition(new Vector3());
    };
    try { expect(foot(after as typeof scene).distanceTo(foot(scene))).toBeLessThan(.00001); } finally { rig.dispose(); }
  });

  it("keeps required sled contacts when the seat is moved", () => {
    const scene = machineDemoScene("leg-press", id), next = setSeatOffsets(scene, id, 1600, { seatOffsetX: .1, seatOffsetZ: -.12 });
    const rig = createAnatomyRig(new Group());
    try {
      for (let sample = 0; sample <= 16; sample++) {
        const time = sample * next.durationMs / 16, pose = sampleHeldWeightPose(next, time);
        poseAnatomyRig(rig, pose, true); applyStudioMachine(rig, next, time);
        const object = sampleStudioObject(next.studio!.objects[0], time);
        for (const side of ["left", "right"] as const) {
          const contact = legPressFootContact(rig, object, side);
          expect(contact.distance).toBeLessThanOrEqual(.0051);
          expect(contact.alignment).toBeGreaterThanOrEqual(.99899);
          for (const part of ["hip", "knee", "ankle"] as const) {
            const joint = `${side}-${part}` as const, angles = pose[joint]!;
            for (const axis of ["x", "y", "z"] as const) {
              expect(angles[axis]).toBeGreaterThanOrEqual(jointLimits[joint][axis][0] - .0001);
              expect(angles[axis]).toBeLessThanOrEqual(jointLimits[joint][axis][1] + .0001);
            }
          }
        }
      }
    } finally { rig.dispose(); }
  });
  it.each([0, 30])("rejects release of an already invalid automatic chest-supported stance at %s degrees without rewriting its legs", benchAngle => {
    const bench = { ...createStudioObject("bench", id, 0), benchAngle };
    const scene = { ...blankWorkshopScene, studio: { body: { ...blankWorkshopScene.studio!.body }, objects: [bench], seating: { benchId: id, facing: "back" as const } } };
    const unchanged = structuredClone(scene);
    expect(() => releaseSeatedFeet(scene)).toThrow(/automatic.*leg|upright bench/i);
    expect(scene).toEqual(unchanged);
  });
  it("checks every changed pose rather than only the current playhead", () => {
    const bench = createStudioObject("bench", id, 0);
    const scene = releaseSeatedFeet({ ...blankWorkshopScene, studio: { body: { ...blankWorkshopScene.studio!.body }, objects: [bench], seating: { benchId: id, facing: "front" } } });
    scene.keyframes = scene.keyframes.map((frame, index) => ({ ...frame, poses: { ...frame.poses,
      "left-hip": { x: index ? 0 : -90, y: 0, z: 0 }, "left-knee": { x: -150, y: 0, z: 0 }, "left-ankle": { x: 0, y: 0, z: 0 } } }));
    const after = { ...scene, keyframes: scene.keyframes.map(frame => ({ ...frame, poses: { ...frame.poses, "left-knee": { x: 0, y: 0, z: 0 } } })) };
    const next = constrainSeatedEdit(scene, after, 0), rig = createAnatomyRig(new Group());
    try {
      for (const frame of next.keyframes) {
        poseAnatomyRig(rig, frame.poses, true); applyStudioSeating(rig, next.studio, frame.timeMs, frame.poses);
        expect(rig.footBones.left.localToWorld(new Vector3(0, -.14, .065)).y).toBeGreaterThanOrEqual(-.0051);
      }
    } finally { rig.dispose(); }
  });

  it("does not use an existing hand gap as permission to push a foot through the floor", () => {
    const scene = releaseSeatedFeet(machineDemoScene("lat-pulldown-machine", id));
    const after = { ...scene, keyframes: scene.keyframes.map((frame, index) => index ? frame : { ...frame, poses: { ...frame.poses,
      "left-hip": { x: 0, y: 0, z: 0 }, "left-knee": { x: 0, y: 0, z: 0 }, "left-ankle": { x: 0, y: 0, z: 0 } } }) };
    const next = constrainSeatedEdit(scene, after, 0), rig = createAnatomyRig(new Group());
    try {
      poseAnatomyRig(rig, next.keyframes[0].poses, true);
      applyStudioMachine(rig, next, 0);
      expect(rig.footBones.left.localToWorld(new Vector3(0, -.14, .065)).y).toBeGreaterThanOrEqual(-.0051);
    } finally { rig.dispose(); }
  });
  it("stops a free seated leg edit before its sole passes through the floor", () => {
    const bench = createStudioObject("bench", id, 0);
    const scene = releaseSeatedFeet({ ...blankWorkshopScene, studio: { body: { ...blankWorkshopScene.studio!.body }, objects: [bench], seating: { benchId: id, facing: "front" } } });
    const after = { ...scene, keyframes: scene.keyframes.map((frame, index) => index ? frame : { ...frame, poses: { ...frame.poses,
      "left-hip": { x: 0, y: 0, z: 0 }, "left-knee": { x: 0, y: 0, z: 0 }, "left-ankle": { x: 0, y: 0, z: 0 } } }) };
    const next = constrainSeatedEdit(scene, after, 0), rig = createAnatomyRig(new Group());
    try {
      poseAnatomyRig(rig, next.keyframes[0].poses, true); applyStudioSeating(rig, next.studio, 0, next.keyframes[0].poses);
      expect(rig.footBones.left.localToWorld(new Vector3(0, -.14, .065)).y).toBeGreaterThanOrEqual(-.0051);
      expect(next.keyframes[0].poses["left-hip"]!.x).not.toBe(0);
      expect(next.studio!.objects[0].seatFootSupport).toBe(false);
    } finally { rig.dispose(); }
  });
  it("releases optional feet without changing the displayed leg pose", () => {
    const scene = machineDemoScene("shoulder-press-machine", id);
    const displayed = scene.keyframes.map(frame => sampleHeldWeightPose(scene, frame.timeMs));
    const next = releaseSeatedFeet(scene);
    expect(next.studio!.objects[0].seatFootSupport).toBe(false);
    for (const [index, frame] of next.keyframes.entries()) {
      for (const side of ["left", "right"] as const) for (const part of ["hip", "knee", "ankle"] as const) {
        for (const axis of ["x", "y", "z"] as const) expect(sampleHeldWeightPose(next, frame.timeMs)[`${side}-${part}`]![axis]).toBeCloseTo(displayed[index][`${side}-${part}`]![axis], 6);
      }
    }
    expect(workshopSceneSchema.safeParse(next).success).toBe(true);
  });

  it("keeps leg-press feet on the required sled contact", () => {
    const scene = machineDemoScene("leg-press", id);
    expect(releaseSeatedFeet(scene)).toBe(scene);
  });

  it("resets only current seating and torso, preserving travel, grips, legs and other keyframes", () => {
    const scene = machineDemoScene("row-machine", id);
    const object = scene.studio!.objects[0];
    Object.assign(object, { rowGrip: "wide", seatFootSupport: false, seatOffsetX: .04, seatOffsetZ: .03 });
    scene.keyframes[1].poses = { torso: { x: 10, y: 5, z: 0 }, "left-knee": { x: -80, y: 0, z: 0 } };
    const next = resetSeatPose(scene, id, 1);
    expect(next.keyframes[0]).toEqual(scene.keyframes[0]);
    expect(next.keyframes[2]).toEqual(scene.keyframes[2]);
    expect(next.keyframes[1].poses["left-knee"]).toEqual(scene.keyframes[1].poses["left-knee"]);
    expect(next.keyframes[1].poses.torso).toEqual({ x: 0, y: 0, z: 0 });
    const sampled = sampleStudioObject(next.studio!.objects[0], next.keyframes[1].timeMs);
    expect(sampled.seatOffsetX).toBe(0); expect(sampled.seatOffsetZ).toBe(0);
    expect(sampled.rowGrip).toBe("wide"); expect(sampled.seatFootSupport).toBe(false);
    expect(sampled.machinePosition).toBe(sampleStudioObject(object, scene.keyframes[1].timeMs).machinePosition);
    expect(sampleStudioObject(next.studio!.objects[0], 0).seatOffsetX).toBe(.04);
    expect(workshopSceneSchema.safeParse(next).success).toBe(true);
  });

  it("rejects a reset that would turn reachable hands into a reach warning", () => {
    const scene = machineDemoScene("row-machine", id), object = scene.studio!.objects[0];
    Object.assign(object, { frames: undefined, machinePosition: 0, rowGrip: "neutral", attachment: "both", rowSeatHeight: .78, seatOffsetZ: .03 });
    const rig = createAnatomyRig(new Group());
    try {
      poseAnatomyRig(rig, scene.keyframes[0].poses, true);
      expect(applyStudioMachine(rig, scene, 0)!.hands[0].contactError).toBeLessThan(.005);
    } finally { rig.dispose(); }
    const unchanged = structuredClone(scene);
    expect(() => resetSeatPose(scene, id, 0)).toThrow(/automatic seat.*reach/i);
    expect(scene).toEqual(unchanged);
  });

  it("bounds seat sliding and saves it at the current moment", () => {
    const scene = machineDemoScene("leg-press", id);
    const next = setSeatOffsets(scene, id, 1600, { seatOffsetX: 10, seatOffsetZ: -10 });
    const sampled = sampleStudioObject(next.studio!.objects[0], 1600);
    expect(Math.abs(sampled.seatOffsetX ?? 0)).toBeLessThanOrEqual(.1);
    expect(Math.abs(sampled.seatOffsetZ ?? 0)).toBeLessThanOrEqual(.12);
    expect(sampleStudioObject(next.studio!.objects[0], 0).seatOffsetX ?? 0).toBe(0);
    expect(workshopSceneSchema.safeParse(next).success).toBe(true);
  });
});
