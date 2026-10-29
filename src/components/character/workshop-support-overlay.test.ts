import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Scene } from "three";
import { expect, it, vi } from "vitest";
import { constrainSupportToMesh, supportPickTargets } from "@/lib/motion/support-picking";
import { identityTransform, type StudioLayout, type StudioObject, type SupportContact } from "@/lib/motion/workshop";

vi.mock("@/lib/motion/studio", () => ({ sampleStudioObject: (item: StudioObject) => item }));

it("accepts numeric movement on the original solid face and rejects coordinates beyond its edge", () => {
  const root = new Scene(), group = new Group(); group.userData.workshopObjectId = "rack";
  const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial()); group.add(mesh); root.add(group); root.updateMatrixWorld(true);
  const object: StudioObject = { ...identityTransform, id: "rack", slug: "squat-rack", name: "Rack", attachment: "none", pulleyHeight: 1 };
  const studio: StudioLayout = { body: { ...identityTransform }, objects: [object] };
  const original: SupportContact = { region: "left-hand", objectId: "rack", surface: "body", point: { x: .5, y: 0, z: 0 }, normal: { x: 1, y: 0, z: 0 }, turn: 0 };
  expect(constrainSupportToMesh(root, studio, original, { ...original, point: { x: .5, y: .4, z: 0 } })?.point.y).toBeCloseTo(.4);
  expect(constrainSupportToMesh(root, studio, original, { ...original, point: { x: .5, y: .8, z: 0 } })).toBeUndefined();
  expect(constrainSupportToMesh(root, studio, original, { ...original, point: { x: .5, y: 0, z: .8 } })).toBeUndefined();
  mesh.geometry.dispose(); mesh.material.dispose();
});

it("picks rigid chassis including cable towers, excluding articulated groups and held weights", () => {
  const root = new Scene();
  const objects: StudioObject[] = [];
  const add = (id: string, slug: StudioObject["slug"], name = "solid", visible = true) => {
    const object: StudioObject = { ...identityTransform, id, slug, name: id, attachment: "none", pulleyHeight: 1 };
    objects.push(object);
    const group = new Group(); group.userData.workshopObjectId = id; group.visible = visible;
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial()); mesh.name = name;
    group.add(mesh); root.add(group); return mesh;
  };
  const rack = add("rack", "squat-rack");
  const tower = add("cable", "cable-machine");
  const handle = new Group(); handle.userData.workshopSupportExcluded = true; const handleMesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial()); handle.add(handleMesh); tower.parent!.add(handle);
  const loadedHandle = new Group(); loadedHandle.name = "Handles"; loadedHandle.add(new Mesh(new BoxGeometry(), new MeshBasicMaterial())); tower.parent!.add(loadedHandle);
  add("bench", "bench"); add("guide", "smith-machine", "cable-guide"); add("hidden", "leg-press", "solid", false);
  const held = add("held", "dumbbell"); objects.find(item => item.id === "held")!.attachment = "left";
  const freeWeight = add("free", "dumbbell");
  root.add(new Mesh(new BoxGeometry(), new MeshBasicMaterial()));
  const studio: StudioLayout = { body: { ...identityTransform }, objects };
  expect(supportPickTargets(root, studio).map(item => item.mesh)).toEqual([rack, tower, freeWeight]);
  expect(supportPickTargets(root, studio).some(item => item.mesh === held || item.mesh === handleMesh)).toBe(false);
  root.traverse(node => { if (node instanceof Mesh) { node.geometry.dispose(); (node.material as MeshBasicMaterial).dispose(); } });
});
