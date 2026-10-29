import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { createStudioObject } from "./studio";
import { clampSupportPoint, supportSurfaceFromWorld, supportSurfaceToWorld } from "./support-surfaces";
import { identityTransform, type SupportContact } from "./workshop";

describe("support surface frames", () => {
  it("keeps floor dragging inside the workspace", () => {
    const contact: SupportContact = { region: "chest", objectId: null, surface: "floor", point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 }, turn: 0 };
    expect(clampSupportPoint(contact, { x: -200, y: 30, z: 200 })).toEqual({ x: -10, y: 0, z: 10 });
  });
  it.each(["seat", "pad"])("round trips %s contacts on rotated scaled benches", surface => {
    const bench = { ...createStudioObject("bench", "bench", 0), x: 1, y: .3, z: -.8, rotationX: 15, rotationY: 40, rotationZ: 10, scale: 1.4, benchAngle: 65 };
    const contact: SupportContact = { region: "left-hand", objectId: bench.id, surface, point: { x: .1, y: .2, z: .054 }, normal: { x: 0, y: 0, z: 1 }, turn: 0 };
    const studio = { body: identityTransform, objects: [bench] }, frame = supportSurfaceToWorld(contact, studio)!;
    const back = supportSurfaceFromWorld("left-hand", bench, surface, frame.point, frame.normal);
    expect(new Vector3(back.point.x, back.point.y, back.point.z).distanceTo(new Vector3(.1, .2, .054))).toBeLessThan(1e-10);
    expect(frame.normal.length()).toBeCloseTo(1);
    expect(clampSupportPoint(contact, { x: 10, y: 20, z: 30 })).toEqual({ x: surface === "seat" ? .23 : .22, y: surface === "seat" ? .47 : 1.62, z: .054 });
    const moved = supportSurfaceToWorld(contact, { ...studio, objects: [{ ...bench, benchAngle: 10 }] })!;
    if (surface === "seat") expect(moved.point.distanceTo(frame.point)).toBe(0);
    if (surface === "pad") expect(moved.point.distanceTo(frame.point)).toBeGreaterThan(.1);
  });
  it("follows object animation without changing local contact coordinates", () => {
    const bench = createStudioObject("bench", "bench", 0);
    bench.frames = [{ ...identityTransform, timeMs: 0 }, { ...identityTransform, x: 1, timeMs: 1000 }];
    const contact: SupportContact = { region: "left-knee", objectId: bench.id, surface: "seat", point: { x: 0, y: .2, z: .054 }, normal: { x: 0, y: 0, z: 1 }, turn: 0 };
    const studio = { body: identityTransform, objects: [bench] };
    expect(supportSurfaceToWorld(contact, studio, 500)!.point.x - supportSurfaceToWorld(contact, studio, 0)!.point.x).toBeCloseTo(.5);
  });
});
