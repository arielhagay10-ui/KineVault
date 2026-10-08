import { Euler, Quaternion, Vector3, type Object3D } from "three";
import { identityTransform, jointLimits, type JointAngles, type JointSlug, type ScenePoint, type SceneTransform, type StudioObject, type WorkshopScene } from "./workshop";

export const studioAssetNames: Record<StudioObject["slug"], string> = {
  "cable-machine": "Cable machine", bench: "Adjustable bench", "squat-rack": "Squat rack", barbell: "Barbell", dumbbell: "Dumbbell", kettlebell: "Kettlebell",
  "lat-pulldown-machine": "Lat pulldown machine", "smith-machine": "Smith machine", "leg-press": "Leg press",
  "cable-row-machine": "Cable row", "pec-deck": "Pec deck",
};
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const maxPulleyHeight = 3.2;
export function studioAttachmentSlots(object: StudioObject): string[] {
  const sides = object.attachment === "both" ? ["left", "right"] : object.attachment === "none" ? [] : [object.attachment];
  const site = ["cable-machine", "cable-row-machine"].includes(object.slug) && object.cableAttachment === "cuff" ? object.cuffPosition ?? "wrist" : "hand";
  return sides.map(side => `${side}-${site}`);
}
const degrees = (radians: number) => Math.round(((radians * 180 / Math.PI + 180) % 360 + 360) % 360 - 180);

export function readSceneTransform(object: Object3D): SceneTransform {
  return {
    x: Math.round(clamp(object.position.x, -10, 10) * 100) / 100,
    y: Math.round(clamp(object.position.y, -3, 10) * 100) / 100,
    z: Math.round(clamp(object.position.z, -10, 10) * 100) / 100,
    rotationX: degrees(object.rotation.x), rotationY: degrees(object.rotation.y), rotationZ: degrees(object.rotation.z),
    scale: Math.round(clamp(object.scale.x, 0.5, 2) * 100) / 100,
  };
}

export function readJointAngles(slug: JointSlug, object: Object3D): JointAngles {
  const limits = jointLimits[slug];
  return {
    x: clamp(degrees(object.rotation.x) * (slug.endsWith("elbow") || slug.endsWith("knee") || slug.endsWith("ankle") ? -1 : 1), ...limits.x),
    y: clamp(degrees(object.rotation.y), ...limits.y),
    z: clamp(degrees(object.rotation.z) * (slug === "torso" ? 1 : -1), ...limits.z),
  };
}

export function createStudioObject(slug: StudioObject["slug"], id: string, index: number): StudioObject {
  return { ...identityTransform, id, slug, name: studioAssetNames[slug], x: 0.95 + index % 2 * 0.5, y: ["barbell", "dumbbell", "kettlebell"].includes(slug) ? 0.65 : 0, z: slug === "cable-machine" ? 1.2 : 0.3 - Math.floor(index / 2) * 0.5,
    attachment: "none", pulleyHeight: 1.5, rotationY: slug === "cable-machine" ? Math.atan2(-(0.95 + index % 2 * 0.5), -1.2) * 180 / Math.PI : 0 };
}

export function sampleStudioObject(object: StudioObject, timeMs: number): StudioObject {
  const frames = object.frames;
  if (!frames?.length) return object;
  const nextIndex = frames.findIndex(frame => frame.timeMs >= timeMs);
  if (nextIndex <= 0) {
    const frame = nextIndex < 0 ? frames[frames.length - 1] : frames[0];
    const transform = { ...identityTransform };
    for (const key of Object.keys(transform) as (keyof SceneTransform)[]) transform[key] = frame[key];
    return { ...object, ...transform, machinePosition: frame.machinePosition ?? object.machinePosition, ...(frame.machineHandleHeight !== undefined ? { machineHandleHeight: frame.machineHandleHeight } : {}) };
  }
  const before = frames[nextIndex - 1], after = frames[nextIndex];
  const blend = (timeMs - before.timeMs) / (after.timeMs - before.timeMs);
  const transform = { ...identityTransform };
  for (const key of Object.keys(transform) as (keyof SceneTransform)[]) {
    const difference = key.startsWith("rotation") ? ((after[key] - before[key] + 540) % 360) - 180 : after[key] - before[key];
    const value = before[key] + difference * blend;
    transform[key] = key.startsWith("rotation") ? ((value + 540) % 360) - 180 : value;
  }
  const machinePosition = before.machinePosition !== undefined || after.machinePosition !== undefined
    ? (before.machinePosition ?? object.machinePosition ?? 0.5) + ((after.machinePosition ?? object.machinePosition ?? 0.5) - (before.machinePosition ?? object.machinePosition ?? 0.5)) * blend : object.machinePosition;
  const height = before.machineHandleHeight !== undefined || after.machineHandleHeight !== undefined
    ? (before.machineHandleHeight ?? object.machineHandleHeight ?? 1.23) + ((after.machineHandleHeight ?? object.machineHandleHeight ?? 1.23) - (before.machineHandleHeight ?? object.machineHandleHeight ?? 1.23)) * blend : object.machineHandleHeight;
  return { ...object, ...transform, machinePosition, ...(height !== undefined ? { machineHandleHeight: height } : {}) };
}

export function updateStudioObjectTransform(object: StudioObject, value: SceneTransform, timeMs: number, animate: boolean): StudioObject {
  const next = { ...identityTransform };
  for (const key of Object.keys(next) as (keyof SceneTransform)[]) next[key] = value[key];
  if (!animate) return { ...object, ...next, frames: undefined };
  const first = { ...identityTransform };
  for (const key of Object.keys(first) as (keyof SceneTransform)[]) first[key] = object[key];
  const sampled = sampleStudioObject(object, timeMs), machinePosition = sampled.machinePosition;
  const frames = (object.frames ?? [{ ...first, timeMs: 0, machinePosition }]).filter(frame => frame.timeMs !== timeMs);
  const existing = object.frames?.find(frame => frame.timeMs === timeMs);
  const height = existing?.machineHandleHeight ?? sampled.machineHandleHeight;
  return { ...object, frames: [...frames, { ...next, timeMs, machinePosition: existing?.machinePosition ?? machinePosition, ...(height !== undefined ? { machineHandleHeight: height } : {}) }].sort((a, b) => a.timeMs - b.timeMs) };
}

export function setStudioObjectAnimated(object: StudioObject, animated: boolean, timeMs: number, times: number[]): StudioObject {
  const sampled = sampleStudioObject(object, timeMs);
  if (!animated) return { ...updateStudioObjectTransform(object, sampled, timeMs, false), machinePosition: sampled.machinePosition, ...(sampled.machineHandleHeight !== undefined ? { machineHandleHeight: sampled.machineHandleHeight } : {}) };
  if (object.frames?.length) return object;
  let next = object;
  for (const time of times) next = updateStudioObjectTransform(next, sampled, time, true);
  return next;
}

export function studioPointToWorld(point: ScenePoint, body: SceneTransform): Vector3 {
  return new Vector3(point.x, point.y, point.z).multiplyScalar(body.scale)
    .applyEuler(new Euler(body.rotationX * Math.PI / 180, body.rotationY * Math.PI / 180, body.rotationZ * Math.PI / 180))
    .add(new Vector3(body.x, body.y, body.z));
}

export function studioPointFromWorld(point: Vector3, body: SceneTransform): ScenePoint {
  const rotation = new Quaternion().setFromEuler(new Euler(body.rotationX * Math.PI / 180, body.rotationY * Math.PI / 180, body.rotationZ * Math.PI / 180));
  const local = point.clone().sub(new Vector3(body.x, body.y, body.z)).applyQuaternion(rotation.invert()).divideScalar(body.scale);
  return { x: local.x, y: local.y, z: local.z };
}

export function makeLegacyBarbellEditable(scene: WorkshopScene, id: string): WorkshopScene {
  if (scene.equipment?.slug !== "barbell" || (scene.studio?.objects.length ?? 0) >= 20) return scene;
  const asset = scene.equipment;
  return { ...scene, equipment: null, studio: { body: scene.studio?.body ?? { ...identityTransform }, objects: [...(scene.studio?.objects ?? []), {
    ...createStudioObject("barbell", id, 0), x: asset.x, y: asset.y + 0.62 * asset.scale, z: asset.z, scale: asset.scale,
  }] } };
}

export function heldEquipmentTransform(body: SceneTransform, object: StudioObject, attachment: StudioObject["attachment"]): SceneTransform {
  const rotation = new Quaternion().setFromEuler(new Euler(body.rotationX * Math.PI / 180, body.rotationY * Math.PI / 180, body.rotationZ * Math.PI / 180));
  const position = new Vector3(attachment === "both" ? 0 : attachment === "right" ? -0.45 : 0.45, 1.3, 0.4)
    .multiplyScalar(body.scale).applyQuaternion(rotation).add(new Vector3(body.x, body.y, body.z));
  return { x: position.x, y: position.y, z: position.z, rotationX: body.rotationX, rotationY: body.rotationY, rotationZ: body.rotationZ, scale: object.scale };
}
