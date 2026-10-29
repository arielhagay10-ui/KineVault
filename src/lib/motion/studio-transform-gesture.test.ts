import { expect, it } from "vitest";
import { Object3D, Vector3 } from "three";
import { captureStudioTransform, constrainStudioJointRotation, restoreStudioTransform } from "./studio-transform-gesture";

it("cancels translation, rotation and scale without retaining changed world geometry", () => {
  const parent = new Object3D(), item = new Object3D();
  parent.position.set(1, 2, 3); parent.rotation.set(.1, .2, .3); parent.scale.setScalar(1.4);
  parent.add(item);
  item.position.set(.123, .456, .789); item.rotation.set(.3, -.2, .1); item.scale.setScalar(.8);
  const snapshot = captureStudioTransform(item), before = item.getWorldPosition(new Vector3());
  for (let index = 0; index <= 16; index++) {
    item.position.add(new Vector3(index * .01, -.2, .1)); item.rotation.set(.9, .8, .7); item.scale.setScalar(2);
    restoreStudioTransform(item, snapshot);
    expect(item.getWorldPosition(new Vector3()).distanceTo(before)).toBeLessThan(1e-12);
    expect(item.quaternion.angleTo(snapshot.rotation)).toBeLessThan(1e-7);
    expect(item.scale).toEqual(snapshot.scale);
  }
});

it("stops turned ankles at either flexion limit without leaking into another rotation plane", () => {
  for (const side of ["left", "right"] as const) for (const limit of [-45, 20]) {
    const item = new Object3D(), radians = Math.PI / 180;
    item.rotation.set(-limit * radians, 15 * radians, -10 * radians);
    const initial = item.quaternion.clone();
    item.rotateX((limit === 20 ? -10 : 10) * radians);
    constrainStudioJointRotation(`${side}-ankle`, item, initial);
    expect(item.quaternion.angleTo(initial)).toBeLessThan(1e-7);
  }
});

it("limits the drag along its quaternion path and allows reversing away from the boundary", () => {
  const item = new Object3D(), radians = Math.PI / 180;
  item.rotation.set(-10 * radians, 15 * radians, -10 * radians);
  const initial = item.quaternion.clone();
  item.rotateX(-30 * radians);
  constrainStudioJointRotation("left-ankle", item, initial);
  const delta = initial.clone().invert().multiply(item.quaternion);
  expect(Math.abs(delta.x)).toBeGreaterThan(.01);
  expect(Math.abs(delta.y) + Math.abs(delta.z)).toBeLessThan(1e-12);
  expect(-item.rotation.x / radians).toBeCloseTo(20, 3);
  const boundary = item.quaternion.clone();
  item.rotateX(5 * radians);
  const expected = item.quaternion.clone();
  constrainStudioJointRotation("left-ankle", item, boundary);
  expect(item.quaternion.angleTo(expected)).toBeLessThan(1e-7);
  expect(-item.rotation.x / radians).toBeLessThan(20);
});

it("retains repair-on-edit for legacy elbow poses outside manual authoring limits", () => {
  const item = new Object3D(), radians = Math.PI / 180;
  item.rotation.set(-60 * radians, 10 * radians, -20 * radians);
  const initial = item.quaternion.clone();
  item.rotateX(-5 * radians);
  constrainStudioJointRotation("left-elbow", item, initial);
  expect(item.rotation.y).toBeCloseTo(0, 12); expect(item.rotation.z).toBeCloseTo(0, 12);
  expect(-item.rotation.x / radians).toBeGreaterThan(60);
});
