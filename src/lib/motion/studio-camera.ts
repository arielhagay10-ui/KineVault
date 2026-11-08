import { PerspectiveCamera, Vector3, type Camera } from "three";
import { maxPulleyHeight, studioPointToWorld } from "./studio";
import type { StudioObject, WorkshopScene } from "./workshop";

/** Pixels between the render's bottom edge and the top of its full credit strip (bottom-2, py-1 and three 10px lines). */
export const renderCreditInset = 46;

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
    "t-bar-row-machine": { width: .78, height: 1.62, depth: [-1.12, 1.18] },
    "leg-extension-machine": { width: .62, height: 2.6, depth: [-1.12, 1.45] },
    "leg-curl-machine": { width: .62, height: 2.6, depth: [-1.12, 1.45] },
    "lateral-raise-machine": { width: 1.05, height: 2.3, depth: [-.9, .85] },
    "calf-raise-machine": { width: .9, height: 2.9, depth: [-1.05, .6] },
    "pull-up-bar": { width: .85, height: 3.55, depth: [-.65, .65] },
  };
  return objects?.flatMap(object => {
    const size = bounds[object.slug];
    if (!size) return [];
    return [object, ...(object.frames ?? []).map(frame => ({ ...object, ...frame }))].flatMap(transform =>
      [-size.width, size.width].flatMap(x => [0, size.height].flatMap(y => size.depth.map(z => studioPointToWorld({ x, y, z }, transform)))));
  }) ?? [];
}

/** Places the viewer and render camera; `inset` keeps that many pixels at the bottom clear of the scene. */
export function placeViewerCamera(camera: Camera, { view, overhead, bench, contentHeight, bounds, width, height, inset = 0 }: {
  view: WorkshopScene["cameraAngle"] | "back"; overhead: boolean; bench: boolean; contentHeight: number; bounds: Vector3[];
  width: number; height: number; inset?: number;
}) {
  const position: [number, number, number] = bench && view === "three_quarter" ? [4, 3.6, 4] : view === "front" ? [0, 1.65, 5.3]
    : view === "back" ? [0, 1.65, -5.3] : view === "side" ? [5.3, 1.65, 0] : [3.2, 1.85, 5.1];
  // Leave room for raised arms on narrow screens as well as the resting body.
  const fit = Math.max(overhead ? 1.23 : 1, 1.05 / (width / height), contentHeight / 2.75);
  const targetHeight = Math.max(1.38, contentHeight / 2);
  const target = new Vector3(0, targetHeight, 0), offset = new Vector3(position[0], position[1] - 1.38, position[2]).multiplyScalar(fit);
  const distance = camera instanceof PerspectiveCamera ? cameraDistanceForPoints(bounds, target, offset, camera.fov, width / height) : offset.length();
  camera.position.copy(target).add(offset.normalize().multiplyScalar(distance));
  camera.lookAt(target);
  if (!inset || !(camera instanceof PerspectiveCamera)) return;
  // Shrink the whole fitted view toward the top edge until its bottom meets the inset, keeping the aspect ratio.
  const scale = (height - inset) / height;
  camera.setViewOffset(width * scale, height * scale, -width * (1 - scale) / 2, 0, width, height);
}
