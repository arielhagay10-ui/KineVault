import { Euler, Quaternion, Vector3 } from "three";
import { sampleStudioObject } from "./studio";
import type { AnatomyRig } from "./anatomy";
import { selfSupportFrame } from "./self-support";
import type { ScenePoint, StudioLayout, StudioObject, SupportContact, SupportRegion } from "./workshop";

const radians = Math.PI / 180;
const vector = (point: ScenePoint) => new Vector3(point.x, point.y, point.z);
const point = (value: Vector3): ScenePoint => ({ x: value.x, y: value.y, z: value.z });

/** Bench contact coordinates belong to the articulated pad, not the bench frame. */
export function supportSurfaceFrame(object: StudioObject, surface: string) {
  const rotation = new Quaternion().setFromEuler(new Euler(object.rotationX * radians, object.rotationY * radians, object.rotationZ * radians));
  const origin = new Vector3(object.x, object.y, object.z);
  if (object.slug === "bench" && (surface === "seat" || surface === "pad")) {
    origin.add((surface === "seat" ? new Vector3(0, .65, .78) : new Vector3(0, .673, .253)).multiplyScalar(object.scale).applyQuaternion(rotation));
    rotation.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), surface === "seat" ? -Math.PI / 2 : (object.benchAngle ?? 45) * radians - Math.PI / 2));
  }
  return { origin, rotation, scale: object.scale };
}

export function supportSurfaceToWorld(contact: SupportContact, studio: StudioLayout, timeMs = 0, rig?: AnatomyRig) {
  if (contact.surface.startsWith("self:")) return rig && selfSupportFrame(rig, contact);
  if (contact.objectId === null) return { point: vector(contact.point), normal: vector(contact.normal).normalize(), rotation: new Quaternion() };
  const item = studio.objects.find(item => item.id === contact.objectId);
  if (!item) return;
  const frame = supportSurfaceFrame(sampleStudioObject(item, timeMs), contact.surface);
  return { point: vector(contact.point).multiplyScalar(frame.scale).applyQuaternion(frame.rotation).add(frame.origin),
    normal: vector(contact.normal).applyQuaternion(frame.rotation).normalize(), rotation: frame.rotation };
}

export function supportSurfaceFromWorld(region: SupportRegion, object: StudioObject | null, surface: string, worldPoint: Vector3, worldNormal = new Vector3(0, 1, 0), turn = 0): SupportContact {
  if (!object) return { region, objectId: null, surface: "floor", point: { x: worldPoint.x, y: 0, z: worldPoint.z }, normal: { x: 0, y: 1, z: 0 }, turn };
  const frame = supportSurfaceFrame(object, surface), inverse = frame.rotation.clone().invert();
  return { region, objectId: object.id, surface, point: point(worldPoint.clone().sub(frame.origin).applyQuaternion(inverse).divideScalar(frame.scale)),
    normal: point(worldNormal.clone().applyQuaternion(inverse).normalize()), turn };
}

/** Keep a drag on its original pad; rigid mesh bounds are supplied by the picker. */
export function clampSupportPoint(contact: SupportContact, next: ScenePoint, bounds?: { min: ScenePoint; max: ScenePoint }): ScenePoint {
  if (contact.surface.startsWith("self:")) return { ...next };
  if (contact.surface === "floor") return { x: Math.max(-10, Math.min(10, next.x)), y: 0, z: Math.max(-10, Math.min(10, next.z)) };
  if (contact.surface === "seat" || contact.surface === "pad") {
    const width = contact.surface === "seat" ? .23 : .22, length = contact.surface === "seat" ? .47 : 1.62;
    return { x: Math.max(-width, Math.min(width, next.x)), y: Math.max(0, Math.min(length, next.y)), z: .054 };
  }
  const normal = vector(contact.normal).normalize(), local = vector(next);
  local.addScaledVector(normal, vector(contact.point).sub(local).dot(normal));
  if (bounds) local.clamp(vector(bounds.min), vector(bounds.max));
  return point(local);
}
