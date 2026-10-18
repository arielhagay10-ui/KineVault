import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { simplifyAnatomyGlb } from "./anatomy-preview.mjs";

const parse = bytes => JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
const accessorBytes = (bytes, document, index) => {
  const accessor = document.accessors[index], view = document.bufferViews[accessor.bufferView];
  const start = 28 + bytes.readUInt32LE(12) + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const width = accessor.componentType === 5123 ? 2 : 4;
  return bytes.subarray(start, start + accessor.count * width * (accessor.type === "VEC3" ? 3 : 1));
};

test("economy atlas reduces transfer and vertices without dropping anatomy or contact geometry", async () => {
  const original = await readFile("public/models/z-anatomy/model.glb");
  const reduced = await simplifyAnatomyGlb(original);
  const source = parse(original), result = parse(reduced);
  assert.deepEqual(result.nodes, source.nodes);
  assert.deepEqual(result.asset, source.asset);
  assert.equal(result.meshes.length, source.meshes.length);
  assert.ok(reduced.length < original.length * .7, "economy transfer must be materially smaller");
  let originalVertices = 0, reducedVertices = 0, protectedMeshes = 0;
  for (let index = 0; index < source.meshes.length; index++) {
    const before = source.meshes[index].primitives[0], after = result.meshes[index].primitives[0];
    originalVertices += source.accessors[before.attributes.POSITION].count;
    reducedVertices += result.accessors[after.attributes.POSITION].count;
    assert.deepEqual(result.accessors[after.attributes.POSITION].min, source.accessors[before.attributes.POSITION].min);
    assert.deepEqual(result.accessors[after.attributes.POSITION].max, source.accessors[before.attributes.POSITION].max);
    const name = source.nodes.find(node => node.mesh === index)?.name ?? "";
    if (!/hand|finger|carpal|tars|foot|toe|calcane|talus|phalan/i.test(name)) continue;
    protectedMeshes++;
    for (const semantic of ["POSITION", "NORMAL"]) assert.deepEqual(
      accessorBytes(reduced, result, after.attributes[semantic]), accessorBytes(original, source, before.attributes[semantic]));
    assert.deepEqual(accessorBytes(reduced, result, after.indices), accessorBytes(original, source, before.indices));
  }
  assert.ok(protectedMeshes > 50);
  assert.ok(reducedVertices < originalVertices * .65, "rig preparation must process fewer vertices");
});
