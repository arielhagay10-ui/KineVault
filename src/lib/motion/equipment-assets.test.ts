import { readFile } from "node:fs/promises";
import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, Triangle, Vector3, type Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { describe, expect, it, vi } from "vitest";
import { attachmentAssets, createEquipmentAssetInstance, disposeEquipmentAsset, equipmentAssets, equipmentAssetsSettled, updateCableAttachmentScale, updateEquipmentAsset } from "./equipment-assets";
import { createQuickScene } from "./quick-create";
import { machineCarriagePoint, machineHandlePoint } from "./studio-machines";

function source() {
  const root = new Group();
  for (const name of ["Static", "Weights", "Handles"]) {
    const group = new Group(); group.name = name;
    group.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial())); root.add(group);
  }
  return root;
}

function surfaceDistance(root: Object3D, point: Vector3) {
  let distance = Infinity;
  root.updateWorldMatrix(true, true);
  root.traverse(node => {
    if (!(node instanceof Mesh)) return;
    const { index, attributes: { position } } = node.geometry;
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
      const vertices = [0, 1, 2].map(offset => new Vector3().fromBufferAttribute(position, index ? index.getX(i + offset) : i + offset).applyMatrix4(node.matrixWorld));
      const triangle = new Triangle(vertices[0], vertices[1], vertices[2]);
      // Beveled exports can contain collapsed triangles with no visible area.
      if (triangle.getArea() < 1e-12) continue;
      const closest = triangle.closestPointToPoint(point, new Vector3());
      distance = Math.min(distance, closest.distanceTo(point));
    }
  });
  return distance;
}

describe("equipment assets", () => {
  it("keeps rigid cable grips full-sized when the solver has no cuff radius", () => {
    const group = new Group();
    group.add(new Mesh(new BoxGeometry(.68, .05, .05), new MeshStandardMaterial()));
    updateCableAttachmentScale(group, "cuff", .055);
    expect(group.scale.toArray()).toEqual([.055, .22, .055]);
    updateCableAttachmentScale(group, "straight-bar", 0);
    expect(new Box3().setFromObject(group).getSize(new Vector3()).x).toBeCloseTo(.68);
    expect(group.scale.toArray()).toEqual([1, 1, 1]);
    disposeEquipmentAsset(group);
  });
  it.each([
    ["bench", [[0, .2, .66], [0, .4, .625], [0, .59, .55]]],
    ["cable-row-machine", [[0, .25, -.5], [0, .45, -.5], [0, .52, -.22], [.35, .1, 1.6]]],
    ["pec-deck", [[0, .25, 0], [0, .45, 0], [0, 1.3, -.3], [.4, .1, -1.32]]],
    ["leg-press", [[0, .25, -.48], [0, .4, -.48], [0, .93, -1.05], [.64, .35, -.24]]],
    ["lat-pulldown-machine", [[0, .12, 0], [0, .15, .5]]],
    ["cable-machine", [[0, .12, 0]]],
  ] as const)("gives %s pads a connected load-bearing frame", async (slug, points) => {
    const definition = equipmentAssets[slug];
    const bytes = await readFile(`public${definition.url}`);
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    for (const point of points) {
      expect(surfaceDistance(gltf.scene.getObjectByName("Static")!, new Vector3(...point)), `${slug}: ${point}`).toBeLessThan(.065);
    }
    disposeEquipmentAsset(gltf.scene);
  });

  it("keeps the bench incline brace attached at both ends through 17 angles", async () => {
    const definition = equipmentAssets.bench;
    const bytes = await readFile(`public${definition.url}`);
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    const asset = createEquipmentAssetInstance(gltf.scene, definition);
    const brace = asset.root.getObjectByName("Brace");
    expect(brace).toBeDefined();
    const object = createQuickScene("bench").studio!.objects[0];
    for (let step = 0; step <= 16; step++) {
      updateEquipmentAsset(asset, { ...object, benchAngle: step / 16 * 85 });
      asset.root.updateMatrixWorld(true);
      const top = asset.groups.Back.localToWorld(new Vector3(0, -.08, -.92));
      expect(surfaceDistance(brace!, top)).toBeLessThan(.035);
      expect(surfaceDistance(brace!, new Vector3(0, .28, -.5))).toBeLessThan(.035);
    }
    disposeEquipmentAsset(asset.root); disposeEquipmentAsset(gltf.scene);
  });

  it("keeps media pending until every model and the studio lighting have settled", () => {
    const a = createQuickScene("lat-pulldown-machine").studio!.objects[0];
    const b = { ...a, id: "second" };
    expect(equipmentAssetsSettled([a, b], { [a.id]: true, "studio-lighting": true })).toBe(false);
    expect(equipmentAssetsSettled([a, b], { [a.id]: true, second: true, "studio-lighting": false })).toBe(false);
    expect(equipmentAssetsSettled([a, b], { [a.id]: true, second: true, "studio-lighting": true })).toBe(true);
    expect(equipmentAssetsSettled([], {})).toBe(true);
    const rope = { ...a, slug: "cable-machine" as const, cableAttachment: "rope" as const };
    expect(equipmentAssetsSettled([rope], { [rope.id]: true, "studio-lighting": true, [`attachment:${rope.id}:left`]: true })).toBe(false);
    expect(equipmentAssetsSettled([rope], { [rope.id]: true, "studio-lighting": true, [`attachment:${rope.id}:left`]: true, [`attachment:${rope.id}:right`]: true })).toBe(true);
  });
  it("rejects incomplete moving groups so the procedural fallback remains available", () => {
    const root = source(); root.remove(root.getObjectByName("Weights")!);
    expect(() => createEquipmentAssetInstance(root, equipmentAssets["lat-pulldown-machine"])).toThrow(/Weights/);
  });

  it("isolates transforms and GPU resources between independently disposed instances", () => {
    const root = source(), asset = equipmentAssets["lat-pulldown-machine"];
    const a = createEquipmentAssetInstance(root, asset), b = createEquipmentAssetInstance(root, asset);
    const meshA = a.root.getObjectByName("Static")!.children[0] as Mesh;
    const meshB = b.root.getObjectByName("Static")!.children[0] as Mesh;
    expect(meshA.geometry).not.toBe(meshB.geometry); expect(meshA.material).not.toBe(meshB.material);
    const disposed = vi.fn(); meshB.geometry.addEventListener("dispose", disposed);
    disposeEquipmentAsset(a.root); expect(disposed).not.toHaveBeenCalled();
    expect(b.root.getObjectByName("Handles")!.position.y).toBe(0);
    disposeEquipmentAsset(b.root); expect(disposed).toHaveBeenCalledOnce();
    disposeEquipmentAsset(root);
  });

  it.each(["supinated", "pronated"] as const)("keeps %s handles and stack aligned at 17 travel samples", grip => {
    const asset = createEquipmentAssetInstance(source(), equipmentAssets["lat-pulldown-machine"]);
    const object = { ...createQuickScene("lat-pulldown-machine").studio!.objects[0], machineGrip: grip };
    for (let step = 0; step <= 16; step++) {
      updateEquipmentAsset(asset, { ...object, machinePosition: step / 16 });
      expect(asset.groups.Handles.position.x).toBe(0);
      expect(asset.groups.Handles.position.y).toBeCloseTo(grip === "pronated" ? 2.53 - step / 16 * .93 : 2.58 - step / 16 * .98);
      expect(asset.groups.Handles.position.z).toBe(.22);
      expect(asset.groups.Weights.position.y).toBeCloseTo(step / 16 * .98);
      expect(asset.groups.Static.position.y).toBe(0);
    }
    disposeEquipmentAsset(asset.root);
  });

  it("loads the shipped Blender asset with affordable geometry and solver-aligned supports", async () => {
    const bytes = await readFile("public/models/equipment/lat-pulldown.v1.glb");
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    const asset = createEquipmentAssetInstance(gltf.scene, equipmentAssets["lat-pulldown-machine"]);
    let triangles = 0, draws = 0;
    asset.root.traverse(node => {
      if (!(node instanceof Mesh)) return;
      triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
      draws += Array.isArray(node.material) ? node.material.length : 1;
    });
    expect(bytes.byteLength).toBeLessThan(1_000_000);
    expect(triangles).toBeLessThan(20_000); expect(draws).toBeLessThanOrEqual(12);
    const bounds = new Box3().setFromObject(asset.groups.Static);
    expect(bounds.min.y).toBeCloseTo(0, 2); expect(bounds.max.y).toBeGreaterThan(2.8); expect(bounds.max.y).toBeLessThan(2.86);
    const handleBounds = new Box3().setFromObject(asset.groups.Handles);
    expect(handleBounds.containsPoint(new Vector3(.48, 0, 0))).toBe(true);
    expect(handleBounds.containsPoint(new Vector3(-.48, 0, 0))).toBe(true);
    disposeEquipmentAsset(asset.root); disposeEquipmentAsset(gltf.scene);
  });

  it.each([...Object.entries(equipmentAssets), ...Object.entries(attachmentAssets)])("parses shipped %s with exactly one of each declared moving group", async (_, definition) => {
    const bytes = await readFile(`public${definition.url}`);
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    const asset = createEquipmentAssetInstance(gltf.scene, definition);
    expect(bytes.byteLength).toBeLessThan(1_000_000);
    let draws = 0, triangles = 0;
    asset.root.traverse(node => {
      if (!(node instanceof Mesh)) return;
      draws += Array.isArray(node.material) ? node.material.length : 1;
      triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
    });
    expect(triangles).toBeLessThan(20_000);
    expect(draws).toBeLessThanOrEqual(definition === equipmentAssets.dumbbell ? 3 : 16);
    for (const name of definition.requiredGroups) expect(asset.groups[name]).toBeDefined();
    disposeEquipmentAsset(asset.root); disposeEquipmentAsset(gltf.scene);
  });

  it("keeps the complete equipment library below 3 MB without external textures", async () => {
    let total = 0;
    for (const definition of [...Object.values(equipmentAssets), ...Object.values(attachmentAssets)]) {
      const bytes = await readFile(`public${definition.url}`);
      total += bytes.byteLength;
      const jsonLength = bytes.readUInt32LE(12);
      const document = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
      expect(document.images ?? []).toEqual([]);
      expect(document.buffers.every((buffer: { uri?: string }) => !buffer.uri)).toBe(true);
    }
    expect(total).toBeLessThan(3_000_000);
  });

  it.each(["smith-machine", "leg-press", "cable-row-machine", "pec-deck"] as const)("moves %s GLB groups with the solver at 17 samples", async slug => {
    const definition = equipmentAssets[slug];
    const bytes = await readFile(`public${definition.url}`);
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    const asset = createEquipmentAssetInstance(gltf.scene, definition);
    const object = createQuickScene(slug).studio!.objects[0];
    for (let step = 0; step <= 16; step++) {
      const sampled = { ...object, machinePosition: step / 16 };
      updateEquipmentAsset(asset, sampled);
      if (slug === "pec-deck") {
        asset.root.updateMatrixWorld(true);
        expect(asset.groups.LeftArm.localToWorld(new Vector3(0, -1.07, .955)).distanceTo(machineHandlePoint(sampled, "left"))).toBeLessThan(1e-6);
        expect(asset.groups.RightArm.localToWorld(new Vector3(0, -1.07, .955)).distanceTo(machineHandlePoint(sampled, "right"))).toBeLessThan(1e-6);
      } else {
        expect(asset.groups.Handles.position.distanceTo(machineCarriagePoint(sampled))).toBeLessThan(1e-6);
        asset.root.updateMatrixWorld(true);
        for (const side of ["left", "right"] as const) {
          const grip = machineHandlePoint(sampled, side);
          const bounds = new Box3().setFromObject(asset.groups.Handles).expandByScalar(.05);
          if (slug === "leg-press") {
            const carriage = machineCarriagePoint(sampled);
            const foot = new Vector3(side === "left" ? .17 : -.17, carriage.y - .085, carriage.z - .085);
            expect(surfaceDistance(asset.groups.Handles, foot)).toBeLessThan(.005);
          } else expect(bounds.containsPoint(grip)).toBe(true);
        }
      }
    }
    disposeEquipmentAsset(asset.root); disposeEquipmentAsset(gltf.scene);
  });

  it.each(["regular", "reverse"] as const)("keeps %s pec pivots and grips on the actual arm surfaces at 17 samples", async mode => {
    const definition = equipmentAssets["pec-deck"];
    const bytes = await readFile(`public${definition.url}`);
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    const asset = createEquipmentAssetInstance(gltf.scene, definition);
    for (let step = 0; step <= 16; step++) {
      const object = { ...createQuickScene("pec-deck").studio!.objects[0], machineMode: mode, machinePosition: step / 16 };
      updateEquipmentAsset(asset, object);
      for (const [side, arm] of [["left", asset.groups.LeftArm], ["right", asset.groups.RightArm]] as const) {
        const pivotTop = arm.localToWorld(new Vector3(0, .16, 0));
        expect(surfaceDistance(arm, pivotTop)).toBeLessThan(.005);
        expect(arm.localToWorld(new Vector3(0, -1.07, .955)).distanceTo(machineHandlePoint(object, side))).toBeLessThan(1e-6);
      }
    }
    disposeEquipmentAsset(asset.root); disposeEquipmentAsset(gltf.scene);
  });

  it.each(["bench", "cable-machine"] as const)("updates %s moving support through 17 samples", async slug => {
    const definition = equipmentAssets[slug];
    const bytes = await readFile(`public${definition.url}`);
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    const asset = createEquipmentAssetInstance(gltf.scene, definition);
    const object = createQuickScene(slug).studio!.objects[0];
    for (let step = 0; step <= 16; step++) {
      const position = step / 16;
      updateEquipmentAsset(asset, { ...object, benchAngle: position * 85, pulleyHeight: .5 + position * 2.5 });
      if (slug === "bench") {
        expect(asset.groups.Back.position.distanceTo(new Vector3(0, .673, .253))).toBeLessThan(1e-6);
        expect(asset.groups.Back.rotation.x).toBeCloseTo(position * 85 * Math.PI / 180);
      } else expect(asset.groups.Pulley.position.y).toBeCloseTo(.5 + position * 2.5);
    }
    disposeEquipmentAsset(asset.root); disposeEquipmentAsset(gltf.scene);
  });
});
