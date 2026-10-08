import { Vector3 } from "three";
import type { StudioObject } from "./workshop";

export const rowPulleyPoint = { x: 0, y: 1.23, z: 1.35 };
export const rowHandleHeight = { min: 0.7, max: 1.85, standard: 1.23 };
export function rowCarriagePoint(object: StudioObject) {
  return new Vector3(0, object.machineHandleHeight ?? rowHandleHeight.standard, 0.88 - (object.machinePosition ?? .5) * .58);
}
