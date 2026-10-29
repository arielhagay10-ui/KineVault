import { BufferAttribute, BufferGeometry, Vector3, type Object3D } from "three";
import type { AnatomyRig } from "./anatomy";
import { sampleStudioObject, studioPointFromWorld, studioPointToWorld } from "./studio";
import type { BandAnchor, StudioLayout, StudioObject } from "./workshop";

export function defaultBand(): NonNullable<StudioObject["band"]> {
  return { start: { target: "fixed", point: { x: 0, y: .06, z: 0 } }, end: { target: "fixed", point: { x: .7, y: .06, z: 0 } }, length: .7 };
}

/** Anchors follow the solved pose; a band never drives or constrains a limb. */
export function resolveBandAnchor(anchor: BandAnchor, object: StudioObject, studio: StudioLayout, timeMs: number, rig?: AnatomyRig, result = new Vector3(), equipmentRoot?: Object3D): Vector3 {
  const { point, target } = anchor;
  const side = target.startsWith("left") ? "left" : "right";
  const bone = target.endsWith("hand") ? rig?.handBones[side] : target.endsWith("foot") ? rig?.footBones[side] : target === "pelvis" ? rig?.bones.pelvis : undefined;
  if (bone) return bone.localToWorld(result.set(point.x, point.y, point.z));
  if (target === "equipment" && equipmentRoot) return equipmentRoot.localToWorld(result.set(point.x, point.y, point.z));
  const equipment = target === "equipment" ? studio.objects.find(item => item.id === anchor.objectId) : object;
  return result.copy(studioPointToWorld(point, sampleStudioObject(equipment ?? object, timeMs)));
}

export function detachBandAnchors(studio: StudioLayout, removedId: string, timeMs: number, resolvedRemoved?: StudioObject): StudioLayout {
  return { ...studio, objects: studio.objects.map(object => {
    if (!object.band) return object;
    const band = { ...object.band };
    for (const end of ["start", "end"] as const) {
      if (band[end].objectId !== removedId) continue;
      const world = resolvedRemoved ? studioPointToWorld(band[end].point, resolvedRemoved) : resolveBandAnchor(band[end], object, studio, timeMs);
      band[end] = { target: "fixed", point: studioPointFromWorld(world, sampleStudioObject(object, timeMs)) };
    }
    return { ...object, band };
  }) };
}

const segments = 64;
export function createBandGeometry() {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array((segments + 1) * 4 * 3), 3));
  const indices: number[] = [];
  for (let i = 0; i < segments; i++) for (let j = 0; j < 4; j++) {
    const a = i * 4 + j, b = i * 4 + (j + 1) % 4, c = a + 4, d = b + 4;
    indices.push(a, b, c, b, d, c);
  }
  geometry.setIndex(indices);
  return geometry;
}

export function updateBandGeometry(geometry: BufferGeometry, start: Vector3, end: Vector3, length: number, down = new Vector3(0, -1, 0)) {
  const distance = start.distanceTo(end), axis = end.clone().sub(start);
  if (distance < 1e-6) axis.set(1, 0, 0); else axis.divideScalar(distance);
  const perpendicular = new Vector3().crossVectors(axis, Math.abs(axis.y) < .9 ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1)).normalize();
  const normal = new Vector3().crossVectors(axis, perpendicular).normalize();
  const point = new Vector3(), radial = new Vector3();
  const position = geometry.getAttribute("position");
  const radius = .055, sag = Math.max(0, length - distance) * .25;
  const width = .012 / Math.sqrt(Math.max(1, distance / Math.max(.2, length)));
  for (let i = 0; i <= segments; i++) {
    const section = Math.min(3, Math.floor(i / (segments / 4))), t = i / (segments / 4) - section;
    let along: number, across: number, drop = 0;
    if (section === 0 || section === 2) {
      along = distance * (section === 0 ? t : 1 - t); across = section === 0 ? radius : -radius;
      radial.copy(perpendicular).multiplyScalar(section === 0 ? 1 : -1);
      drop = sag * 4 * t * (1 - t);
    } else {
      const angle = section === 1 ? Math.PI / 2 - Math.PI * t : -Math.PI / 2 - Math.PI * t;
      along = (section === 1 ? distance : 0) + radius * Math.cos(angle); across = radius * Math.sin(angle);
      radial.copy(axis).multiplyScalar(Math.cos(angle)).addScaledVector(perpendicular, Math.sin(angle));
    }
    for (let corner = 0; corner < 4; corner++) {
      point.copy(start).addScaledVector(axis, along).addScaledVector(perpendicular, across)
        .addScaledVector(down, drop).addScaledVector(radial, (corner === 0 || corner === 3 ? -1 : 1) * width)
        .addScaledVector(normal, corner < 2 ? -.002 : .002);
      position.setXYZ(i * 4 + corner, point.x, point.y, point.z);
    }
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
}
