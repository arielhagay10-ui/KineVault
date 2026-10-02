import { Box3, Line, Mesh, Vector3, type Object3D } from "three";
import { cameraDistanceForPoints, studioCameraPoints } from "./studio-camera";
import { studioPointToWorld } from "./studio";
import { resolveStudioObject } from "./studio-constraints";
import { identityTransform, type ScenePresentation, type WorkshopScene } from "./workshop";

export type WorkshopCameraAction = "zoom-in" | "zoom-out" | "fit" | "reset" | "focus" | "opposite";
export type WorkshopCameraCommand = { id: number; action: WorkshopCameraAction };

export function workshopCameraView(scene: WorkshopScene, editing: boolean, choice: { sceneAngle: WorkshopScene["cameraAngle"]; view: ScenePresentation["view"] } | null) {
  return !editing && choice?.sceneAngle === scene.cameraAngle ? choice.view : scene.studio?.presentation?.view ?? scene.cameraAngle;
}

export function fitWorkshopCamera(scene: WorkshopScene, view: ScenePresentation["view"], aspect: number, fov: number) {
  const body = scene.studio?.body ?? identityTransform;
  const points = [-0.85, 0.85].flatMap(x => [0, 3.1].flatMap(y => [-0.7, 0.7].map(z => studioPointToWorld({ x, y, z }, body))));
  const objects = scene.studio?.objects.flatMap(object => {
    const times = new Set([0, ...(object.frames ?? []).map(frame => frame.timeMs), ...(object.shoulderAlignment ? scene.keyframes.map(frame => frame.timeMs) : [])]);
    return [...times].map(time => ({ ...resolveStudioObject(scene, object, time), frames: undefined }));
  }) ?? [];
  points.push(...studioCameraPoints(objects));
  // Include weights and supports that have no machine-specific bounds.
  for (const object of objects) {
    const height = object.slug === "bench" || object.slug === "squat-rack" ? 2.4 : 1.7;
    const back = object.slug === "bench" ? -1.5 : -0.85;
    for (const x of [-0.95, 0.95]) for (const y of [object.slug === "kettlebell" ? -0.3 : 0, height]) for (const z of [back, 0.85]) points.push(studioPointToWorld({ x, y, z }, object));
  }
  if (scene.equipment) {
    const asset = scene.equipment;
    points.push(new Vector3(asset.x - asset.scale, asset.y, asset.z - asset.scale), new Vector3(asset.x + 1.6 * asset.scale, asset.y + 2.8 * asset.scale, asset.z + asset.scale));
  }
  const target = new Box3().setFromPoints(points).getCenter(new Vector3());
  const offset = view === "front" ? new Vector3(0, 0.27, 5.3) : view === "back" ? new Vector3(0, 0.27, -5.3) : view === "side" ? new Vector3(5.3, 0.27, 0) : new Vector3(3.2, 0.47, 5.1);
  const distance = cameraDistanceForPoints(points, target, offset, fov, Math.max(0.1, aspect));
  return { position: target.clone().add(offset.normalize().multiplyScalar(distance)), target };
}

export function zoomCameraPosition(position: Vector3, target: Vector3, factor: number, min: number, max: number) {
  const offset = position.clone().sub(target);
  const distance = Math.max(min, Math.min(max, offset.length() * factor));
  if (!offset.lengthSq()) offset.set(0, 0, 1);
  return target.clone().add(offset.normalize().multiplyScalar(distance));
}

export function oppositeCameraPosition(position: Vector3, target: Vector3) {
  const offset = position.clone().sub(target);
  return target.clone().add(new Vector3(-offset.x, offset.y, -offset.z));
}

/** Clone first so fading cannot alter body materials or authored presentation. */
export function fadeWorkshopEquipment(root: Object3D) {
  const restore: (() => void)[] = [];
  root.traverse(object => {
    if (!(object instanceof Mesh || object instanceof Line)) return;
    const original = object.material;
    const originals = Array.isArray(original) ? original : [original];
    const faded = originals.map(material => {
      const clone = material.clone(); clone.transparent = true; clone.opacity *= 0.22; clone.depthWrite = false;
      return clone;
    });
    object.material = Array.isArray(original) ? faded : faded[0];
    restore.push(() => { object.material = original; faded.forEach(material => material.dispose()); });
  });
  return () => restore.forEach(reset => reset());
}
