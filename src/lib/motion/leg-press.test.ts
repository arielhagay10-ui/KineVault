import { readFile } from "node:fs/promises";
import { Box3, Group, Mesh, Quaternion, Triangle, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { expect, it } from "vitest";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { createEquipmentAssetInstance, disposeEquipmentAsset, equipmentAssets, updateEquipmentAsset } from "./equipment-assets";
import { legPress, legPressFootContact } from "./leg-press";
import { applyStudioMachine, machineDemoScene } from "./studio-machines";
import { jointLimits } from "./workshop";

it("keeps a normal leg press on the actual sled with fixed bones, legal joints and continuous travel", async () => {
  const definition = equipmentAssets["leg-press"], bytes = await readFile(`public${definition.url}`);
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  const asset = createEquipmentAssetInstance(gltf.scene, definition), rig = createAnatomyRig(new Group());
  const scene = machineDemoScene("leg-press", crypto.randomUUID()), object = scene.studio!.objects[0];
  object.frames = undefined;
  const rest = [rig.bones["left-knee"].position.clone(), rig.footBones.left.position.clone()];
  try {
    for (const scale of [.75, 1, 1.3]) {
      Object.assign(object, { scale, x: 1.2, z: -.5, rotationX: 7, rotationY: 35, rotationZ: -5 });
      asset.root.position.set(object.x, object.y, object.z);
      asset.root.rotation.set(object.rotationX * Math.PI / 180, object.rotationY * Math.PI / 180, object.rotationZ * Math.PI / 180);
      asset.root.scale.setScalar(scale);
      const previous = new Map<string, Quaternion>();
      for (let step = 0; step <= 128; step++) {
        object.machinePosition = step / 128;
        poseAnatomyRig(rig, {}, true); applyStudioMachine(rig, scene, 0);
        expect(rig.bones["left-knee"].position.distanceTo(rest[0])).toBe(0);
        expect(rig.footBones.left.position.distanceTo(rest[1])).toBe(0);
        for (const side of ["left", "right"] as const) {
          const contact = legPressFootContact(rig, object, side);
          expect(contact.distance).toBeLessThan(.001 * scale);
          expect(contact.alignment).toBeGreaterThan(.999999);
          for (const part of ["hip", "knee", "ankle"] as const) {
            const slug = `${side}-${part}` as const, bone = rig.bones[slug];
            for (const axis of ["x", "y", "z"] as const) {
              const angle = bone.rotation[axis] * 180 / Math.PI * (axis === "z" || axis === "x" && part !== "hip" ? -1 : 1);
              const [min, max] = jointLimits[slug][axis];
              expect(angle, `${slug}.${axis} at ${step}`).toBeGreaterThanOrEqual(min - 1e-6);
              expect(angle, `${slug}.${axis} at ${step}`).toBeLessThanOrEqual(max + 1e-6);
            }
            if (previous.has(slug)) expect(bone.quaternion.angleTo(previous.get(slug)!)).toBeLessThan(2 * Math.PI / 180);
            previous.set(slug, bone.quaternion.clone());
          }
        }
        if (step % 8) continue;
        updateEquipmentAsset(asset, object); asset.root.updateWorldMatrix(true, true);
        for (const side of ["left", "right"] as const) {
          const sole = rig.footBones[side].localToWorld(new Vector3(0, -.14, .065));
          let distance = Infinity;
          asset.groups.Handles.traverse(node => {
            if (!(node instanceof Mesh)) return;
            const { index, attributes: { position } } = node.geometry;
            for (let i = 0; i < (index?.count ?? position.count); i += 3) {
              const points = [0, 1, 2].map(offset => node.localToWorld(new Vector3().fromBufferAttribute(position, index ? index.getX(i + offset) : i + offset)));
              const triangle = new Triangle(...points as [Vector3, Vector3, Vector3]);
              if (triangle.getArea() < 1e-12) continue;
              distance = Math.min(distance, triangle.closestPointToPoint(sole, new Vector3()).distanceTo(sole));
            }
          });
          expect(distance, `actual ${side} sole at ${step}`).toBeLessThan(.001 * scale);
        }
      }
    }
  } finally { rig.dispose(); disposeEquipmentAsset(asset.root); disposeEquipmentAsset(gltf.scene); }
});

it("keeps the actual default torso skin in front of the exported back pad", async () => {
  const [equipmentBytes, anatomyBytes] = await Promise.all([
    readFile(`public${equipmentAssets["leg-press"].url}`), readFile("public/models/z-anatomy/model.glb"),
  ]);
  const loader = new GLTFLoader();
  const [equipment, anatomy] = await Promise.all([equipmentBytes, anatomyBytes].map(bytes => loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "")));
  const rig = createAnatomyRig(anatomy.scene), scene = machineDemoScene("leg-press", crypto.randomUUID());
  const center = new Vector3(...legPress.back.center), angle = legPress.back.degrees * Math.PI / 180;
  const normal = new Vector3(0, 0, 1).applyAxisAngle(new Vector3(1, 0, 0), angle), face = new Box3();
  try {
    equipment.scene.updateWorldMatrix(true, true);
    equipment.scene.getObjectByName("Static")!.traverse(node => {
      if (!(node instanceof Mesh)) return;
      const { index, attributes: { position } } = node.geometry;
      for (let i = 0; i < (index?.count ?? position.count); i += 3) {
        const points = [0, 1, 2].map(offset => node.localToWorld(new Vector3().fromBufferAttribute(position, index ? index.getX(i + offset) : i + offset)));
        const triangle = new Triangle(...points as [Vector3, Vector3, Vector3]);
        if (triangle.getArea() < .1 || triangle.getNormal(new Vector3()).dot(normal) < .9999) continue;
        const midpoint = triangle.getMidpoint(new Vector3()).sub(center).applyAxisAngle(new Vector3(1, 0, 0), -angle);
        if (Math.abs(midpoint.x) > .3 || Math.abs(midpoint.y) > .6 || midpoint.z < .03 || midpoint.z > .1) continue;
        for (const point of points) face.expandByPoint(point.sub(center).applyAxisAngle(new Vector3(1, 0, 0), -angle));
      }
    });
    expect(face.isEmpty()).toBe(false);
    expect(face.min.z).toBeCloseTo(legPress.back.size[2] / 2, 5);
    poseAnatomyRig(rig, {}, true); applyStudioMachine(rig, scene, 0);
    rig.root.updateMatrixWorld(true); rig.skeleton.update();
    const torsoIndex = rig.skeleton.bones.indexOf(rig.bones.torso);
    let covered = 0, minimumGap = Infinity;
    for (const mesh of rig.meshes) {
      if (!/pectoralis_major|trapezius|latissimus/.test(mesh.name)) continue;
      const positions = mesh.geometry.getAttribute("position"), indices = mesh.geometry.getAttribute("skinIndex"), weights = mesh.geometry.getAttribute("skinWeight");
      for (let i = 0; i < positions.count; i++) {
        let torsoWeight = 0;
        for (let slot = 0; slot < 4; slot++) if (indices.getComponent(i, slot) === torsoIndex) torsoWeight += weights.getComponent(i, slot);
        if (torsoWeight < .9) continue;
        const point = mesh.localToWorld(mesh.getVertexPosition(i, new Vector3())).sub(center).applyAxisAngle(new Vector3(1, 0, 0), -angle);
        if (point.x < face.min.x || point.x > face.max.x || point.y < face.min.y || point.y > face.max.y) continue;
        covered++; minimumGap = Math.min(minimumGap, point.z - face.max.z);
      }
    }
    expect(covered).toBeGreaterThan(1000);
    expect(minimumGap, "actual torso skin to actual pad front").toBeGreaterThan(.003);
  } finally { rig.dispose(); disposeEquipmentAsset(equipment.scene); }
});
