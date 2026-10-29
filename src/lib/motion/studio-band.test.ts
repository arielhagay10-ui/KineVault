import { describe, expect, it } from "vitest";
import { Group, Triangle, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { createStudioObject, studioPointToWorld } from "./studio";
import { createBandGeometry, defaultBand, detachBandAnchors, resolveBandAnchor, updateBandGeometry } from "./studio-band";
import { studioLayoutSchema } from "./scene-schema";
import { identityTransform } from "./workshop";

describe("resistance band anchors", () => {
  it("keeps coincident, vertical, slack and stretched loops finite within a fixed mesh budget", () => {
    const geometry = createBandGeometry();
    try {
      for (const end of [new Vector3(), new Vector3(0, 2, 0), new Vector3(.1, 0, 0), new Vector3(4, 0, 0)]) {
        updateBandGeometry(geometry, new Vector3(), end, 1);
        expect([...geometry.getAttribute("position").array].every(Number.isFinite)).toBe(true);
        expect([...geometry.getAttribute("normal").array].every(Number.isFinite)).toBe(true);
        expect(geometry.getAttribute("position").count).toBe(260);
        expect(geometry.index!.count / 3).toBe(512);
      }
    } finally { geometry.dispose(); }
  });
  it("faces the loop exterior outward and keeps rounded tips from folding", () => {
    const geometry = createBandGeometry();
    try {
      updateBandGeometry(geometry, new Vector3(), new Vector3(1, 0, 0), 1);
      const positions = geometry.getAttribute("position"), indices = geometry.index!;
      const vertices = [0, 1, 2].map(i => new Vector3().fromBufferAttribute(positions, indices.getX(8 * 24 + i)));
      expect(new Triangle(vertices[0], vertices[1], vertices[2]).getNormal(new Vector3()).y).toBeGreaterThan(.99);
      for (let i = 16; i < 32; i++) {
        const inner = new Vector3().fromBufferAttribute(positions, i * 4);
        expect(Math.hypot(inner.x - 1, inner.z)).toBeCloseTo(.043, 5);
      }
    } finally { geometry.dispose(); }
  });

  it("uses the actual equipment group after an arm-driven or clamped solve", () => {
    const band = createStudioObject("resistance-band", crypto.randomUUID(), 0);
    const weight = createStudioObject("dumbbell", crypto.randomUUID(), 1);
    const rendered = new Group(); rendered.position.set(3, 2, 1); rendered.rotation.y = Math.PI / 2;
    const anchor = { target: "equipment" as const, objectId: weight.id, point: { x: .1, y: .2, z: 0 } };
    const expected = rendered.localToWorld(new Vector3(.1, .2, 0));
    const point = resolveBandAnchor(anchor, band, { body: identityTransform, objects: [weight, band] }, 0, undefined, new Vector3(), rendered);
    expect(point.distanceTo(expected)).toBeLessThan(1e-6);
  });
  it("follows posed hands and feet without changing the pose", () => {
    const rig = createAnatomyRig(new Group());
    const band = createStudioObject("resistance-band", crypto.randomUUID(), 0);
    const studio = { body: identityTransform, objects: [band] };
    try {
      poseAnatomyRig(rig, { "left-shoulder": { x: 45, y: 0, z: 20 } }, true);
      const before = rig.handBones.left.quaternion.clone();
      const point = resolveBandAnchor({ target: "left-hand", point: { x: 0, y: 0, z: 0 } }, band, studio, 0, rig);
      expect(point.distanceTo(rig.handBones.left.getWorldPosition(new Vector3()))).toBeLessThan(1e-6);
      const foot = resolveBandAnchor({ target: "right-foot", point: { x: 0, y: 0, z: 0 } }, band, studio, 0, rig);
      expect(foot.distanceTo(rig.footBones.right.getWorldPosition(new Vector3()))).toBeLessThan(1e-6);
      expect(rig.handBones.left.quaternion.angleTo(before)).toBeLessThan(1e-6);
    } finally { rig.dispose(); }
  });

  it("follows equipment transforms and freezes a removed anchor at the current position", () => {
    const band = { ...createStudioObject("resistance-band", crypto.randomUUID(), 0), band: defaultBand() };
    const box = { ...createStudioObject("plyo-box", crypto.randomUUID(), 1), x: 2, rotationY: 90, scale: 1.5 };
    band.band.start = { target: "equipment", objectId: box.id, point: { x: 0, y: .5, z: 0 } };
    const studio = { body: identityTransform, objects: [band, box] };
    const expected = studioPointToWorld(band.band.start.point, box);
    expect(resolveBandAnchor(band.band.start, band, studio, 0).distanceTo(expected)).toBeLessThan(1e-6);
    const next = detachBandAnchors(studio, box.id, 0);
    const released = next.objects[0];
    expect(released.band!.start.target).toBe("fixed");
    expect(resolveBandAnchor(released.band!.start, released, next, 0).distanceTo(expected)).toBeLessThan(1e-6);
  });

  it("rejects dangling, self, band-to-band and malformed anchors", () => {
    const object = { ...createStudioObject("resistance-band", crypto.randomUUID(), 0), band: defaultBand() };
    expect(studioLayoutSchema.safeParse({ body: identityTransform, objects: [object] }).success).toBe(true);
    for (const start of [
      { ...object.band.start, target: "equipment", objectId: crypto.randomUUID() },
      { ...object.band.start, target: "equipment", objectId: object.id },
      { ...object.band.start, target: "left-hand", objectId: object.id },
      { ...object.band.start, point: { x: Infinity, y: 0, z: 0 } },
    ]) expect(studioLayoutSchema.safeParse({ body: identityTransform, objects: [{ ...object, band: { ...object.band, start } }] }).success).toBe(false);
  });
});
