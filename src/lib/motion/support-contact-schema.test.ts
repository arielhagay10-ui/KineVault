import { describe, expect, it } from "vitest";
import { studioLayoutSchema } from "./scene-schema";
import { identityTransform, supportRegions, type SupportContact, type StudioLayout } from "./workshop";

const benchId = "00000000-0000-4000-8000-000000000093";
const contact = (region: SupportContact["region"] = "left-hand"): SupportContact => ({ region, objectId: null, surface: "floor", point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 }, turn: 0 });
const layout = (): StudioLayout => ({ body: { ...identityTransform }, objects: [{ ...identityTransform, id: benchId, name: "Bench", slug: "bench", attachment: "none", pulleyHeight: 1.5 }], supports: [contact()] });
describe("support contact persistence", () => {
  it("accepts all regions and preserves their values", () => {
    const value = { ...layout(), supports: supportRegions.map(region => contact(region)) };
    expect(studioLayoutSchema.parse(value)).toEqual(value);
  });
  it("accepts bench part-local contacts and old layouts", () => {
    for (const surface of ["seat", "pad"]) expect(studioLayoutSchema.safeParse({ ...layout(), supports: [{ ...contact(), objectId: benchId, surface }] }).success).toBe(true);
    const old = layout(); delete old.supports;
    expect(studioLayoutSchema.safeParse(old).success).toBe(true);
  });
  it("rejects duplicate, malformed, and orphaned contacts", () => {
    const invalid = [
      [contact(), contact()], [{ ...contact(), region: "head" }], [{ ...contact(), objectId: benchId, surface: "floor" }],
      [{ ...contact(), objectId: "00000000-0000-4000-8000-000000000099", surface: "seat" }], [{ ...contact(), surface: "pad" }],
      [{ ...contact(), normal: { x: 0, y: 0, z: 0 } }], [{ ...contact(), point: { x: Infinity, y: 0, z: 0 } }],
      [{ ...contact(), turn: 181 }], [{ ...contact(), surprise: true }],
    ];
    for (const supports of invalid) expect(studioLayoutSchema.safeParse({ ...layout(), supports }).success).toBe(false);
  });
  it("rejects legacy seating with supports", () => {
    expect(studioLayoutSchema.safeParse({ ...layout(), seating: { benchId, facing: "front" } }).success).toBe(false);
  });
  it("rejects a supported held hand but permits an elbow supporting a held weight", () => {
    const weight = { ...identityTransform, id: "00000000-0000-4000-8000-000000000094", name: "Weight", slug: "dumbbell", attachment: "left", pulleyHeight: 1.5 };
    const value = { ...layout(), objects: [...layout().objects, weight] };
    expect(studioLayoutSchema.safeParse(value).success).toBe(false);
    expect(studioLayoutSchema.safeParse({ ...value, supports: [contact("left-elbow")] }).success).toBe(true);
    expect(studioLayoutSchema.safeParse({ ...value, supports: [contact("left-elbow")], objects: [value.objects[0], { ...weight, elbowLocks: { left: { x: 0, y: 1, z: 0 } } }] }).success).toBe(false);
  });
  it("rejects contacts owned by an active machine", () => {
    const machine = { ...identityTransform, id: "00000000-0000-4000-8000-000000000094", name: "Press", slug: "leg-press", attachment: "none", pulleyHeight: 1.5, machineUse: true };
    expect(studioLayoutSchema.safeParse({ ...layout(), objects: [machine], supports: [contact("left-foot")] }).success).toBe(false);
  });
  it("rejects a held support target while allowing a cable machine's rigid frame", () => {
    const weight = { ...identityTransform, id: benchId, name: "Weight", slug: "dumbbell", attachment: "right", pulleyHeight: 1.5 };
    const value = { ...layout(), objects: [weight], supports: [{ ...contact("left-elbow"), objectId: benchId, surface: "body" }] };
    expect(studioLayoutSchema.safeParse(value).success).toBe(false);
    expect(studioLayoutSchema.safeParse({ ...value, objects: [{ ...weight, attachment: "none" }] }).success).toBe(true);
    expect(studioLayoutSchema.safeParse({ ...value, objects: [{ ...weight, slug: "cable-machine" }] }).success).toBe(true);
  });
  it("matches wrist cuff endpoint ownership and leaves foot supports independent", () => {
    const cable = { ...identityTransform, id: benchId, name: "Cable", slug: "cable-machine", attachment: "left", pulleyHeight: 1.5, cableAttachment: "cuff" };
    for (const cuffPosition of [undefined, "wrist", "upper-arm"]) {
      const objects = [{ ...cable, ...(cuffPosition ? { cuffPosition } : {}) }];
      expect(studioLayoutSchema.safeParse({ ...layout(), objects, supports: [contact()] }).success).toBe(cuffPosition === "upper-arm");
      expect(studioLayoutSchema.safeParse({ ...layout(), objects, supports: [contact("left-foot")] }).success).toBe(true);
    }
  });
  it("requires the real floor plane and an upward floor normal", () => {
    for (const changes of [{ point: { x: 0, y: .01, z: 0 } }, { normal: { x: 0, y: -1, z: 0 } }, { normal: { x: 1, y: 0, z: 0 } }]) {
      expect(studioLayoutSchema.safeParse({ ...layout(), supports: [{ ...contact(), ...changes }] }).success).toBe(false);
    }
  });
  it("rejects competing forearm and held-hand drivers on the same side", () => {
    const weight = { ...identityTransform, id: benchId, name: "Weight", slug: "dumbbell", attachment: "left", pulleyHeight: 1.5 };
    expect(studioLayoutSchema.safeParse({ ...layout(), objects: [weight], supports: [contact("left-forearm")] }).success).toBe(false);
    expect(studioLayoutSchema.safeParse({ ...layout(), objects: [weight], supports: [contact("right-forearm")] }).success).toBe(true);
  });
});
