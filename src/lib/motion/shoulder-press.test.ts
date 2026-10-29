import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { Group, Mesh, Quaternion, Triangle, Vector3, type Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { createStudioObject, studioPointToWorld } from "./studio";
import { studioGripOffset } from "./studio-grip";
import { shoulderPress, shoulderPressGripSegment, shoulderPressGripPoint, shoulderPressGripRotation, shoulderPressLever, shoulderPressPositionAtPoint, reachShoulderPressGrip } from "./shoulder-press";
import { createEquipmentAssetInstance, disposeEquipmentAsset, equipmentAssets, updateEquipmentAsset } from "./equipment-assets";
import { clampJointControlAngles, jointLimits } from "./workshop";
import { machineGripPoint, machineHandlePoint } from "./studio-machines";
import { setGripOffset } from "./grip-edit";

function surfaceDistance(root: Object3D, point: Vector3) {
  let distance = Infinity;
  root.updateWorldMatrix(true, true);
  root.traverse(node => {
    if (!(node instanceof Mesh)) return;
    const { index, attributes: { position } } = node.geometry;
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
      const vertices = [0, 1, 2].map(offset => new Vector3().fromBufferAttribute(position, index ? index.getX(i + offset) : i + offset).applyMatrix4(node.matrixWorld));
      const triangle = new Triangle(vertices[0], vertices[1], vertices[2]);
      if (triangle.getArea() > 1e-12) distance = Math.min(distance, triangle.closestPointToPoint(point, new Vector3()).distanceTo(point));
    }
  });
  return distance;
}

describe("plate-loaded shoulder press", () => {
  it.each(["wide", "neutral"] as const)("keeps the %s palms and wrists steady through the complete rep", pressGrip => {
    const rig = createAnatomyRig(new Group());
    const object = { ...createStudioObject("shoulder-press-machine", crypto.randomUUID(), 0), x: 0, z: 0, pressGrip };
    const start: Partial<Record<"left" | "right", Quaternion>> = {};
    const wristOffset: Partial<Record<"left" | "right", Vector3>> = {};
    const previous: Partial<Record<"left" | "right", Quaternion>> = {};
    const previousWrist: Partial<Record<"left" | "right", Quaternion>> = {};
    try {
      for (let step = 0; step <= 256; step++) {
        object.machinePosition = step <= 128 ? step / 128 : (256 - step) / 128;
        poseAnatomyRig(rig, {}, true);
        rig.root.scale.setScalar(.85);
        rig.root.position.copy(new Vector3(...shoulderPress.seat.pelvis).sub(rig.bones.pelvis.position.clone().multiplyScalar(.85)));
        for (const side of ["left", "right"] as const) {
          expect(reachShoulderPressGrip(rig, object, side, new Quaternion())).toBeLessThan(.004);
          const hand = rig.handBones[side].getWorldQuaternion(new Quaternion());
          start[side] ??= hand.clone();
          expect(hand.angleTo(start[side]!) * 180 / Math.PI, `${step} ${side} palm drift`).toBeLessThan(2);
          const offset = rig.handBones[side].getWorldPosition(new Vector3()).sub(shoulderPressGripPoint(object, side));
          wristOffset[side] ??= offset.clone();
          expect(offset.distanceTo(wristOffset[side]!), `${step} ${side} wrist drift`).toBeLessThan(.006);
          if (previous[side]) expect(hand.angleTo(previous[side]!) * 180 / Math.PI, `${step} ${side} hand jump`).toBeLessThan(3);
          if (previousWrist[side]) expect(rig.handBones[side].quaternion.angleTo(previousWrist[side]!) * 180 / Math.PI, `${step} ${side} wrist jump`).toBeLessThan(3);
          previous[side] = hand;
          previousWrist[side] = rig.handBones[side].quaternion.clone();
        }
      }
    } finally { rig.dispose(); }
  });
  it("converges smoothly to shoulder width on independent circular lever paths", () => {
    const object = createStudioObject("shoulder-press-machine", crypto.randomUUID(), 0);
    for (const pressGrip of ["wide", "neutral"] as const) {
      let previousSpan = Infinity;
      for (let step = 0; step <= 32; step++) {
        const setup = { ...object, pressGrip, machinePosition: step / 32 };
        const left = shoulderPressGripPoint(setup, "left"), right = shoulderPressGripPoint(setup, "right");
        const span = left.x - right.x;
        expect(span).toBeLessThanOrEqual(previousSpan);
        previousSpan = span;
        expect(left.y).toBeCloseTo(right.y, 8);
        expect(left.z).toBeCloseTo(right.z, 8);
        const independent = { ...setup, machinePositionLeft: step / 32, machinePositionRight: 0 };
        expect(shoulderPressGripPoint(independent, "left").distanceTo(left)).toBeLessThan(1e-8);
        expect(shoulderPressGripPoint(independent, "right").distanceTo(shoulderPressGripPoint({ ...setup, machinePosition: 0 }, "right"))).toBeLessThan(1e-8);
        for (const side of ["left", "right"] as const) {
          const lever = shoulderPressLever(setup, side);
          const handle = shoulderPress[pressGrip].center;
          const offset = new Vector3((side === "left" ? 1 : -1) * handle[0], handle[1] - shoulderPress.arm[1], handle[2] - shoulderPress.arm[2]);
          const center = shoulderPressGripPoint(setup, side).sub(lever.pivot).sub(offset);
          const rest = shoulderPressGripPoint({ ...setup, machinePosition: 0 }, side).sub(lever.pivot).sub(offset);
          expect(center.length()).toBeCloseTo(rest.length(), 8);
        }
      }
      expect(previousSpan).toBeGreaterThan(.44);
      expect(previousSpan).toBeLessThan(.66);
    }
  });
  it.each(["wide", "neutral"] as const)("keeps %s grip picking and offsets in the fixed handle frame", pressGrip => {
    const object = { ...createStudioObject("shoulder-press-machine", crypto.randomUUID(), 0), pressGrip };
    for (const side of ["left", "right"] as const) for (let step = 0; step <= 16; step++) {
      object.machinePosition = step / 16;
      const automatic = machineHandlePoint(object, side);
      expect(automatic.distanceTo(shoulderPressGripPoint(object, side))).toBeLessThan(1e-6);
      const clicked = automatic.clone().add(new Vector3(.01, -.01, .02));
      const delta = clicked.clone().sub(automatic);
      const edited = setGripOffset(object, side, { x: delta.x, y: delta.y, z: delta.z });
      expect(machineGripPoint(edited, side).distanceTo(clicked)).toBeLessThan(1e-6);
      expect(machineHandlePoint(edited, side).distanceTo(automatic)).toBeLessThan(1e-6);
      expect(shoulderPressPositionAtPoint(edited, side, clicked)).toBeCloseTo(step / 16, 6);
    }
  });
  it.each(["wide", "neutral"] as const)("finishes the %s press with extended elbows", pressGrip => {
    const rig = createAnatomyRig(new Group());
    const object = { ...createStudioObject("shoulder-press-machine", crypto.randomUUID(), 0), x: 0, z: 0, pressGrip, machinePosition: 1 };
    try {
      poseAnatomyRig(rig, {}, true);
      rig.root.scale.setScalar(.85);
      rig.root.position.copy(new Vector3(...shoulderPress.seat.pelvis).sub(rig.bones.pelvis.position.clone().multiplyScalar(.85)));
      for (const side of ["left", "right"] as const) {
        const error = reachShoulderPressGrip(rig, object, side, new Quaternion());
        const shoulder = rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3());
        const elbow = rig.bones[`${side}-elbow`].getWorldPosition(new Vector3());
        const wrist = rig.handBones[side].getWorldPosition(new Vector3());
        expect(error).toBeLessThan(.004);
        expect(elbow.clone().sub(shoulder).angleTo(wrist.clone().sub(elbow)) * 180 / Math.PI, `${side} elbow flexion`).toBeLessThan(20);
        expect(wrist.y - shoulder.y).toBeGreaterThan(.75);
      }
    } finally { rig.dispose(); }
  });
  it("keeps the connected handle orientation and forward grip offset fixed through travel", () => {
    const object = { ...createStudioObject("shoulder-press-machine", crypto.randomUUID(), 0) };
    for (const side of ["left", "right"] as const) {
      const orientation = shoulderPressGripRotation({ ...object, pressGrip: "neutral", machinePosition: 0 }, side);
      const atRest = shoulderPressGripPoint({ ...object, pressGrip: "neutral", machinePosition: 0 }, side).sub(shoulderPressGripPoint({ ...object, pressGrip: "wide", machinePosition: 0 }, side));
      for (let step = 0; step <= 16; step++) {
        object.machinePosition = step / 16;
        expect(shoulderPressGripRotation({ ...object, pressGrip: "neutral" }, side).angleTo(orientation)).toBeLessThan(1e-6);
        const offset = shoulderPressGripPoint({ ...object, pressGrip: "neutral" }, side).sub(shoulderPressGripPoint({ ...object, pressGrip: "wide" }, side));
        expect(offset.distanceTo(atRest)).toBeLessThan(1e-6);
      }
    }
  });
  it("keeps neutral elbows on the same path after shoulder-control edits", () => {
    const rig = createAnatomyRig(new Group());
    const pose = { "left-shoulder": { x: -95, y: -17, z: -78 }, "right-shoulder": { x: -95, y: 17, z: 78 } };
    const object = { ...createStudioObject("shoulder-press-machine", crypto.randomUUID(), 0), x: 0, z: 0, pressGrip: "neutral" as const };
    try {
      for (let step = 0; step <= 16; step++) for (const side of ["left", "right"] as const) {
        object.machinePosition = step / 16;
        const elbows = [{}, pose].map(authored => {
          poseAnatomyRig(rig, authored, true);
          rig.root.scale.setScalar(.85);
          rig.root.position.copy(new Vector3(...shoulderPress.seat.pelvis).sub(rig.bones.pelvis.position.clone().multiplyScalar(.85)));
          expect(reachShoulderPressGrip(rig, object, side, new Quaternion(), authored)).toBeLessThan(.004);
          return rig.bones[`${side}-elbow`].getWorldPosition(new Vector3());
        });
        expect(elbows[0].distanceTo(elbows[1]), `${step} ${side}`).toBeLessThan(.005);
      }
    } finally { rig.dispose(); }
  });
  it("joins the forward neutral extension to the wide handle in the body plane", () => {
    const object = { ...createStudioObject("shoulder-press-machine", crypto.randomUUID(), 0), machinePosition: 0 };
    for (const side of ["left", "right"] as const) {
      const wide = shoulderPressGripSegment(side, "wide"), neutral = shoulderPressGripSegment(side, "neutral");
      const start = new Vector3().fromArray(neutral.from);
      expect(Math.min(start.distanceTo(new Vector3().fromArray(wide.from)), start.distanceTo(new Vector3().fromArray(wide.to)))).toBeLessThan(.001);
      const widePoint = shoulderPressGripPoint({ ...object, pressGrip: "wide" }, side);
      const neutralPoint = shoulderPressGripPoint({ ...object, pressGrip: "neutral" }, side);
      expect(Math.abs(widePoint.z)).toBeLessThan(.04);
      expect(neutralPoint.z - widePoint.z).toBeGreaterThan(.10);
    }
  });
  it.each(["wide", "neutral"] as const)("keeps %s contact on the shipped GLB throughout both independent lever strokes", async pressGrip => {
    const definition = equipmentAssets["shoulder-press-machine"];
    const bytes = await readFile(`public${definition.url}`);
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    const asset = createEquipmentAssetInstance(gltf.scene, definition);
    const object = { ...createStudioObject("shoulder-press-machine", crypto.randomUUID(), 0), x: 0, z: 0, pressGrip };
    try {
      for (let step = 0; step <= 16; step++) {
        Object.assign(object, { machinePositionLeft: step / 16, machinePositionRight: 1 - step / 16 });
        updateEquipmentAsset(asset, object);
        for (const side of ["left", "right"] as const) {
          const lever = asset.groups[side === "left" ? "LeftLever" : "RightLever"];
          expect(surfaceDistance(lever, shoulderPressGripPoint(object, side))).toBeLessThan(.027);
          const swivel = asset.groups[side === "left" ? "LeftNeutralGrip" : "RightNeutralGrip"];
          const neutral = { ...object, pressGrip: "neutral" as const };
          const handlePoint = swivel.localToWorld(new Vector3(side === "left" ? shoulderPress.neutral.center[0] : -shoulderPress.neutral.center[0],
            shoulderPress.neutral.center[1] - shoulderPress.wide.center[1], shoulderPress.neutral.center[2] - shoulderPress.wide.center[2]));
          expect(handlePoint.distanceTo(shoulderPressGripPoint(neutral, side))).toBeLessThan(1e-6);
          const shaft = new Vector3(0, 0, 1).applyQuaternion(swivel.getWorldQuaternion(new Quaternion()));
          const expectedShaft = new Vector3(0, 0, 1);
          expect(shaft.distanceTo(expectedShaft)).toBeLessThan(1e-6);
          expect(swivel.getWorldQuaternion(new Quaternion()).angleTo(new Quaternion())).toBeLessThan(1e-6);
        }
      }
      expect(surfaceDistance(asset.groups.Static, new Vector3(0, .655, 0))).toBeLessThan(.002);
    } finally { disposeEquipmentAsset(asset.root); disposeEquipmentAsset(gltf.scene); }
  });
  it.each(["wide", "neutral"] as const)("keeps %s hands on independent physical lever arcs with fixed limb lengths", pressGrip => {
    const rig = createAnatomyRig(new Group());
    const object = { ...createStudioObject("shoulder-press-machine", crypto.randomUUID(), 0), x: 0, z: 0, pressGrip };
    try {
      // Larger torso edits pass the seated feasibility guard, including palm orientation.
      for (const lean of pressGrip === "wide" ? [0] : [0, -2, 2]) {
        const previous: Partial<Record<"left" | "right", Vector3>> = {};
        const previousRotation: Partial<Record<"left" | "right", Quaternion>> = {};
        const samples = lean === 0 ? 128 : 16;
        for (let step = 0; step <= samples; step++) {
          if (lean !== 0 && (step < 6 || step > 10)) continue;
          Object.assign(object, { machinePositionLeft: step / samples, machinePositionRight: 1 - step / samples });
          poseAnatomyRig(rig, {}, true);
          rig.bones.torso.rotation.x = lean * Math.PI / 180;
          rig.root.scale.setScalar(.85);
          rig.root.position.copy(new Vector3(...shoulderPress.seat.pelvis).sub(rig.bones.pelvis.position.clone().multiplyScalar(.85)));
          rig.root.updateWorldMatrix(true, true);
          for (const side of ["left", "right"] as const) {
            const upper = rig.bones[`${side}-elbow`].position.clone(), lower = rig.handBones[side].position.clone();
            const error = reachShoulderPressGrip(rig, object, side, new Quaternion());
            expect(error, `${pressGrip} ${lean} ${step} ${side}`).toBeLessThan(.004);
            expect(rig.bones[`${side}-elbow`].position.distanceTo(upper)).toBe(0);
            expect(rig.handBones[side].position.distanceTo(lower)).toBe(0);
            const target = studioPointToWorld(shoulderPressGripPoint(object, side), object);
            expect(rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(target)).toBeLessThan(.004);
            const shoulder = rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3());
            const elbow = rig.bones[`${side}-elbow`].getWorldPosition(new Vector3());
            if (pressGrip === "wide" && lean === 0) expect(Math.abs(elbow.z - shoulder.z), `wide ${step} ${side} elbow plane`).toBeLessThan(.05);
            const wrist = rig.handBones[side].getWorldPosition(new Vector3());
            const bend = elbow.clone().sub(shoulder).angleTo(wrist.clone().sub(elbow)) * 180 / Math.PI;
            for (const part of ["shoulder", "elbow"] as const) {
              const rotation = rig.bones[`${side}-${part}`].rotation;
              const angles = { x: rotation.x * 180 / Math.PI * (part === "elbow" ? -1 : 1), y: rotation.y * 180 / Math.PI, z: -rotation.z * 180 / Math.PI };
              const guarded = clampJointControlAngles(`${side}-${part}`, angles);
              for (const axis of ["x", "y", "z"] as const) expect(angles[axis], `${pressGrip} ${lean} ${step} ${side} ${part} guarded ${axis}`).toBeCloseTo(guarded[axis], 3);
              for (const axis of ["x", "y", "z"] as const) {
                const limits = jointLimits[`${side}-${part}`][axis];
                expect(angles[axis], `${pressGrip} ${lean} ${step} ${side} ${part} ${axis}`).toBeGreaterThanOrEqual(limits[0] - .001);
                expect(angles[axis], `${pressGrip} ${lean} ${step} ${side} ${part} ${axis}`).toBeLessThanOrEqual(limits[1] + .001);
              }
            }
            expect(bend, `${pressGrip} ${lean} ${step} ${side} elbow`).toBeLessThan(150);
            const torsoElbow = rig.bones.torso.worldToLocal(elbow.clone());
            expect(Math.abs(torsoElbow.x) > .22 || torsoElbow.z > .30 || torsoElbow.y > .93,
              `${pressGrip} ${lean} ${step} ${side} elbow clearance`).toBe(true);
            if (previous[side]) expect(elbow.distanceTo(previous[side]!), `${pressGrip} ${lean} ${step} ${side} continuity`).toBeLessThan(lean === 0 ? .05 : .20);
            previous[side] = elbow.clone();
            const shoulderRotation = rig.bones[`${side}-shoulder`].getWorldQuaternion(new Quaternion());
            if (lean === 0 && previousRotation[side]) expect(shoulderRotation.angleTo(previousRotation[side]!) * 180 / Math.PI,
              `${pressGrip} ${step} ${side} shoulder continuity`).toBeLessThan(15);
            previousRotation[side] = shoulderRotation;
            expect(rig.handBones[side].quaternion.angleTo(new Quaternion()) * 180 / Math.PI, `${pressGrip} ${lean} ${step} ${side} wrist`).toBeLessThan(45);
            const handWorld = rig.handBones[side].getWorldQuaternion(new Quaternion());
            const wristBend = new Vector3(0, -1, 0).applyQuaternion(handWorld).angleTo(wrist.clone().sub(elbow)) * 180 / Math.PI;
            expect(wristBend, `${pressGrip} ${lean} ${step} ${side} physical wrist`).toBeLessThan(45);
            const forearm = rig.forearmBones[side].quaternion, rollAxis = rig.handBones[side].position.clone().normalize();
            const turn = (side === "left" ? 1 : -1) * 2 * Math.atan2(new Vector3(forearm.x, forearm.y, forearm.z).dot(rollAxis), forearm.w) * 180 / Math.PI;
            expect(turn).toBeGreaterThanOrEqual(-.001);
            expect(turn).toBeLessThanOrEqual(180.001);
            const lever = shoulderPressLever(object, side);
            const shaft = new Vector3(1, 0, 0).applyQuaternion(shoulderPressGripRotation(object, side));
            const handShaft = new Vector3(1, 0, 0).applyQuaternion(rig.handBones[side].getWorldQuaternion(new Quaternion()));
            expect(Math.abs(shaft.dot(handShaft)), `${pressGrip} ${lean} ${step} ${side} shaft`).toBeGreaterThan(.995);
            expect(shoulderPressPositionAtPoint(object, side, target)).toBeCloseTo(side === "left" ? step / samples : 1 - step / samples, 6);
            expect(lever.angle).toBeCloseTo(shoulderPressLever({ ...object, pressGrip: pressGrip === "wide" ? "neutral" : "wide" }, side).angle);
          }
        }
      }
    } finally { rig.dispose(); }
  });
});
