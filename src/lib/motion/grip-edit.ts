import { Vector3 } from "three";
import type { ScenePoint, StudioObject } from "./workshop";

export type GripSide = "left" | "right";

// Offsets are in the equipment/attachment's own axes and unscaled meters.
export function gripOffset(object: StudioObject, side: GripSide): Vector3 {
  const point = object.gripOffsets?.[side];
  return point ? new Vector3(point.x, point.y, point.z) : new Vector3();
}

export function setGripOffset(object: StudioObject, side: GripSide, point: ScenePoint | null): StudioObject {
  const gripOffsets = { ...object.gripOffsets };
  if (point) {
    if (![point.x, point.y, point.z].every(value => Number.isFinite(value) && Math.abs(value) <= 2)) return object;
    gripOffsets[side] = { ...point };
  } else delete gripOffsets[side];
  return { ...object, gripOffsets: Object.keys(gripOffsets).length ? gripOffsets : undefined };
}
