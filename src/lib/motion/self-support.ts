import { Matrix3, Quaternion, Raycaster, Triangle, Vector3 } from "three";
import type { AnatomyRig } from "./anatomy";
import { selfSupportSurfaces, type SupportContact, type SupportRegion } from "./workshop";

export function selfSupportBone(rig: AnatomyRig, surface: string) {
  if (!selfSupportSurfaces.some(value => value === surface)) return;
  return rig.bones[surface.slice(5) as "pelvis" | "torso" | "left-hip" | "right-hip" | "left-knee" | "right-knee"];
}

export function selfSupportFrame(rig: AnatomyRig, contact: SupportContact) {
  const bone = selfSupportBone(rig, contact.surface);
  if (!bone) return;
  bone.updateWorldMatrix(true, false);
  return { point: bone.localToWorld(new Vector3(contact.point.x, contact.point.y, contact.point.z)),
    normal: new Vector3(contact.normal.x, contact.normal.y, contact.normal.z).transformDirection(bone.matrixWorld), rotation: bone.getWorldQuaternion(new Quaternion()) };
}

/** Pick the named CPU-skinned parts; the visible anatomy is batched. */
export function pickSelfSupport(rig: AnatomyRig, ray: Raycaster, region: SupportRegion) {
  if (!/-(hand|forearm|elbow)$/.test(region)) return;
  rig.root.updateWorldMatrix(true, true);
  for (const mesh of rig.meshes) { mesh.computeBoundingBox(); mesh.computeBoundingSphere(); }
  for (const hit of ray.intersectObjects(rig.meshes, false)) {
    if (!hit.face) continue;
    const mesh = hit.object as AnatomyRig["meshes"][number];
    const indices = mesh.geometry.getAttribute("skinIndex"), weights = mesh.geometry.getAttribute("skinWeight");
    const scores = new Map<number, number>();
    for (const vertex of [hit.face.a, hit.face.b, hit.face.c]) for (let slot = 0; slot < 4; slot++) {
      const index = indices.getComponent(vertex, slot);
      scores.set(index, (scores.get(index) ?? 0) + weights.getComponent(vertex, slot));
    }
    const index = [...scores].sort((a, b) => b[1] - a[1])[0]?.[0];
    const bone = mesh.skeleton.bones[index];
    const surface = `self:${bone?.name}`;
    // Skip the arm being placed, so it cannot hide the torso or thigh beneath it.
    if (!selfSupportSurfaces.some(value => value === surface)) continue;
    const triangle = new Triangle(...[hit.face.a, hit.face.b, hit.face.c].map(vertex => mesh.localToWorld(mesh.getVertexPosition(vertex, new Vector3()))) as [Vector3, Vector3, Vector3]);
    const normal = triangle.getNormal(new Vector3());
    if (normal.dot(ray.ray.direction) > 0) normal.negate();
    const local = bone.worldToLocal(hit.point.clone());
    const localNormal = normal.clone().applyNormalMatrix(new Matrix3().getNormalMatrix(bone.matrixWorld.clone().invert()));
    const contact: SupportContact = { region, objectId: null, surface, point: { x: local.x, y: local.y, z: local.z }, normal: { x: localNormal.x, y: localNormal.y, z: localNormal.z }, turn: 0 };
    return { contact, point: hit.point, mesh };
  }
}
