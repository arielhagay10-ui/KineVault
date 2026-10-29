import { describe, expect, it } from "vitest";
import { changeBenchSupport, changeSupportContact, pickSupportContact, supportRegionForJoint } from "./support-edit";
import { blankWorkshopScene, type SupportContact } from "./workshop";
import { Group } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { createStudioObject } from "./studio";
import { supportContactPoint } from "./support-contacts";
import { supportSurfaceFromWorld } from "./support-surfaces";
import { resetWorkshopJoints } from "./workshop-pose";

const contact: SupportContact = { region: "left-hand", objectId: null, surface: "floor", point: { x: .3, y: 0, z: .2 }, normal: { x: 0, y: 1, z: 0 }, turn: 0 };

describe("editing surface supports", () => {
  it("explains an out-of-workspace support instead of exposing schema bounds", () => {
    expect(() => changeSupportContact(structuredClone(blankWorkshopScene), { ...contact, point: { x: -20, y: 0, z: 0 } }))
      .toThrow(/outside the workspace/i);
  });

  it("identifies an existing unreachable anchor that blocks chest bracing", () => {
    const scene = structuredClone(blankWorkshopScene), rig = createAnatomyRig(new Group());
    const bench = createStudioObject("bench", "76fc0c6a-3e4a-46a1-a79c-18818aeae62b", 0);
    scene.studio!.objects = [bench];
    scene.studio!.supports = [{ ...contact, region: "right-hand", point: { x: -5, y: 0, z: -7 } }];
    try {
      expect(() => pickSupportContact(scene, { region: "chest", objectId: bench.id, surface: "pad", point: { x: 0, y: .8, z: .054 }, normal: { x: 0, y: 0, z: 1 }, turn: 0 }, rig, 0))
        .toThrow(/Right hand/);
      expect(scene.studio!.supports).toHaveLength(1);
    } finally { rig.dispose(); }
  });
  it("repositions an anchor without adding timeline poses or changing other anchors", () => {
    const scene = structuredClone(blankWorkshopScene);
    scene.studio!.supports = [contact, { ...contact, region: "right-foot" }];
    const next = changeSupportContact(scene, { ...contact, point: { x: .4, y: 0, z: .2 } });
    expect(next.studio!.supports).toHaveLength(2);
    expect(next.studio!.supports![0].point.x).toBe(.4);
    expect(next.studio!.supports![1]).toEqual(scene.studio!.supports![1]);
    expect(next.keyframes).toBe(scene.keyframes);
    expect(scene.studio!.supports[0].point.x).toBe(.3);
  });

  it("rejects an anchor targeting absent equipment before committing an edit", () => {
    expect(() => changeSupportContact(structuredClone(blankWorkshopScene), { ...contact, objectId: "76fc0c6a-3e4a-46a1-a79c-18818aeae62b", surface: "body" })).toThrow();
  });

  it("keeps the authored contact turn when picking a replacement surface point", () => {
    const scene = structuredClone(blankWorkshopScene), rig = createAnatomyRig(new Group());
    try {
      poseAnatomyRig(rig, {});
      const point = supportContactPoint(rig, "left-hand");
      const rack = createStudioObject("squat-rack", "76fc0c6a-3e4a-46a1-a79c-18818aeae62b", 0);
      scene.studio!.objects = [rack];
      const previous = { ...supportSurfaceFromWorld("left-hand", rack, "body", point), turn: 180 };
      scene.studio!.supports = [previous];
      expect(pickSupportContact(scene, { ...previous, turn: 0 }, rig, 0).studio!.supports![0].turn).toBe(180);
      expect(changeSupportContact(scene, { ...previous, turn: 90 }).studio!.supports![0].turn).toBe(90);
    } finally { rig.dispose(); }
  });

  it("rejects a failed hand support so resetting and choosing chest support cannot revive it", () => {
    const scene = structuredClone(blankWorkshopScene), rig = createAnatomyRig(new Group());
    const bench = createStudioObject("bench", "76fc0c6a-3e4a-46a1-a79c-18818aeae62b", 0);
    scene.studio!.objects = [bench];
    const before = structuredClone(scene);
    try {
      expect(() => pickSupportContact(scene, { ...contact, point: { x: 5, y: 0, z: 0 } }, rig, 0)).toThrow(/beyond reach/);
      expect(scene).toEqual(before);
      const next = changeBenchSupport(resetWorkshopJoints(scene, 0, "selected", []), bench.id, "back", rig);
      expect(next.studio!.supports!.map(item => item.region)).toEqual(["chest"]);
      expect(() => pickSupportContact(next, { ...contact, point: { x: 5, y: 0, z: 0 } }, rig, next.durationMs / 2)).toThrow(/beyond reach/);
      expect(next.studio!.supports!.map(item => item.region)).toEqual(["chest"]);
    } finally { rig.dispose(); }
  });

  it("selects the hand or foot support when its endpoint joint is selected", () => {
    expect(supportRegionForJoint("left-wrist")).toBe("left-hand");
    expect(supportRegionForJoint("right-ankle")).toBe("right-foot");
    expect(supportRegionForJoint("left-knee")).toBe("left-knee");
    expect(supportRegionForJoint("torso")).toBe("chest");
  });

  it("changes bench posture without discarding independent limb supports", () => {
    const rig = createAnatomyRig(new Group()), scene = structuredClone(blankWorkshopScene);
    const bench = createStudioObject("bench", "76fc0c6a-3e4a-46a1-a79c-18818aeae62b", 0);
    scene.studio!.objects = [bench];
    scene.studio!.supports = [contact];
    try {
      const next = changeBenchSupport(scene, bench.id, "front", rig);
      expect(next.studio!.seating).toBeUndefined();
      expect(next.studio!.supports!.find(item => item.region === "left-hand")).toEqual(contact);
      expect(next.studio!.supports!.find(item => item.region === "pelvis")?.objectId).toBe(bench.id);
    } finally { rig.dispose(); }
  });
});
