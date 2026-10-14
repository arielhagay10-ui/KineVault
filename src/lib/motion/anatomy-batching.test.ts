import { readFile } from "node:fs/promises";
import { beforeAll, expect, it } from "vitest";
import { Group, SkinnedMesh, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createAnatomyRig, highlightAnatomyRig, poseAnatomyRig } from "./anatomy";
import { defaultScene, sampleWorkshopPose } from "./workshop";

let source: Group;
beforeAll(async () => {
  const bytes = await readFile("public/models/z-anatomy/model.glb");
  source = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "")).scene;
});

function visibleMeshes(root: Group) {
  const meshes: SkinnedMesh[] = [];
  root.traverseVisible(object => { if (object instanceof SkinnedMesh) meshes.push(object); });
  return meshes;
}

it("renders the complete atlas in at most three material draws without changing posed vertices", () => {
  const rig = createAnatomyRig(source);
  try {
    highlightAnatomyRig(rig, "group:triceps", false);
    const rendered = visibleMeshes(rig.root);
    expect(rendered.length).toBeLessThanOrEqual(3);
    const batch = rendered[0];
    expect(rendered.reduce((count, mesh) => count + mesh.geometry.drawRange.count, 0)).toBe(
      rig.meshes.reduce((count, mesh) => count + mesh.geometry.index!.count, 0),
    );
    for (let step = 0; step <= 16; step++) {
      poseAnatomyRig(rig, sampleWorkshopPose(defaultScene.keyframes, defaultScene.durationMs * step / 16), true);
      let offset = 0;
      for (const mesh of rig.meshes) {
        const count = mesh.geometry.getAttribute("position").count;
        for (const vertex of [0, Math.floor(count / 2), count - 1]) {
          const original = mesh.localToWorld(mesh.getVertexPosition(vertex, new Vector3()));
          const merged = batch.localToWorld(batch.getVertexPosition(offset + vertex, new Vector3()));
          expect(merged.distanceTo(original), `${mesh.name} ${step}/16`).toBeLessThan(0.00001);
        }
        offset += count;
      }
    }
  } finally { rig.dispose(); }
});

it("isolates one actual muscle and restores every triangle without leaking between viewers", () => {
  const rig = createAnatomyRig(source), other = createAnatomyRig(source);
  try {
    const selected = rig.meshes.find(mesh => mesh.name === "Long_head_of_triceps_brachiil")!;
    expect(highlightAnatomyRig(rig, `mesh:${selected.name}`, true)).toBe(1);
    const rendered = visibleMeshes(rig.root);
    expect(rendered).toHaveLength(1);
    expect(rendered[0].material).toBe(rig.materials.selected);
    expect(rendered[0].geometry.drawRange.count).toBe(selected.geometry.index!.count);
    poseAnatomyRig(rig, sampleWorkshopPose(defaultScene.keyframes, 1600), true);
    for (const triangleIndex of [0, Math.floor(selected.geometry.index!.count / 2), selected.geometry.index!.count - 1]) {
      const original = selected.localToWorld(selected.getVertexPosition(selected.geometry.index!.getX(triangleIndex), new Vector3()));
      const batch = rendered[0];
      const merged = batch.localToWorld(batch.getVertexPosition(batch.geometry.index!.getX(triangleIndex), new Vector3()));
      expect(merged.distanceTo(original)).toBeLessThan(0.00001);
    }
    highlightAnatomyRig(rig, "none", true);
    expect(visibleMeshes(rig.root)).toHaveLength(2);
    expect(visibleMeshes(other.root)).toHaveLength(2);
    const allTriangles = rig.meshes.reduce((sum, mesh) => sum + mesh.geometry.index!.count, 0);
    expect(visibleMeshes(rig.root).reduce((sum, mesh) => sum + mesh.geometry.drawRange.count, 0)).toBe(allTriangles);
  } finally { rig.dispose(); other.dispose(); }
});

it("releases each viewer's batch buffers once without disposing another viewer's attributes", () => {
  const first = createAnatomyRig(source), second = createAnatomyRig(source);
  first.retain(); second.retain();
  let firstDisposals = 0, secondDisposals = 0;
  for (const mesh of first.batches.meshes) mesh.geometry.addEventListener("dispose", () => firstDisposals++);
  for (const mesh of second.batches.meshes) mesh.geometry.addEventListener("dispose", () => secondDisposals++);
  const firstPositions = first.batches.meshes[0].geometry.getAttribute("position");
  const secondPositions = second.batches.meshes[0].geometry.getAttribute("position");
  expect(secondPositions).not.toBe(firstPositions);
  expect(secondPositions.array).toBe(firstPositions.array);
  first.dispose(); first.dispose();
  expect(firstDisposals).toBe(3);
  expect(secondDisposals).toBe(0);
  highlightAnatomyRig(second, "group:biceps", false);
  expect(visibleMeshes(second.root)).toHaveLength(3);
  second.dispose(); second.dispose();
  expect(secondDisposals).toBe(3);
  // Two complete atlas rigs can exceed Vitest's five-second default on CI.
}, 30_000);
