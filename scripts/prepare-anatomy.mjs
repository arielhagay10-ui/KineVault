import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";

// The locked Drei installation includes meshoptimizer. No network or new install
// is needed. Preserve the original export and its existing licensing files.
const directory = "public/models/z-anatomy";
const source = await readFile(join(directory, "model.glb"));
assert.equal(source.readUInt32LE(0), 0x46546c67, "Expected a GLB source");
assert.equal(source.readUInt32LE(4), 2, "Expected GLB version 2");
const jsonLength = source.readUInt32LE(12);
const binaryOffset = 20 + jsonLength + 8;
const original = JSON.parse(source.subarray(20, 20 + jsonLength).toString());
assert.equal(original.buffers.length, 1, "Source must use one embedded binary buffer");
assert.ok(!original.extensionsUsed?.length, "Expected the uncompressed source export");
const document = structuredClone(original);
const accessors = new Map(original.accessors.map(accessor => [accessor.bufferView, accessor]));
const chunks = [];
let offset = 0;
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
for (const [index, view] of document.bufferViews.entries()) {
  const accessor = accessors.get(index);
  assert.ok(accessor, `Missing accessor for buffer view ${index}`);
  const stride = view.byteStride ?? (accessor.componentType === 5123 ? 2 : 4);
  const mode = view.target === 34963 ? "INDICES" : "ATTRIBUTES";
  const start = binaryOffset + (view.byteOffset ?? 0);
  const bytes = source.subarray(start, start + view.byteLength);
  const payloadLength = accessor.count * stride;
  assert.ok(bytes.length >= payloadLength && bytes.length - payloadLength < 4,
    "Unexpected interleaved source data");
  assert.ok(bytes.subarray(payloadLength).every(byte => byte === 0), "Nonzero alignment padding");
  // INDICES preserves index order; no quantization, remeshing, or node merging.
  const encoded = MeshoptEncoder.encodeGltfBuffer(bytes.subarray(0, payloadLength), accessor.count, stride, mode);
  const decoded = new Uint8Array(bytes.length);
  MeshoptDecoder.decodeGltfBuffer(decoded, accessor.count, stride, encoded, mode);
  assert.ok(Buffer.from(decoded).equals(bytes), `Lossy roundtrip at buffer view ${index}`);
  view.buffer = 1;
  view.byteLength = payloadLength;
  view.extensions = { EXT_meshopt_compression: {
    buffer: 0, byteOffset: offset, byteLength: encoded.length,
    byteStride: stride, count: accessor.count, mode,
  } };
  chunks.push(Buffer.from(encoded));
  offset += encoded.length;
  const padding = (4 - offset % 4) % 4;
  chunks.push(Buffer.alloc(padding));
  offset += padding;
}
document.buffers = [
  { byteLength: offset },
  { byteLength: original.buffers[0].byteLength, extensions: { EXT_meshopt_compression: { fallback: true } } },
];
document.extensionsUsed = ["EXT_meshopt_compression"];
document.extensionsRequired = ["EXT_meshopt_compression"];
assert.deepEqual(document.nodes, original.nodes);
assert.deepEqual(document.meshes, original.meshes);
assert.deepEqual(document.asset, original.asset);
let metadata = Buffer.from(JSON.stringify(document));
metadata = Buffer.concat([metadata, Buffer.alloc((4 - metadata.length % 4) % 4, 32)]);
const binary = Buffer.concat(chunks);
const header = Buffer.alloc(12), jsonHeader = Buffer.alloc(8), binaryHeader = Buffer.alloc(8);
header.writeUInt32LE(0x46546c67);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + metadata.length + binary.length, 8);
jsonHeader.writeUInt32LE(metadata.length);
jsonHeader.writeUInt32LE(0x4e4f534a, 4);
binaryHeader.writeUInt32LE(binary.length);
binaryHeader.writeUInt32LE(0x004e4942, 4);
const output = Buffer.concat([header, jsonHeader, metadata, binaryHeader, binary]);
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const fingerprint = digest(output);
const filename = `model.meshopt.${fingerprint.slice(0, 8)}.glb`;
const destination = join(directory, filename);
if (process.argv.includes("--check")) {
  assert.ok((await readFile(destination)).equals(output), "Prepared preview differs from its reproducible source");
} else {
  await writeFile(destination, output);
}
process.stdout.write(`${JSON.stringify({ filename, sourceSha256: digest(source), outputSha256: fingerprint,
  sourceBytes: source.length, outputBytes: output.length, meshCount: document.meshes.length,
  bufferViewsVerified: document.bufferViews.length, lossless: true })}\n`);
