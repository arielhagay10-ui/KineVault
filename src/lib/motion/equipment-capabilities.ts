import type { StudioObject, WorkshopScene } from "./workshop";
import { isStudioMachine } from "./studio-machines";

export function equipmentGripHands(object: StudioObject): ("left" | "right" | "both")[] {
  if (["dumbbell", "barbell", "kettlebell"].includes(object.slug)) return ["left", "right", "both"];
  if (isStudioMachine(object.slug) && object.slug !== "cable-row-machine") return ["left", "right", "both"];
  if (object.slug !== "cable-machine" && object.slug !== "cable-row-machine") return [];
  if (object.slug === "cable-row-machine" && !object.cableAttachment) return [];
  return ["d-handle", "cuff"].includes(object.cableAttachment ?? "d-handle") ? ["left", "right"] : ["left", "right", "both"];
}

export function normalizeEquipmentContacts(scene: WorkshopScene): WorkshopScene {
  if (!scene.studio) return scene;
  const objects = scene.studio.objects.map(normalizeSupportContact);
  return objects.some((object, index) => object !== scene.studio!.objects[index]) ? { ...scene, studio: { ...scene.studio, objects } } : scene;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSupportContact<T>(object: T): T {
  if (!isRecord(object) || object.slug !== "bench" && object.slug !== "squat-rack") return object;
  if (object.attachment === "none" && !("gripOffsets" in object) && !("elbowLocks" in object) && !("poseDriver" in object)) return object;
  const clean: T & Record<string, unknown> = { ...object, attachment: "none" };
  delete clean.gripOffsets;
  delete clean.elbowLocks;
  delete clean.poseDriver;
  return clean;
}

export function normalizeLegacyStudioLayout(value: unknown): unknown {
  if (!isRecord(value) || !Array.isArray(value.objects)) return value;
  const previous = value.objects;
  const objects = previous.map(normalizeSupportContact);
  return objects.some((object, index) => object !== previous[index]) ? { ...value, objects } : value;
}
