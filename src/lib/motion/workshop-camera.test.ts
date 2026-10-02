import { expect, it } from "vitest";
import { Group, Mesh, MeshStandardMaterial, PerspectiveCamera, Vector3 } from "three";
import { blankWorkshopScene } from "./workshop";
import { fadeWorkshopEquipment, fitWorkshopCamera, oppositeCameraPosition, zoomCameraPosition } from "./workshop-camera";
import { searchAnatomy } from "./workshop-anatomy-search";
import { createStudioObject } from "./studio";
import { createAdjustableBench } from "./adjustable-bench";
import { Box3 } from "three";
import { workshopCameraView } from "./workshop-camera";

it("fits a translated, scaled body on a narrow screen", () => {
  const scene = { ...blankWorkshopScene, studio: { body: { ...blankWorkshopScene.studio!.body, x: 4, y: 1, scale: 1.5 }, objects: [] } };
  const fit = fitWorkshopCamera(scene, "front", 0.5, 34);
  const camera = new PerspectiveCamera(34, 0.5, 0.1, 100);
  camera.position.copy(fit.position); camera.lookAt(fit.target); camera.updateMatrixWorld(true);
  for (const point of [new Vector3(2.725, 1, -1.05), new Vector3(5.275, 5.65, 1.05)]) {
    const projected = point.project(camera);
    expect(Math.abs(projected.x)).toBeLessThan(0.95);
    expect(Math.abs(projected.y)).toBeLessThan(0.95);
  }
});

it("zooms toward the current target and respects distance limits", () => {
  const target = new Vector3(4, 2, 1), position = new Vector3(4, 2, 6);
  expect(zoomCameraPosition(position, target, 0.8, 1, 25).toArray()).toEqual([4, 2, 5]);
  expect(zoomCameraPosition(position, target, 0.01, 1, 25).distanceTo(target)).toBe(1);
  expect(zoomCameraPosition(position, target, 100, 1, 25).distanceTo(target)).toBe(25);
  expect(position.toArray()).toEqual([4, 2, 6]);
});

it("shows the opposite horizontal side without changing height or focus", () => {
  expect(oppositeCameraPosition(new Vector3(7, 5, 8), new Vector3(2, 3, 1)).toArray()).toEqual([-3, 5, -6]);
});

it("fades equipment without changing shared materials and restores it", () => {
  const material = new MeshStandardMaterial({ opacity: 0.8, transparent: false, depthWrite: true });
  const equipment = new Group(), mesh = new Mesh(undefined, material);
  equipment.add(mesh);
  const restore = fadeWorkshopEquipment(equipment);
  expect(mesh.material).not.toBe(material);
  expect(mesh.material.opacity).toBeLessThan(0.3);
  expect(mesh.material.transparent).toBe(true);
  expect(mesh.material.depthWrite).toBe(false);
  expect(material.opacity).toBe(0.8);
  restore();
  expect(mesh.material).toBe(material);
  expect(material.depthWrite).toBe(true);
});

it("finds familiar body areas and formal names without changing selection", () => {
  const muscles = [{ id: "Gluteus_maximusl", label: "Gluteus maximus (left)" }, { id: "Biceps_brachiir", label: "Biceps brachii (right)" }];
  expect(searchAnatomy(muscles, "butt").individual.map(item => item.id)).toEqual(["Gluteus_maximusl"]);
  expect(searchAnatomy(muscles, "upper arm").individual.map(item => item.id)).toEqual(["Biceps_brachiir"]);
  expect(searchAnatomy(muscles, "gluteus left").individual.map(item => item.id)).toEqual(["Gluteus_maximusl"]);
  expect(searchAnatomy(muscles, "zzzz")).toEqual({ groups: [], individual: [] });
  expect(muscles[0].id).toBe("Gluteus_maximusl");
});

it("fits a bench's complete geometry at both rotated and translated endpoints", () => {
  const bench = createStudioObject("bench", "bench", 0);
  bench.benchAngle = 0;
  bench.frames = [{ ...blankWorkshopScene.studio!.body, timeMs: 0 }, { ...blankWorkshopScene.studio!.body, timeMs: 3200, x: 10, rotationY: 135, rotationZ: 35, scale: 2 }];
  const scene = { ...blankWorkshopScene, studio: { ...blankWorkshopScene.studio!, objects: [bench] } };
  const fit = fitWorkshopCamera(scene, "front", 0.5, 34);
  const camera = new PerspectiveCamera(34, 0.5, 0.1, 100);
  camera.position.copy(fit.position); camera.lookAt(fit.target); camera.updateMatrixWorld(true);
  for (const frame of bench.frames) {
    const geometry = createAdjustableBench(0);
    try {
      geometry.root.position.set(frame.x, frame.y, frame.z);
      geometry.root.rotation.set(frame.rotationX * Math.PI / 180, frame.rotationY * Math.PI / 180, frame.rotationZ * Math.PI / 180);
      geometry.root.scale.setScalar(frame.scale);
      const bounds = new Box3().setFromObject(geometry.root);
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const projected = new Vector3(x, y, z).project(camera);
        expect(Math.abs(projected.x)).toBeLessThan(1);
        expect(Math.abs(projected.y)).toBeLessThan(1);
      }
    } finally { geometry.dispose(); }
  }
});

it("renders restored authored views even after a local Side choice", () => {
  const choice = { sceneAngle: "front" as const, view: "side" as const };
  for (const view of ["front", "back"] as const) {
    const scene = { ...blankWorkshopScene, cameraAngle: "front" as const, studio: { ...blankWorkshopScene.studio!, presentation: { highlight: "group:abs", isolate: false, view } } };
    const visibleView = workshopCameraView(scene, true, choice);
    const fit = fitWorkshopCamera(scene, visibleView, 1, 34);
    expect(fit.position.z > fit.target.z).toBe(view === "front");
    expect(fit.position.x).toBeCloseTo(fit.target.x);
  }
});
