import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Matrix4, type MeshStandardMaterial, type Skeleton, SkinnedMesh } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export function prepareAnatomyBatch(meshes: SkinnedMesh[]) {
  if (!meshes.length) return null;
  const geometry = mergeGeometries(meshes.map(mesh => mesh.geometry));
  if (!geometry?.index) throw new Error("Anatomy geometry cannot be batched");
  let start = 0;
  const ranges = meshes.map(mesh => {
    const count = mesh.geometry.index!.count;
    const range = { start, count };
    start += count;
    return range;
  });
  return { geometry, ranges };
}

export function createAnatomyBatches(prepared: ReturnType<typeof prepareAnatomyBatch>, parts: SkinnedMesh[], skeleton: Skeleton, materials: MeshStandardMaterial[]) {
  if (!prepared) return { meshes: [] as SkinnedMesh[], update() {} };
  // CPU arrays are immutable and reusable. Each viewer owns its GPU attributes.
  const attributes = Object.entries(prepared.geometry.attributes).map(([name, attribute]) =>
    [name, new BufferAttribute(attribute.array, attribute.itemSize, attribute.normalized)] as const);
  const sourceIndices = prepared.geometry.index!.array;
  const meshes = materials.map(material => {
    const geometry = new BufferGeometry();
    for (const [name, attribute] of attributes) geometry.setAttribute(name, attribute);
    geometry.setIndex(new BufferAttribute(new Uint32Array(sourceIndices.length), 1).setUsage(DynamicDrawUsage));
    const mesh = new SkinnedMesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.bind(skeleton, new Matrix4());
    // Existing per-part meshes retain editor hit testing and contact queries.
    mesh.raycast = () => {};
    return mesh;
  });
  return { meshes, update() {
    for (const mesh of meshes) {
      const index = mesh.geometry.index!;
      const indices = index.array as Uint32Array;
      let count = 0;
      for (let part = 0; part < parts.length; part++) {
        if (!parts[part].visible || parts[part].material !== mesh.material) continue;
        const range = prepared.ranges[part];
        indices.set(sourceIndices.subarray(range.start, range.start + range.count), count);
        count += range.count;
      }
      mesh.visible = count > 0;
      mesh.geometry.setDrawRange(0, count);
      index.clearUpdateRanges();
      if (count) index.addUpdateRange(0, count);
      index.needsUpdate = true;
    }
  } };
}
