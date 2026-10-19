import { expect, it } from "vitest";
import { Object3D, Vector3 } from "three";
import { captureStudioTransform, restoreStudioTransform } from "./studio-transform-gesture";

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
