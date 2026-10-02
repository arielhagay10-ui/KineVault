import { Vector3 } from "three";
import type { StudioObject, WorkshopScene } from "./workshop";
import { generateMachineRepetition } from "./quick-create";
import { isStudioMachine, machineCarriagePoint, reversePecDeckSeatZ, rowHandleHeight, setMachineHandleHeight, setMachinePosition } from "./studio-machines";
import { clamp, sampleStudioObject } from "./studio";
export type StudioDragPlane = "view" | "floor";
export type MachineDragValues = { machinePosition: number; machineHandleHeight?: number };
export function studioDragDelta(delta: Vector3, right: Vector3, up: Vector3, forward: Vector3, plane: StudioDragPlane, sensitivity: number) {
  if (plane === "view") return delta.clone().multiplyScalar(sensitivity);
  const floorForward = forward.clone().setY(0);
  if (floorForward.lengthSq() < 1e-6) floorForward.copy(up).setY(0);
  return right.clone().setY(0).normalize().multiplyScalar(delta.dot(right)).addScaledVector(floorForward.normalize(), delta.dot(up)).multiplyScalar(sensitivity);
}
export function machineDragValues(object: StudioObject, point: Vector3, side: "left" | "right" = "left"): MachineDragValues {
  if (object.slug === "cable-row-machine") return { machinePosition: clamp((.88 - point.z) / .58, 0, 1), machineHandleHeight: clamp(point.y, rowHandleHeight.min, rowHandleHeight.max) };
  if (object.slug === "pec-deck") {
    const reverse = object.machineMode === "reverse", sign = (side === "left" ? 1 : -1) * (reverse ? -1 : 1);
    const angle = Math.atan2((point.x - sign * .289) * sign, (point.z - (reverse ? reversePecDeckSeatZ : 0)) * (reverse ? -1 : 1)) * 180 / Math.PI;
    return { machinePosition: clamp(reverse ? (angle + 9) / 89 : (80 - angle) / 89, 0, 1) };
  }
  if (isStudioMachine(object.slug)) {
    const start = machineCarriagePoint({ ...object, machinePosition: 0 }), direction = machineCarriagePoint({ ...object, machinePosition: 1 }).sub(start);
    return { machinePosition: clamp(point.clone().sub(start).dot(direction) / direction.lengthSq(), 0, 1) };
  }
  return { machinePosition: object.machinePosition ?? .5 };
}
export function moveMachineWithMouse(scene: WorkshopScene, id: string, timeMs: number, values: MachineDragValues, mode: "quick" | "advanced"): WorkshopScene {
  const object = scene.studio?.objects.find(item => item.id === id);
  if (!object || !isStudioMachine(object.slug) || !Number.isFinite(values.machinePosition) || (values.machineHandleHeight !== undefined && !Number.isFinite(values.machineHandleHeight))) return scene;
  const position = clamp(values.machinePosition, 0, 1);
  const height = object.slug === "cable-row-machine" && values.machineHandleHeight !== undefined ? clamp(values.machineHandleHeight, rowHandleHeight.min, rowHandleHeight.max) : undefined;
  if (mode === "quick" && object.machineUse) {
    const start = sampleStudioObject(object, 0), finish = sampleStudioObject(object, scene.durationMs / 2);
    const editingFinish = timeMs > scene.durationMs / 4 && timeMs < scene.durationMs * 3 / 4;
    return generateMachineRepetition(scene, id, editingFinish ? start.machinePosition ?? 0 : position, editingFinish ? position : finish.machinePosition ?? 1,
      height === undefined ? undefined : { start: editingFinish ? start.machineHandleHeight ?? rowHandleHeight.standard : height, finish: editingFinish ? height : finish.machineHandleHeight ?? rowHandleHeight.standard });
  }
  if ((object.frames?.length ?? 0) >= 24 && !object.frames?.some(frame => frame.timeMs === timeMs)) throw new Error("This machine already has 24 moments. Select an existing moment in Advanced before dragging.");
  let next = setMachinePosition(object, position, timeMs);
  if (height !== undefined) next = setMachineHandleHeight(next, height, timeMs);
  return { ...scene, studio: { ...scene.studio!, objects: scene.studio!.objects.map(item => item.id === id ? next : item) } };
}
