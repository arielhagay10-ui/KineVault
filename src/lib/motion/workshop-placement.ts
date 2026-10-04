import { Bone, Box3, Vector3, type Object3D } from "three";
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
  const bounds = new Box3().setFromObject(equipment);
  if (bounds.isEmpty() || bodyBounds.isEmpty()) return false;
  const overlap = bounds.intersect(bodyBounds).getSize(bodyBounds.min.clone());
  return overlap.x > margin && overlap.y > margin && overlap.z > margin;
}

const bodyCache = new WeakMap<Object3D, { snapshot: string; bounds: Box3 }>();
export function placementBodyBounds(body: Object3D, snapshot: string) {
  let cached = bodyCache.get(body);
  if (!cached || cached.snapshot !== snapshot) {
    const bounds = new Box3(), point = new Vector3(), scale = new Vector3();
    let boneCount = 0;
    body.updateWorldMatrix(true, true);
    body.traverse(object => {
      if (!(object instanceof Bone)) return;
      boneCount++;
      object.getWorldPosition(point); bounds.expandByPoint(point);
      // The head follows the torso; it has no selectable bone in this atlas.
      if (object.name === "torso") bounds.expandByPoint(object.localToWorld(point.set(0, 1.48, 0)));
    });
    if (boneCount) bounds.expandByScalar(.16 * body.getWorldScale(scale).length() / Math.sqrt(3));
    else bounds.setFromObject(body);
    cached = { snapshot, bounds };
    bodyCache.set(body, cached);
  }
  return cached.bounds;
}
