import { expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { cameraDistanceForPoints, studioCameraPoints } from "./studio-camera";
import { createStudioObject } from "./studio";

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
