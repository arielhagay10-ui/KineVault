import { describe, expect, it } from "vitest";
import { workshopSceneSchema } from "./scene-schema";
import { equipmentGripHands, normalizeEquipmentContacts, normalizeLegacyStudioLayout } from "./equipment-capabilities";
import { blankWorkshopScene, identityTransform, type StudioObject, type WorkshopScene } from "./workshop";

function object(slug: StudioObject["slug"], extra: Partial<StudioObject> = {}): StudioObject {
  return { ...identityTransform, id: "00000000-0000-4000-8000-000000000001", name: slug, slug, attachment: "none", pulleyHeight: 1.5, ...extra };
}

function scene(item: StudioObject): WorkshopScene {
  return { ...blankWorkshopScene, studio: { body: { ...identityTransform }, objects: [item] } };
}

describe("equipment contact schema", () => {
  it.each(["arm", "weight", "left-arm", "right-arm"])("roundtrips a dumbbell %s pose driver", poseDriver => {
    const input = scene({ ...object("dumbbell"), poseDriver } as StudioObject);
    const result = workshopSceneSchema.safeParse(JSON.parse(JSON.stringify(input)));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.studio?.objects[0]).toEqual(input.studio?.objects[0]);
  });

  it.each(["bench", "squat-rack"] as const)("rejects a new %s hand attachment", slug => {
    expect(workshopSceneSchema.safeParse(scene(object(slug, { attachment: "left" }))).success).toBe(false);
  });

  it.each([null, "body", 1, {}, true])("rejects invalid pose driver %s", poseDriver => {
    expect(workshopSceneSchema.safeParse(scene({ ...object("dumbbell"), poseDriver } as StudioObject)).success).toBe(false);
  });

  it.each(["bench", "squat-rack", "cable-machine"] as const)("rejects a pose driver on %s", slug => {
    expect(workshopSceneSchema.safeParse(scene({ ...object(slug), poseDriver: "arm" } as StudioObject)).success).toBe(false);
  });
});

describe("equipment grip capabilities", () => {
  it.each(["bench", "squat-rack", "lat-pulldown-machine", "smith-machine", "leg-press", "pec-deck"] as const)("does not attach hands to %s", slug => {
    expect(equipmentGripHands(object(slug))).toEqual([]);
  });

  it("keeps dumbbells single handed and lets shared weights use both hands", () => {
    expect(equipmentGripHands(object("dumbbell"))).toEqual(["left", "right"]);
    expect(equipmentGripHands(object("barbell"))).toEqual(["left", "right", "both"]);
    expect(equipmentGripHands(object("kettlebell"))).toEqual(["left", "right", "both"]);
  });

  it.each(["cable-machine", "cable-row-machine"] as const)("uses the %s attachment's hand count", slug => {
    expect(equipmentGripHands(object(slug, { cableAttachment: "d-handle" }))).toEqual(["left", "right"]);
    expect(equipmentGripHands(object(slug, { cableAttachment: "cuff" }))).toEqual(["left", "right"]);
    for (const cableAttachment of ["rope", "straight-bar", "angled-bar", "lat-bar", "v-bar"] as const) {
      expect(equipmentGripHands(object(slug, { cableAttachment }))).toEqual(["left", "right", "both"]);
    }
  });

  it("requires an explicit cable row attachment but defaults a tower to one handle", () => {
    expect(equipmentGripHands(object("cable-row-machine"))).toEqual([]);
    expect(equipmentGripHands(object("cable-machine"))).toEqual(["left", "right"]);
  });
});

describe("legacy equipment normalization", () => {
  it.each(["bench", "squat-rack"] as const)("releases legacy %s contacts without moving the object or body", slug => {
    const support = object(slug, { attachment: "both", x: 2, y: 0.2, rotationY: 70, benchAngle: slug === "bench" ? 45 : undefined,
      gripOffsets: { left: { x: 0.1, y: 0, z: 0 } }, elbowLocks: { left: { x: 1, y: 1, z: 0 } }, poseDriver: "arm" });
    const weight = object("dumbbell", { id: "00000000-0000-4000-8000-000000000002", attachment: "left", poseDriver: "weight", gripOffsets: { left: { x: 0.1, y: 0, z: 0 } } });
    const input: WorkshopScene = { ...scene(support), studio: { body: { ...identityTransform, z: 3 }, objects: [support, weight],
      ...(slug === "bench" ? { seating: { benchId: support.id, facing: "supine" as const } } : {}) } };
    const normalized = normalizeEquipmentContacts(input);
    const clean = normalized.studio!.objects[0];
    expect(clean.attachment).toBe("none");
    expect(clean).not.toHaveProperty("gripOffsets");
    expect(clean).not.toHaveProperty("elbowLocks");
    expect(clean).not.toHaveProperty("poseDriver");
    expect([clean.x, clean.y, clean.rotationY, clean.benchAngle]).toEqual([2, 0.2, 70, support.benchAngle]);
    expect(normalized.studio!.seating).toEqual(input.studio!.seating);
    expect(normalized.studio!.body).toBe(input.studio!.body);
    expect(normalized.studio!.objects[1]).toBe(weight);
    expect(support.attachment).toBe("both");
    expect(workshopSceneSchema.safeParse(normalized).success).toBe(true);
    expect(normalizeEquipmentContacts(normalized)).toBe(normalized);
  });

  it("leaves unchanged scenes and scenes without a studio alone", () => {
    const input = scene(object("bench"));
    expect(normalizeEquipmentContacts(input)).toBe(input);
    const noStudio = { ...input, studio: undefined };
    expect(normalizeEquipmentContacts(noStudio)).toBe(noStudio);
  });

  it("normalizes legacy raw layouts before schema validation without hiding unrelated invalid data", () => {
    const input = { body: identityTransform, objects: [null, [], "bench", { slug: "bench", attachment: "both", gripOffsets: {}, elbowLocks: {}, poseDriver: "arm", extra: true }] };
    const output = normalizeLegacyStudioLayout(input) as typeof input;
    expect(output.objects).toEqual([null, [], "bench", { slug: "bench", attachment: "none", extra: true }]);
    expect(input.objects[3]).toHaveProperty("gripOffsets");
  });

  it.each([null, [], "bench", {}, { objects: null }, { objects: {} }])("preserves malformed layout %s for the schema to reject", input => {
    expect(normalizeLegacyStudioLayout(input)).toBe(input);
  });
});
