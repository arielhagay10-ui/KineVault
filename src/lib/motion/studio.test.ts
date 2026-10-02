import { describe, expect, it } from "vitest";
import { Group } from "three";
import { correctEquipmentMotion } from "./equipment-motion";
import { workshopSceneSchema } from "./scene-schema";
import { createStudioObject, makeLegacyBarbellEditable, readJointAngles, readSceneTransform, sampleStudioObject, setStudioObjectAnimated, updateStudioObjectTransform } from "./studio";
import { defaultScene, identityTransform } from "./workshop";

describe("studio scene editing", () => {
  const object = createStudioObject("cable-machine", "00000000-0000-4000-8000-000000000001", 0);
  const scene = { ...defaultScene, studio: { body: identityTransform, objects: [object] } };

  it("preserves a complete editable layout through JSON validation", () => {
    const edited = { ...scene, studio: { body: { ...identityTransform, x: -2, rotationY: 90 }, objects: [{ ...object, attachment: "right", pulleyHeight: 2.3, rotationY: -45, scale: 1.5 }] } };
    expect(workshopSceneSchema.parse(JSON.parse(JSON.stringify(edited))).studio).toEqual(edited.studio);
    expect(workshopSceneSchema.parse(defaultScene).studio).toBeUndefined();
  });

  it("rejects duplicated IDs, excessive object counts, and invalid transforms", () => {
    const invalid = [
      { ...scene.studio, objects: [object, object] },
      { ...scene.studio, objects: Array.from({ length: 21 }, () => object) },
      { ...scene.studio, body: { ...identityTransform, scale: 0 } },
      { ...scene.studio, objects: [{ ...object, x: Infinity }] },
      { ...scene.studio, objects: [{ ...object, pulleyHeight: 10 }] },
    ];
    for (const studio of invalid) expect(workshopSceneSchema.safeParse({ ...scene, studio }).success).toBe(false);
  });

  it("converts the actual rig rotation to author angles and clamps joint limits", () => {
    const bone = new Group();
    bone.rotation.set(-Math.PI / 2, 0, Math.PI / 6);
    expect(readJointAngles("left-elbow", bone)).toEqual({ x: 90, y: 0, z: -30 });
    bone.rotation.set(0, 0, -Math.PI / 2);
    expect(readJointAngles("left-shoulder", bone).z).toBe(90);
    expect(readJointAngles("torso", bone).z).toBe(-30);
  });

  it("normalizes gizmo transforms into supported persisted coordinates", () => {
    const group = new Group();
    group.position.set(15, -8, 1.236); group.rotation.y = 3 * Math.PI; group.scale.setScalar(3);
    expect(readSceneTransform(group)).toEqual({ ...identityTransform, x: 10, y: -3, z: 1.24, rotationY: -180, scale: 2 });
  });

  it("does not rewrite a deliberate studio cable pose on loading", () => {
    const manual = { ...scene, equipment: { slug: "single-cable" as const, x: -1, y: 2, z: -1, scale: 1 } };
    expect(correctEquipmentMotion(manual)).toBe(manual);
  });

  it("turns a legacy barbell into a selectable object at the same handle position", () => {
    const scene = { ...defaultScene, equipment: { slug: "barbell" as const, x: 1, y: 0.5, z: -1, scale: 1 } };
    const result = makeLegacyBarbellEditable(scene, object.id);
    expect(result.equipment).toBeNull();
    const bar = result.studio!.objects[0];
    expect(bar.y + 0.2).toBeCloseTo(scene.equipment.y + 0.82);
    expect(bar.x).toBe(1); expect(bar.z).toBe(-1);
  });

  it("records equipment movement at a selected keyframe and interpolates the shortest rotation", () => {
    const bar = { ...createStudioObject("barbell", object.id, 0), rotationY: 170 };
    const changed = updateStudioObjectTransform(bar, { ...bar, y: 2, rotationY: -170 }, 1600, true);
    expect(sampleStudioObject(changed, 800).y).toBeCloseTo((bar.y + 2) / 2);
    expect(sampleStudioObject(changed, 800).rotationY).toBe(-180);
    expect(sampleStudioObject(changed, 3200).y).toBe(2);
    expect(workshopSceneSchema.safeParse({ ...defaultScene, studio: { body: identityTransform, objects: [changed] } }).success).toBe(true);
  });

  it("keeps static placement independent of the timeline and makes animation an explicit choice", () => {
    const bench = createStudioObject("bench", object.id, 0);
    const staticEdit = updateStudioObjectTransform(bench, { ...bench, x: -1 }, 1600, false);
    for (const time of [0, 800, 1600, 3200]) expect(sampleStudioObject(staticEdit, time).x).toBe(-1);
    const animated = setStudioObjectAnimated(staticEdit, true, 1600, [0, 1600, 3200]);
    const moved = updateStudioObjectTransform(animated, { ...animated, x: 2 }, 1600, true);
    expect(sampleStudioObject(moved, 0).x).toBe(-1);
    expect(sampleStudioObject(moved, 1600).x).toBe(2);
    expect(sampleStudioObject(moved, 3200).x).toBe(-1);
    const frozen = setStudioObjectAnimated(moved, false, 1600, [0, 1600, 3200]);
    expect(frozen.frames).toBeUndefined();
    expect(sampleStudioObject(frozen, 0).x).toBe(2);
  });

  it("preserves presentation, bench angle and elbow locks while rejecting unsupported settings", () => {
    const bench = { ...createStudioObject("bench", object.id, 0), benchAngle: 30 };
    const weight = { ...createStudioObject("dumbbell", "00000000-0000-4000-8000-000000000002", 1), attachment: "right" as const, elbowLocks: { right: { x: -0.3, y: 1.5, z: 0.2 } } };
    const studio = { body: identityTransform, objects: [bench, weight], presentation: { highlight: "group:biceps", isolate: true, view: "back" as const } };
    expect(workshopSceneSchema.parse(JSON.parse(JSON.stringify({ ...scene, studio }))).studio).toEqual(studio);
    const invalid = [
      { ...studio, objects: [{ ...bench, benchAngle: 90 }] },
      { ...studio, objects: [{ ...weight, benchAngle: 30 }] },
      { ...studio, objects: [{ ...weight, attachment: "left" }] },
      { ...studio, objects: [{ ...weight, elbowLocks: { right: { x: NaN, y: 0, z: 0 } } }] },
      { ...studio, presentation: { ...studio.presentation, isolate: "true" } },
    ];
    for (const layout of invalid) expect(workshopSceneSchema.safeParse({ ...scene, studio: layout }).success).toBe(false);
  });
});
