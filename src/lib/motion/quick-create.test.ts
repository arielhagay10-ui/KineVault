import { describe, expect, it } from "vitest";
import { blankWorkshopScene, identityTransform, type WorkshopScene } from "./workshop";
import { workshopSceneSchema } from "./scene-schema";
import { copyWorkshopPose, createQuickScene, generateMachineRepetition, matchWorkshopLoop, mirrorWorkshopPose, searchWorkshopEquipment, workshopEquipmentOptions, readEquipmentPreferences, equipmentPreferencesKey, workshopDemonstrationCaption } from "./quick-create";
import { incrementWorkshopNumber, parseWorkshopNumber } from "./workshop-number";

describe("quick workshop creation", () => {
  it.each(["lat-pulldown-machine", "smith-machine", "leg-press"] as const)("describes the %s movement rather than chest fly", slug => {
    const caption = workshopDemonstrationCaption({ slug }, 1600, 3200);
    expect(caption).not.toContain("Close both arms");
    expect(caption).toMatch(/bar|platform/);
    expect(workshopDemonstrationCaption({ slug }, 0, 3200)).toContain("Start:");
    expect(workshopDemonstrationCaption({ slug }, 3200, 3200)).toContain("Return slowly");
  });
  const options = [{ slug: "pec-deck", label: "Pec deck" }, { slug: "cable-row-machine", label: "Cable row" }, { slug: "dumbbell", label: "Dumbbell" }, { slug: "bench", label: "Adjustable bench" }];
  it.each([["chest fly", "pec-deck"], ["seated rowing", "cable-row-machine"], ["pec dek", "pec-deck"], ["dumbell", "dumbbell"], ["cabel row", "cable-row-machine"], ["dumbebll", "dumbbell"], ["incline seat", "bench"]])("finds synonym or typo %s", (query, slug) => {
    expect(searchWorkshopEquipment(options, query)[0]?.slug).toBe(slug);
  });
  it("returns no unrelated matches and excludes inactive items", () => {
    expect(searchWorkshopEquipment(options, "treadmill")).toEqual([]);
    expect(searchWorkshopEquipment([{ slug: "bench", label: "Bench", active: false }], "")).toEqual([]);
  });
  it("discovers all supported assets when the caller only has legacy equipment", () => {
    const discovered = workshopEquipmentOptions([{ slug: "single-cable", label: "Single cable", active: true }]);
    expect(discovered.map(item => item.slug)).toContain("pec-deck");
    expect(discovered.map(item => item.slug)).toContain("leg-press");
    expect(discovered.filter(item => item.slug === "cable-machine")).toHaveLength(1);
    expect(discovered).toHaveLength(11);
  });
  it.each(["pec-deck", "cable-row-machine", "lat-pulldown-machine", "leg-press", "smith-machine", "cable-machine", "single-cable", "dumbbell-pair", "barbell", "bench", "kettlebell", "squat-rack"])("creates a validated %s scene without choosing anatomy", slug => {
    const scene = createQuickScene(slug);
    expect(workshopSceneSchema.safeParse(scene).success).toBe(true);
    expect(scene.studio?.presentation?.highlight).toBe("none");
    expect(scene.studio?.objects.length).toBeGreaterThan(0);
  });
  it("rejects unsupported assets rather than silently loading another recipe", () => {
    expect(() => createQuickScene("treadmill")).toThrow(/equipment/i);
  });
  it.each([["cable-row-machine", 0, 1], ["smith-machine", 1, 0]])("starts a playable %s example", (slug, start, finish) => {
    const scene = createQuickScene(String(slug)), frames = scene.studio!.objects[0].frames;
    expect(frames?.[0].machinePosition).toBe(start);
    expect(frames?.find(frame => frame.timeMs === 1600)?.machinePosition).toBe(finish);
    expect(frames?.at(-1)?.machinePosition).toBe(start);
  });
  it("generates a loop preserving authored poses, transforms, highlights and unrelated objects", () => {
    const scene = createQuickScene("cable-row-machine");
    const machine = scene.studio!.objects[0];
    machine.rotationY = 32;
    machine.frames = [{ ...identityTransform, rotationY: 32, x: 1, timeMs: 0 }, { ...identityTransform, rotationY: 40, x: 2, timeMs: 800 }];
    scene.studio!.presentation!.highlight = "group:obliques";
    scene.keyframes[1].poses.torso = { x: 2, y: 30, z: 0 };
    const other = { ...identityTransform, id: "e83744aa-54b8-43d2-963f-5c52eb4e3ea7", slug: "bench" as const, name: "Bench", attachment: "none" as const, pulleyHeight: 1.5 };
    scene.studio!.objects.push(other);
    const before = structuredClone(scene);
    const result = generateMachineRepetition(scene, machine.id, 0.1, 0.9);
    const frames = result.studio!.objects[0].frames!;
    expect(frames[0].machinePosition).toBe(0.1);
    expect(frames.find(frame => frame.timeMs === result.durationMs / 2)?.machinePosition).toBe(0.9);
    expect(frames.at(-1)?.machinePosition).toBe(0.1);
    expect(frames.find(frame => frame.timeMs === 800)).toMatchObject({ x: 2, rotationY: 40 });
    expect(result.keyframes).toEqual(before.keyframes);
    expect(result.studio!.objects[1]).toEqual(other);
    expect(result.studio!.presentation).toEqual(before.studio!.presentation);
    expect(scene).toEqual(before);
    expect(workshopSceneSchema.safeParse(result).success).toBe(true);
  });
  it("rejects invalid machine travel and wrong selected object", () => {
    const scene = createQuickScene("pec-deck");
    expect(() => generateMachineRepetition(scene, scene.studio!.objects[0].id, NaN, 1)).toThrow();
    expect(() => generateMachineRepetition(scene, scene.studio!.objects[0].id, -0.1, 1)).toThrow();
    expect(() => generateMachineRepetition(scene, "missing", 0, 1)).toThrow();
  });
  it("keeps 24 authored placement frames instead of silently discarding them", () => {
    const scene = createQuickScene("pec-deck"), machine = scene.studio!.objects[0];
    machine.frames = Array.from({ length: 24 }, (_, index) => ({ ...identityTransform, timeMs: index * 100, x: index / 10 }));
    const before = structuredClone(scene);
    expect(() => generateMachineRepetition(scene, machine.id, 0, 1)).toThrow(/Advanced/);
    expect(scene).toEqual(before);
  });
});

describe("pose operations", () => {
  function scene(): WorkshopScene {
    const result = structuredClone(blankWorkshopScene);
    result.keyframes[0].poses = { "left-shoulder": { x: 35, y: 20, z: -70 }, "right-elbow": { x: 100, y: 5, z: 4 }, torso: { x: 10, y: 15, z: -8 }, "left-wrist": { x: -30, y: 20, z: -10 } };
    result.keyframes[1].poses = { "left-knee": { x: -35, y: 0, z: 0 } };
    result.annotations = [{ startMs: 0, endMs: 1000, label: "Deliberate pose", jointAction: null, note: null }];
    result.studio!.presentation = { highlight: "group:obliques", isolate: true, view: "front" };
    return result;
  }
  it("copies the chosen pose without changing times or other scene data", () => {
    const original = scene(), result = copyWorkshopPose(original, 0, 1);
    expect(result.keyframes[1]).toEqual({ timeMs: 1600, poses: original.keyframes[0].poses });
    expect(result.keyframes[2]).toEqual(original.keyframes[2]);
    expect(result.studio).toEqual(original.studio);
    result.keyframes[1].poses.torso!.x = 0;
    expect(original.keyframes[0].poses.torso!.x).toBe(10);
  });
  it("copies to all moments without changing annotations", () => {
    const original = scene(), result = copyWorkshopPose(original, 0, "all");
    expect(result.keyframes.map(frame => frame.timeMs)).toEqual([0, 1600, 3200]);
    expect(result.keyframes[2].poses).toEqual(original.keyframes[0].poses);
    expect(result.annotations).toEqual(original.annotations);
  });
  it("mirrors joint sides with anatomical wrist flexion and turn preserved", () => {
    const original = scene(), result = mirrorWorkshopPose(original, 0);
    expect(result.keyframes[0].poses).toEqual({ "right-shoulder": { x: 35, y: -20, z: 70 }, "left-elbow": { x: 100, y: -5, z: -4 }, torso: { x: 10, y: -15, z: 8 }, "right-wrist": { x: -30, y: 20, z: 10 } });
    expect(mirrorWorkshopPose(result, 0)).toEqual(original);
    expect(result.keyframes[1]).toEqual(original.keyframes[1]);
  });
  it("matches loop pose and animated equipment end while preserving intermediate moments", () => {
    const original = createQuickScene("pec-deck"), object = original.studio!.objects[0];
    object.frames = [{ ...identityTransform, timeMs: 0, machinePosition: 0.1 }, { ...identityTransform, x: 1, timeMs: 1600, machinePosition: 0.8 }, { ...identityTransform, x: 2, timeMs: 3200, machinePosition: 0.6 }];
    original.keyframes[0].poses.torso = { x: 10, y: 0, z: 0 };
    const result = matchWorkshopLoop(original);
    expect(result.keyframes.at(-1)?.poses).toEqual({ torso: { x: 10, y: 0, z: 0 } });
    expect(result.studio!.objects[0].frames?.at(-1)).toEqual({ ...identityTransform, timeMs: 3200, machinePosition: 0.1 });
    expect(result.studio!.objects[0].frames?.[1]).toEqual(object.frames[1]);
  });
  it("rejects unavailable pose indices", () => {
    expect(() => copyWorkshopPose(scene(), 3, 0)).toThrow();
    expect(() => mirrorWorkshopPose(scene(), -1)).toThrow();
  });
});

describe("account equipment preferences", () => {
  it("uses distinct account keys and accepts only known unique equipment", () => {
    expect(equipmentPreferencesKey("first")).not.toBe(equipmentPreferencesKey("second"));
    expect(readEquipmentPreferences('{"recent":["bench","bench","unknown"],"favorites":["pec-deck",4]}')).toEqual({ recent: ["bench"], favorites: ["pec-deck"] });
    expect(readEquipmentPreferences("bad json")).toEqual({ recent: [], favorites: [] });
  });
});

describe("temporary numeric input", () => {
  it.each(["", " ", "-", ".", "1..2", "Infinity", "2e5"])("does not commit incomplete or invalid %s", text => {
    expect(parseWorkshopNumber(text)).toBeNull();
  });
  it("accepts explicit zero, decimal text and localized digits within bounds", () => {
    expect(parseWorkshopNumber("0", 0, 1)).toBe(0);
    expect(parseWorkshopNumber("0,25", 0, 1)).toBe(0.25);
    expect(parseWorkshopNumber("٠٫٥", 0, 1)).toBe(0.5);
    expect(parseWorkshopNumber("-1", 0, 1)).toBeNull();
    expect(parseWorkshopNumber("2", 0, 1)).toBeNull();
  });
  it("increments without floating point noise and keeps controls in range", () => {
    expect(incrementWorkshopNumber(0.2, 0.1, 0, 1)).toBe(0.3);
    expect(incrementWorkshopNumber(0.95, 0.1, 0, 1)).toBe(1);
    expect(incrementWorkshopNumber(0.05, -0.1, 0, 1)).toBe(0);
  });
});
