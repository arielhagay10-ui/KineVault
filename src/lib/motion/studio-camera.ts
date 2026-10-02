import { Vector3 } from "three";
import { maxPulleyHeight, studioPointToWorld } from "./studio";
import type { StudioObject } from "./workshop";

export function cameraDistanceForPoints(points: Vector3[], target: Vector3, offset: Vector3, fov: number, aspect: number) {
  const outward = offset.clone().normalize();
  const right = new Vector3(0, 1, 0).cross(outward).normalize(), up = outward.clone().cross(right).normalize();
  const tangent = Math.tan(fov * Math.PI / 360);
  return points.reduce((distance, point) => {
    const local = point.clone().sub(target);
    return Math.max(distance, local.dot(outward) + Math.max(Math.abs(local.dot(right)) / (tangent * aspect), Math.abs(local.dot(up)) / tangent) * 1.12);
  }, offset.length());
}

export function studioCameraPoints(objects: StudioObject[] | undefined) {
  const bounds: Partial<Record<StudioObject["slug"], { width: number; height: number; depth: [number, number] }>> = {
    "cable-machine": { width: 0.75, height: maxPulleyHeight + 0.15, depth: [-0.8, 0.8] },
    "lat-pulldown-machine": { width: 0.75, height: 2.85, depth: [-0.8, 0.8] },
    "smith-machine": { width: 1.4, height: 3.4, depth: [-0.8, 0.8] },
    "leg-press": { width: 1.05, height: 2, depth: [-1.45, 1.1] },
    "cable-row-machine": { width: 0.6, height: 2.5, depth: [-0.95, 1.9] },
    "pec-deck": { width: 1.3, height: 2.8, depth: [-1.5, 1.05] },
  };
  return objects?.flatMap(object => {
    const size = bounds[object.slug];
    if (!size) return [];
    return [object, ...(object.frames ?? []).map(frame => ({ ...object, ...frame }))].flatMap(transform =>
      [-size.width, size.width].flatMap(x => [0, size.height].flatMap(y => size.depth.map(z => studioPointToWorld({ x, y, z }, transform)))));
  }) ?? [];
}
