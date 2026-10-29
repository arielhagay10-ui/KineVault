import { Matrix3, Mesh, Object3D, Raycaster } from "three";
import type { Camera, Vector3 } from "three";
import { clampSupportPoint, supportSurfaceToWorld } from "./support-surfaces";
import type { AnatomyRig } from "./anatomy";
import { pickSelfSupport } from "./self-support";
import type { StudioLayout, StudioObject, SupportContact } from "./workshop";

/** Match the 44 px handle, independent of zoom or model scale. */
export function supportHandleContainsPoint(point: Vector3, camera: Camera, viewport: { left: number; top: number; width: number; height: number }, pointer: { clientX: number; clientY: number }) {
  const center = point.clone().project(camera);
  return center.z >= -1 && center.z <= 1
    && Math.abs(pointer.clientX - viewport.left - (center.x + 1) * viewport.width / 2) <= 22
    && Math.abs(pointer.clientY - viewport.top - (1 - center.y) * viewport.height / 2) <= 22;
}

/** Only solid equipment meshes participate; guides and cable lines never do. */
export function supportPickTargets(root: Object3D, studio: StudioLayout) {
  const items = new Map(studio.objects.filter(item => item.slug !== "bench" && item.slug !== "resistance-band"
    && !(item.attachment !== "none" && ["barbell", "dumbbell", "kettlebell"].includes(item.slug))).map(item => [item.id, item]));
  const targets: { mesh: Mesh; object: StudioObject }[] = [];
  root.traverse(node => {
    if (!(node instanceof Mesh) || !node.visible || /rope|guide|marker|decoration|^cable$/i.test(node.name)) return;
    let ancestor: Object3D | null = node;
    while (ancestor && !ancestor.userData.workshopObjectId) {
      // Loaded assets expose these articulated groups through the renderer contract.
      if (!ancestor.visible || ancestor.userData.workshopSupportExcluded || /^(Handles|Weights|Pulley|LeftArm|RightArm|LeftLever|RightLever)$/.test(ancestor.name)) return;
      ancestor = ancestor.parent;
    }
    if (ancestor && (!ancestor.visible || ancestor.userData.workshopSupportExcluded)) return;
    const object = items.get(ancestor?.userData.workshopObjectId);
    if (object) targets.push({ mesh: node, object });
  });
  return targets;
}

/** Numeric and keyboard edits must still land on the originally selected solid face. */
export function constrainSupportToMesh(root: Object3D, studio: StudioLayout, original: SupportContact, next: SupportContact, timeMs = 0, rig?: AnatomyRig): SupportContact | undefined {
  const self = original.surface.startsWith("self:") && next.surface.startsWith("self:");
  if (original.objectId !== next.objectId || original.region !== next.region || original.surface !== next.surface && !self) return;
  const candidate = { ...next, normal: original.surface.startsWith("self:") ? next.normal : original.normal, point: clampSupportPoint(original, next.point) };
  if (original.surface.startsWith("self:")) {
    if (!rig) return;
    const end = supportSurfaceToWorld(candidate, studio, timeMs, rig);
    if (!end) return;
    const ray = new Raycaster(end.point.clone().addScaledVector(end.normal, .025), end.normal.clone().negate(), 0, .05);
    const hit = pickSelfSupport(rig, ray, original.region);
    return hit?.contact.surface === next.surface && hit.point.distanceTo(end.point) < .005 ? { ...hit.contact, turn: next.turn } : undefined;
  }
  if (original.objectId === null || original.surface === "seat" || original.surface === "pad") return candidate;
  const start = supportSurfaceToWorld(original, studio, timeMs), end = supportSurfaceToWorld(candidate, studio, timeMs);
  if (!start || !end) return;
  root.updateWorldMatrix(true, true);
  const meshes = supportPickTargets(root, studio).filter(item => item.object.id === original.objectId).map(item => item.mesh);
  const ray = new Raycaster(), offset = .025;
  ray.near = 0; ray.far = offset * 2;
  ray.set(start.point.clone().addScaledVector(start.normal, offset), start.normal.clone().negate());
  const originalHit = ray.intersectObjects(meshes, false).find(hit => hit.point.distanceTo(start.point) < .001);
  if (!originalHit) return;
  ray.set(end.point.clone().addScaledVector(start.normal, offset), start.normal.clone().negate());
  const hit = ray.intersectObject(originalHit.object, false).find(hit => hit.point.distanceTo(end.point) < .001
    && hit.face && hit.face.normal.clone().applyNormalMatrix(new Matrix3().getNormalMatrix(hit.object.matrixWorld)).dot(start.normal) > .98);
  return hit ? candidate : undefined;
}


