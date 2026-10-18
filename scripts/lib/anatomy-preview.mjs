import assert from "node:assert/strict";
import { MeshoptSimplifier } from "meshoptimizer";

/** Reproducible lower-detail derivative. Keep every named part and all contact geometry. */
export async function simplifyAnatomyGlb(source) {
  assert.equal(source.readUInt32LE(0), 0x46546c67);
  const jsonLength = source.readUInt32LE(12), binaryStart = 28 + jsonLength;
  const document = JSON.parse(source.subarray(20, 20 + jsonLength).toString());
  assert.ok(!document.extensionsUsed?.length, "Simplification requires the original atlas");
  const original = structuredClone(document), chunks = [];
  let offset = 0;
  const read = index => {
    const accessor = original.accessors[index], view = original.bufferViews[accessor.bufferView];
    const width = accessor.componentType === 5123 ? 2 : 4, size = accessor.type === "VEC3" ? 3 : 1;
    const start = binaryStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const buffer = source.buffer.slice(source.byteOffset + start, source.byteOffset + start + accessor.count * width * size);
    return accessor.componentType === 5126 ? new Float32Array(buffer)
      : accessor.componentType === 5123 ? new Uint16Array(buffer) : new Uint32Array(buffer);
  };
  const write = (index, values) => {
    const accessor = document.accessors[index], view = document.bufferViews[accessor.bufferView];
    const components = accessor.type === "VEC3" ? 3 : 1;
    accessor.count = values.length / components;
    accessor.min = Array(components).fill(Infinity); accessor.max = Array(components).fill(-Infinity);
    for (let i = 0; i < values.length; i++) {
      const axis = i % components;
      accessor.min[axis] = Math.min(accessor.min[axis], values[i]);
      accessor.max[axis] = Math.max(accessor.max[axis], values[i]);
    }
    const bytes = Buffer.from(values.buffer, values.byteOffset, values.byteLength);
    view.byteOffset = offset; view.byteLength = bytes.length;
    chunks.push(bytes); offset += bytes.length;
    const padding = (4 - offset % 4) % 4;
    chunks.push(Buffer.alloc(padding)); offset += padding;
  };
  await MeshoptSimplifier.ready;
  for (const [index, mesh] of document.meshes.entries()) {
    assert.equal(mesh.primitives.length, 1);
    const primitive = mesh.primitives[0];
    const positionIndex = primitive.attributes.POSITION, normalIndex = primitive.attributes.NORMAL;
    const positions = read(positionIndex), normals = read(normalIndex), sourceIndices = read(primitive.indices);
    const name = document.nodes.find(node => node.mesh === index)?.name ?? "";
    const { min, max } = original.accessors[positionIndex];
    const contact = /hand|finger|carpal|tars|foot|toe|calcane|talus|phalan/i.test(name)
      || max[1] < .35 || (Math.abs((min[0] + max[0]) / 2) > .4 && max[1] < 1.68 && min[1] > 1.13);
    if (contact) {
      write(positionIndex, positions); write(normalIndex, normals); write(primitive.indices, sourceIndices);
      continue;
    }
    // Lock extrema so rig pivots, bounds-based classification and silhouettes remain stable.
    const locks = new Uint8Array(positions.length / 3);
    for (let vertex = 0; vertex < locks.length; vertex++) for (let axis = 0; axis < 3; axis++) {
      const value = positions[vertex * 3 + axis];
      if (value === min[axis] || value === max[axis]) locks[vertex] = 1;
    }
    const [indices] = MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(sourceIndices), positions, 3,
      normals, 3, [.1, .1, .1], locks, Math.max(12, Math.floor(sourceIndices.length * .3 / 3) * 3), .01);
    const [used, usedCount] = MeshoptSimplifier.compactMesh(indices);
    const remap = new Uint32Array(locks.length).fill(0xffffffff); remap.set(used);
    let count = usedCount;
    // Some atlas extrema are unreferenced vertices. Preserve these too because
    // rig classification uses the complete position buffer rather than triangles.
    for (let vertex = 0; vertex < locks.length; vertex++) if (locks[vertex] && remap[vertex] === 0xffffffff) remap[vertex] = count++;
    const compact = values => {
      const result = new Float32Array(count * 3);
      for (let vertex = 0; vertex < remap.length; vertex++) if (remap[vertex] !== 0xffffffff) {
        result.set(values.subarray(vertex * 3, vertex * 3 + 3), remap[vertex] * 3);
      }
      return result;
    };
    write(positionIndex, compact(positions)); write(normalIndex, compact(normals));
    write(primitive.indices, sourceIndices instanceof Uint16Array ? new Uint16Array(indices) : indices);
  }
  document.buffers[0].byteLength = offset;
  let metadata = Buffer.from(JSON.stringify(document));
  metadata = Buffer.concat([metadata, Buffer.alloc((4 - metadata.length % 4) % 4, 32)]);
  const header = Buffer.alloc(20), binaryHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + metadata.length + offset, 8);
  header.writeUInt32LE(metadata.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  binaryHeader.writeUInt32LE(offset); binaryHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, metadata, binaryHeader, ...chunks]);
}
