import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from "three";
import { expect, it } from "vitest";
import { createStudioObject } from "./studio";
import { equipmentBoundsOverlap, isWorkshopPlacementLocked, needsPlacementAdvisory, placementBodyBounds } from "./workshop-placement";

it("locks only engaged machines with authored motion and excludes deliberate contacts from advisories", () => {
  const machine = createStudioObject("pec-deck", "machine", 0);
  expect(isWorkshopPlacementLocked(machine)).toBe(false);
  const animated = { ...machine, machineUse: true, frames: [{ ...machine, timeMs: 0 }] };
  expect(isWorkshopPlacementLocked(animated)).toBe(true);
  expect(isWorkshopPlacementLocked({ ...animated, machineUse: false })).toBe(false);
  expect(needsPlacementAdvisory(animated)).toBe(false);
  const weight = createStudioObject("dumbbell", "weight", 0);
  expect(needsPlacementAdvisory({ ...weight, attachment: "left" })).toBe(false);
  expect(needsPlacementAdvisory(weight)).toBe(true);
  const bench = createStudioObject("bench", "bench", 0);
  expect(needsPlacementAdvisory(bench, [bench.id])).toBe(false);
});

it("uses rendered geometry bounds across rotations/scales and reports repair after moving away", () => {
  const group = new Group();
  const mesh = new Mesh(new BoxGeometry(.2, .2, 2), new MeshBasicMaterial());
  group.add(mesh);
  const body = new Box3(new Vector3(-.3, -.3, -.3), new Vector3(.3, .3, .3));
  for (let index = 0; index <= 16; index++) {
    group.rotation.y = index * Math.PI / 16;
    group.scale.setScalar(.5 + index / 16);
    expect(equipmentBoundsOverlap(group, body)).toBe(true);
  }
  group.position.x = 3;
  expect(equipmentBoundsOverlap(group, body)).toBe(false);
  expect(body.min.x).toBe(-.3);
  mesh.geometry.dispose(); (mesh.material as MeshBasicMaterial).dispose();
});

it("refreshes body bounds when the posed geometry snapshot changes", () => {
  const body = new Mesh(new BoxGeometry(1, 1, 1));
  const before = placementBodyBounds(body, "start");
  body.position.x = 2;
  const after = placementBodyBounds(body, "finish");
  expect(before.min.x).toBe(-.5);
  expect(after.min.x).toBe(1.5);
  body.geometry.dispose();
});

it("refreshes overlap after solved child motion even with unchanged body placement", () => {
  const body = new Group(), limb = new Mesh(new BoxGeometry(.2, .2, .2));
  body.add(limb);
  const equipment = new Mesh(new BoxGeometry(.3, .3, .3));
  for (let index = 0; index <= 16; index++) {
    limb.position.x = index / 8;
    body.updateWorldMatrix(true, true);
    const bounds = placementBodyBounds(body, JSON.stringify(limb.matrixWorld.elements));
    expect(equipmentBoundsOverlap(equipment, bounds)).toBe(index <= 1);
  }
  limb.geometry.dispose(); equipment.geometry.dispose();
});
