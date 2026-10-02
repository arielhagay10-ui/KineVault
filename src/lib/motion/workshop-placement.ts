import { Box3, type Object3D } from "three";
import type { StudioObject } from "./workshop";

export function isWorkshopPlacementLocked(object: StudioObject) {
  return !!object.machineUse && !!object.frames?.length;
}

export function needsPlacementAdvisory(object: StudioObject, supportIds: string[] = []) {
  return !object.machineUse && object.attachment === "none" && !supportIds.includes(object.id);
}

/** Bounding boxes can overlap through empty space. This asks for inspection,
 * rather than claiming a collision or treating deliberate contact as a defect. */
export function equipmentBoundsOverlap(equipment: Object3D, bodyBounds: Box3, margin = .015) {
  const bounds = new Box3().setFromObject(equipment, true);
  if (bounds.isEmpty() || bodyBounds.isEmpty()) return false;
  const overlap = bounds.intersect(bodyBounds).getSize(bodyBounds.min.clone());
  return overlap.x > margin && overlap.y > margin && overlap.z > margin;
}

const bodyCache = new WeakMap<Object3D, { snapshot: string; bounds: Box3 }>();
export function placementBodyBounds(body: Object3D, snapshot: string) {
  let cached = bodyCache.get(body);
  if (!cached || cached.snapshot !== snapshot) {
    cached = { snapshot, bounds: new Box3().setFromObject(body, true) };
    bodyCache.set(body, cached);
  }
  return cached.bounds;
}
