import { BufferGeometry, Float32BufferAttribute, type Vector3 } from "three";

export function createCableGeometry() {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(18), 3));
  geometry.setDrawRange(0, 0);
  return geometry;
}

export function updateCableGeometry(geometry: BufferGeometry, points: readonly Vector3[], count = points.length) {
  const position = geometry.getAttribute("position");
  if (count > position.count || count > points.length) throw new Error("Cable exceeds its allocated capacity");
  for (let index = 0; index < count; index++) {
    const point = points[index]; position.setXYZ(index, point.x, point.y, point.z);
  }
  position.needsUpdate = true;
  geometry.setDrawRange(0, count);
  geometry.computeBoundingSphere();
}
