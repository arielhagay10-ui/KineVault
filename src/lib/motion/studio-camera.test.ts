import { expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { cameraDistanceForPoints, placeViewerCamera, renderCreditInset, studioCameraPoints } from "./studio-camera";
import { createStudioObject, studioPointToWorld } from "./studio";
import type { StudioObject } from "./workshop";

it.each(["cable-row-machine", "pec-deck"] as const)("includes the complete %s frame in camera fitting", slug => {
  const object = { ...createStudioObject(slug, "00000000-0000-4000-8000-000000000001", 0), x: 0, z: 0 };
  const points = studioCameraPoints([object]);
  expect(points.length).toBeGreaterThan(0);
  expect(Math.max(...points.map(point => point.z))).toBeGreaterThanOrEqual(slug === "cable-row-machine" ? 1.81 : 0.85);
  expect(Math.min(...points.map(point => point.z))).toBeLessThanOrEqual(slug === "pec-deck" ? -0.85 : -0.56);
  expect(Math.max(...points.map(point => point.x))).toBeGreaterThanOrEqual(slug === "pec-deck" ? 1.27 : 0.56);
  expect(Math.max(...points.map(point => point.y))).toBeGreaterThanOrEqual(slug === "pec-deck" ? 2.79 : 2.45);
});

it("frames taller towers even when a tower is closer to a side-view camera", () => {
  const points = [-1.95, 1.95].flatMap(x => [0, 3.35].flatMap(y => [-1.55, -0.65].map(z => new Vector3(x, y, z))));
  const target = new Vector3(0, 1.675, 0);
  for (const offset of [new Vector3(5.3, 0.27, 0), new Vector3(0, 0.27, -5.3), new Vector3(3.2, 0.47, 5.1)]) for (const aspect of [2, 0.7]) {
    const camera = new PerspectiveCamera(34, aspect, 0.1, 100);
    camera.position.copy(target).add(offset.clone().normalize().multiplyScalar(cameraDistanceForPoints(points, target, offset, 34, aspect)));
    camera.lookAt(target); camera.updateMatrixWorld(true);
    for (const point of points) {
      const projected = point.clone().project(camera);
      expect(Math.abs(projected.x)).toBeLessThan(0.95);
      expect(Math.abs(projected.y)).toBeLessThan(0.95);
    }
  }
});

// The 640x640 render of a standard-height figure; its credit strip covers NDC y below this line.
const creditLine = renderCreditInset / 320 - 1;
function renderCamera(view: "front" | "side", objects: StudioObject[]) {
  const camera = new PerspectiveCamera(34, 1, 0.1, 100);
  placeViewerCamera(camera, { view, overhead: false, bench: false, contentHeight: 2.75, bounds: studioCameraPoints(objects), width: 640, height: 640, inset: renderCreditInset });
  camera.updateMatrixWorld(true);
  return camera;
}

it("keeps floor-level barbell plates above the render's credit strip", () => {
  // A conventional deadlift start: the bar rests on its 0.2 m plates in front of the shins.
  const barbell = { ...createStudioObject("barbell", "00000000-0000-4000-8000-000000000001", 0), x: 0, y: 0, z: 0.3 };
  const camera = renderCamera("side", [barbell]);
  for (const x of [-0.84, 0.84]) for (const z of [-0.2, 0.2]) {
    expect(studioPointToWorld({ x, y: 0, z }, barbell).project(camera).y).toBeGreaterThan(creditLine);
  }
});

it("keeps the lateral raise machine's toes above the front render's credit strip", () => {
  const object = { ...createStudioObject("lateral-raise-machine", "00000000-0000-4000-8000-000000000001", 0), x: 0, z: 0 };
  // Toes rest on the floor about 0.8 m in front of the lever axes.
  expect(new Vector3(0, 0, 0.8).project(renderCamera("front", [object])).y).toBeGreaterThan(creditLine);
});

it("leaves viewers without the credit strip unshifted", () => {
  const camera = new PerspectiveCamera(34, 1, 0.1, 100);
  placeViewerCamera(camera, { view: "side", overhead: false, bench: false, contentHeight: 2.75, bounds: [], width: 640, height: 640 });
  expect(camera.view).toBeNull();
});
