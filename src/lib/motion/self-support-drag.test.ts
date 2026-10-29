import { Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Raycaster, SphereGeometry, Vector3 } from "three";
import { expect, it } from "vitest";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { constrainSupportToMesh, supportHandleContainsPoint } from "./support-picking";
import { pickSelfSupport } from "./self-support";
import { identityTransform } from "./workshop";

it("drags along a curved skinned torso without projecting onto the old contact plane", () => {
  const source = new Group(), geometry = new SphereGeometry(.35, 32, 24).translate(0, 2.1, .15);
  const material = new MeshBasicMaterial(); source.add(new Mesh(geometry, material));
  const rig = createAnatomyRig(source), studio = { body: identityTransform, objects: [] };
  try {
    poseAnatomyRig(rig, {});
    const pick = (x: number) => pickSelfSupport(rig, new Raycaster(new Vector3(x, 2.1 * .85, 3), new Vector3(0, 0, -1)), "right-hand")!;
    const original = pick(0).contact, next = pick(.15).contact;
    expect(original.surface).toBe("self:torso");
    expect(next.surface).toBe(original.surface);
    expect(Math.abs(next.point.z - original.point.z)).toBeGreaterThan(.01);
    const moved = constrainSupportToMesh(rig.root, studio, original, { ...next, turn: 23 }, 0, rig)!;
    expect(moved).toBeDefined();
    expect(new Vector3(moved.point.x, moved.point.y, moved.point.z).distanceTo(new Vector3(next.point.x, next.point.y, next.point.z))).toBeLessThan(.001);
    expect(moved.turn).toBe(23);
    expect(constrainSupportToMesh(rig.root, studio, original, { ...next, point: { ...next.point, z: 2 } }, 0, rig)).toBeUndefined();
    expect(constrainSupportToMesh(rig.root, studio, original, { ...next, surface: "self:right-hip" }, 0, rig)).toBeUndefined();
  } finally { rig.dispose(); geometry.dispose(); material.dispose(); }
});

it("lets the visible support handle start a drag at every camera distance", () => {
  const viewport = { left: 10, top: 20, width: 1000, height: 600 };
  for (const distance of [2, 6, 20]) {
    const camera = new PerspectiveCamera(34, 1000 / 600, .1, 100);
    camera.position.z = distance; camera.updateMatrixWorld();
    expect(supportHandleContainsPoint(new Vector3(), camera, viewport, { clientX: 530, clientY: 340 })).toBe(true);
    expect(supportHandleContainsPoint(new Vector3(), camera, viewport, { clientX: 540, clientY: 320 })).toBe(false);
  }
});

it("slides between body sections while rejecting equipment and off-body points", () => {
  const source = new Group(), material = new MeshBasicMaterial();
  const chest = new SphereGeometry(.25, 24, 16).translate(0, 2.1, .15);
  const thigh = new SphereGeometry(.2, 24, 16).translate(-.25, 1.25, .15);
  source.add(new Mesh(chest, material), new Mesh(thigh, material));
  const rig = createAnatomyRig(source), studio = { body: identityTransform, objects: [] };
  try {
    poseAnatomyRig(rig, {});
    const original = pickSelfSupport(rig, new Raycaster(new Vector3(0, 2.1 * .85, 3), new Vector3(0, 0, -1)), "right-hand")!.contact;
    const next = pickSelfSupport(rig, new Raycaster(new Vector3(-.25 * .85, 1.25 * .85, 3), new Vector3(0, 0, -1)), "right-hand")!.contact;
    expect(original.surface).toBe("self:torso"); expect(next.surface).toBe("self:right-hip");
    expect(constrainSupportToMesh(rig.root, studio, original, next, 0, rig)?.surface).toBe(next.surface);
    expect(constrainSupportToMesh(rig.root, studio, original, { ...next, surface: "floor" }, 0, rig)).toBeUndefined();
  } finally { rig.dispose(); chest.dispose(); thigh.dispose(); material.dispose(); }
});
