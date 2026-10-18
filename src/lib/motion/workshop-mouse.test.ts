import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from "three";
import { readFile } from "node:fs/promises";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { createQuickScene } from "./quick-create";
import { applyStudioMachine, machineCarriagePoint, machineHandlePoint } from "./studio-machines";
import { sampleStudioObject } from "./studio";
import { identityTransform } from "./workshop";
import { machineDragValues, moveMachineWithMouse, studioDragDelta, studioTranslationAxes, studioSnapTarget, studioRotationAxes } from "./workshop-mouse";

describe("direct mouse movement", () => {
  it("keeps ray-based screen movement bounded through 17 near-edge-on camera angles", () => {
    const origin = new Vector3(.2, .7, -.1), ray = new Raycaster();
    for (let index = 0; index <= 16; index++) {
      const angle = Math.PI / 2 + (index - 8) * .0001;
      const camera = new PerspectiveCamera(45, 1.5, .1, 100);
      camera.position.copy(origin).add(new Vector3(Math.sin(angle) * 4, 1, Math.cos(angle) * 4));
      camera.lookAt(origin); camera.updateMatrixWorld(true);
      const forward = camera.getWorldDirection(new Vector3()), plane = new Plane().setFromNormalAndCoplanarPoint(forward, origin);
      ray.setFromCamera(new Vector2(0, 0), camera);
      const start = ray.ray.intersectPlane(plane, new Vector3())!;
      ray.setFromCamera(new Vector2(.05, .03), camera);
      const delta = ray.ray.intersectPlane(plane, new Vector3())!.sub(start);
      const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion), up = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      for (const constraint of ["front", "side", "x", "y", "z"] as const) {
        const constrained = studioDragDelta(delta, right, up, forward, constraint, 1);
        expect(constrained.length()).toBeLessThanOrEqual(delta.length() + 1e-12);
        expect(constrained.toArray().every(Number.isFinite)).toBe(true);
      }
    }
  });
  it.each([
    ["front", [.2, .3, 0]], ["side", [0, .3, -.1]],
    ["x", [.2, 0, 0]], ["y", [0, .3, 0]], ["z", [0, 0, -.1]],
  ] as const)("constrains %s in world coordinates without amplifying edge-on movement", (plane, expected) => {
    const delta = new Vector3(.2, .3, -.1);
    for (const right of [new Vector3(1, 0, 0), new Vector3(0, 0, 1), new Vector3(.000001, 0, 1).normalize()]) {
      const moved = studioDragDelta(delta, right, new Vector3(0, 1, 0), new Vector3(0, 0, -1), plane, 1);
      expect(moved.toArray()).toEqual(expected);
      expect(moved.length()).toBeLessThanOrEqual(delta.length());
    }
  });

  it("keeps locked coordinates exact when snapping and exposes only allowed translation axes", () => {
    const origin = new Vector3(.123, .456, .789);
    const snapped = studioSnapTarget(new Vector3(.251, 8, 9), origin, "x");
    expect(snapped.x).toBeCloseTo(.3);
    expect([snapped.y, snapped.z]).toEqual([.456, .789]);
    expect(studioTranslationAxes("front")).toEqual({ x: true, y: true, z: false });
    expect(studioTranslationAxes("side")).toEqual({ x: false, y: true, z: true });
    expect(studioTranslationAxes("floor")).toEqual({ x: true, y: false, z: true });
  });

  it("shows hinge rings only on x, frontal shoulders only on z, and leaves wrist controls to the grip editor", () => {
    expect(studioRotationAxes("left-elbow")).toEqual({ x: true, y: false, z: false });
    expect(studioRotationAxes("right-knee")).toEqual({ x: true, y: false, z: false });
    expect(studioRotationAxes("right-shoulder", true)).toEqual({ x: false, y: false, z: true });
    expect(studioRotationAxes("left-wrist")).toEqual({ x: false, y: false, z: false });
  });
  it("moves vertically across the view, while floor mode preserves height", () => {
    const delta = new Vector3(.2, .3, -.1), right = new Vector3(1, 0, 0), up = new Vector3(0, .95, -.31), forward = new Vector3(0, 0, -1);
    expect(studioDragDelta(delta, right, up, forward, "view", .5)).toEqual(delta.clone().multiplyScalar(.5));
    expect(studioDragDelta(delta, right, up, forward, "floor", 1).y).toBe(0);
    expect(studioDragDelta(delta, right, up, new Vector3(0, -.5, -1), "floor", 1).y).toBe(0);
  });

  it("moves the row handle in height and travel without moving its frame", () => {
    const scene = createQuickScene("cable-row-machine"), machine = scene.studio!.objects[0];
    const values = machineDragValues(machine, new Vector3(5, 1.4, .59));
    expect(values.machinePosition).toBeCloseTo(.5);
    expect(values.machineHandleHeight).toBe(1.4);
    expect(machineDragValues(machine, new Vector3(0, 9, -9))).toEqual({ machinePosition: 1, machineHandleHeight: 1.85 });
  });

  it.each(["regular", "reverse"] as const)("follows the %s pec deck arc from either handle", mode => {
    const machine = { ...createQuickScene("pec-deck").studio!.objects[0], machineMode: mode };
    for (const side of ["left", "right"] as const) for (let i = 0; i <= 16; i++) {
      const travel = i / 16;
      expect(machineDragValues(machine, machineHandlePoint({ ...machine, machinePosition: travel }, side), side).machinePosition).toBeCloseTo(travel);
    }
  });

  it("edits the displayed Quick finish, preserves the start and makes a smooth return", () => {
    const scene = createQuickScene("cable-row-machine"), machine = scene.studio!.objects[0];
    scene.studio!.presentation!.highlight = "group:abs";
    const next = moveMachineWithMouse(scene, machine.id, scene.durationMs / 2, { machinePosition: .7, machineHandleHeight: 1.4 }, "quick");
    const updated = next.studio!.objects[0];
    expect(sampleStudioObject(updated, 0).machinePosition).toBe(sampleStudioObject(machine, 0).machinePosition);
    expect(machineCarriagePoint(sampleStudioObject(updated, 0)).y).toBe(1.23);
    expect(machineCarriagePoint(sampleStudioObject(updated, scene.durationMs / 2))).toEqual(new Vector3(0, 1.4, .88 - .7 * .58));
    expect(machineCarriagePoint(sampleStudioObject(updated, scene.durationMs))).toEqual(machineCarriagePoint(sampleStudioObject(updated, 0)));
    expect(updated.frames!.map(({ x, y, z }) => ({ x, y, z }))).toEqual(machine.frames!.map(({ x, y, z }) => ({ x, y, z })));
    expect(next.keyframes).toEqual(scene.keyframes);
    expect(next.studio!.presentation!.highlight).toBe("group:abs");
  });

  it("edits only the displayed Advanced moment, preserving unrelated frames", () => {
    const scene = createQuickScene("cable-row-machine"), machine = scene.studio!.objects[0];
    const time = scene.durationMs / 4;
    const next = moveMachineWithMouse(scene, machine.id, time, { machinePosition: .6, machineHandleHeight: 1.35 }, "advanced");
    const updated = next.studio!.objects[0];
    expect(sampleStudioObject(updated, time)).toMatchObject({ ...identityTransform, machinePosition: .6, machineHandleHeight: 1.35 });
    expect(updated.frames!.filter(frame => frame.timeMs !== time)).toEqual(machine.frames!.filter(frame => frame.timeMs !== time));
    expect(next.keyframes).toEqual(scene.keyframes);
  });

  it("refuses a 25th equipment moment but allows editing an existing moment", () => {
    const scene = createQuickScene("cable-row-machine"), machine = scene.studio!.objects[0];
    machine.frames = Array.from({ length: 24 }, (_, index) => ({ ...identityTransform, timeMs: index * 100, machinePosition: .5 }));
    expect(() => moveMachineWithMouse(scene, machine.id, 50, { machinePosition: .6 }, "advanced")).toThrow("24");
    expect(moveMachineWithMouse(scene, machine.id, 100, { machinePosition: .6 }, "advanced").studio!.objects[0].frames).toHaveLength(24);
  });

  it("keeps actual atlas hands attached and feet stable through mouse-authored repetitions", async () => {
    const bytes = await readFile("public/models/z-anatomy/model.glb");
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    const rig = createAnatomyRig(gltf.scene);
    try {
      for (const variant of ["row", "regular", "reverse"] as const) {
        const original = createQuickScene(variant === "row" ? "cable-row-machine" : "pec-deck");
        if (variant !== "row") original.studio!.objects[0].machineMode = variant;
        const scene = moveMachineWithMouse(original, original.studio!.objects[0].id, original.durationMs / 2, { machinePosition: .7, ...(variant === "row" ? { machineHandleHeight: 1.4 } : {}) }, "quick");
        let firstHands: Vector3[] = [], firstFeet: Vector3[] = [], previous: Vector3[] = [];
        for (let index = 0; index <= 16; index++) {
          poseAnatomyRig(rig, {}, true);
          const report = applyStudioMachine(rig, scene, scene.durationMs * index / 16)!;
          expect(report.hands.every(hand => hand.contactError < .005)).toBe(true);
          const hands = [rig.handBones.left, rig.handBones.right].map(bone => bone.getWorldPosition(new Vector3()));
          const feet = [rig.footBones.left, rig.footBones.right].map(bone => bone.getWorldPosition(new Vector3()));
          if (index === 0) { firstHands = hands.map(point => point.clone()); firstFeet = feet.map(point => point.clone()); }
          feet.forEach((point, side) => expect(point.distanceTo(firstFeet[side])).toBeLessThan(1e-6));
          if (index > 0) hands.forEach((point, side) => expect(point.distanceTo(previous[side])).toBeLessThan(.3));
          if (index === 16) hands.forEach((point, side) => expect(point.distanceTo(firstHands[side])).toBeLessThan(1e-6));
          previous = hands;
        }
      }
    } finally { rig.dispose(); }
  });
});
