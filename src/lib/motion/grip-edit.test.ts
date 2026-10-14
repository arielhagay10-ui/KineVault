import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { Group, Quaternion, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { createStudioObject, sampleStudioObject, studioPointToWorld } from "./studio";
import { changeGripAttachment, reachStudioGrip, studioGripOffset, weightGripPoint } from "./studio-grip";
import { studioCableFrame } from "./studio-cable";
import { applyStudioMachine, machineDemoScene, machineHandlePoint } from "./studio-machines";
import { studioLayoutSchema } from "./scene-schema";
import { setCableAttachment } from "./studio-constraints";
import { setGripOffset } from "./grip-edit";
import { addWorkshopEquipment, createFreeCableSetup, freeWorkshopBody } from "./workshop-freedom";
import { blankWorkshopScene, cableAttachmentSlugs, identityTransform, studioAssetSlugs, type RigPose } from "./workshop";

const id = "00000000-0000-4000-8000-000000000001";
let model: Group;
beforeAll(async () => {
  const data = await readFile("public/models/z-anatomy/model.glb");
  model = (await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), "")).scene;
});

describe("custom equipment grip positions", () => {
  it("preserves chosen weight contacts when a machine or cable displaces the hands", () => {
    const bar = { ...createStudioObject("barbell", id, 0), attachment: "both" as const, gripOffsets: { left: { x: -.08, y: 0, z: 0 } } };
    const row = { ...createStudioObject("cable-row-machine", "00000000-0000-4000-8000-000000000002", 1), machineUse: false };
    const scene = { ...blankWorkshopScene, studio: { body: identityTransform, objects: [bar, row] } };
    for (const changed of [addWorkshopEquipment(scene, "smith-machine", "00000000-0000-4000-8000-000000000003"), freeWorkshopBody(scene, row.id), createFreeCableSetup(scene, row.id)]) {
      expect(weightGripPoint(changed.studio!.objects[0], "left").x).toBeCloseTo(.32);
      expect(changed.studio!.objects[0].attachment).toBe("none");
      expect(studioLayoutSchema.safeParse(changed.studio).success).toBe(true);
    }
  });
  it("keeps row attachment grip edits when converting to a free cable", () => {
    const row = { ...createStudioObject("cable-row-machine", id, 0), cableAttachment: "rope" as const, attachment: "left" as const, gripOffsets: { left: { x: .02, y: .01, z: 0 } } };
    const scene = { ...blankWorkshopScene, studio: { body: identityTransform, objects: [row] } };
    expect(createFreeCableSetup(scene, id).studio!.objects[0].gripOffsets).toEqual(row.gripOffsets);
  });
  it("keeps chosen shaft positions when switching between one and both hands", () => {
    for (const slug of ["barbell", "kettlebell"] as const) {
      const original = { ...createStudioObject(slug, id, 0), attachment: "left" as const, gripOffsets: { left: { x: .05, y: 0, z: 0 } } };
      const both = changeGripAttachment(original, "both");
      expect(weightGripPoint(both, "left").distanceTo(new Vector3(.05, .2, 0))).toBeLessThan(1e-6);
      expect(weightGripPoint(changeGripAttachment(both, "none"), "left").distanceTo(new Vector3(.05, .2, 0))).toBeLessThan(1e-6);
    }
    const extreme = { ...createStudioObject("barbell", id, 0), attachment: "both" as const, gripOffsets: { left: { x: 2, y: 0, z: 0 } } };
    expect(() => changeGripAttachment(extreme, "left")).toThrow(/grip/i);
  });
  it("resets one hand without deleting the other hand's edit", () => {
    const object = { ...createStudioObject("barbell", id, 0), attachment: "both" as const, gripOffsets: { left: { x: -.08, y: 0, z: 0 }, right: { x: .08, y: 0, z: 0 } } };
    const reset = setGripOffset(object, "left", null);
    expect(weightGripPoint(reset, "left").x).toBeCloseTo(.4);
    expect(weightGripPoint(reset, "right").x).toBeCloseTo(-.32);
    expect(object.gripOffsets.left.x).toBe(-.08);
    expect(setGripOffset(reset, "right", { x: Infinity, y: 0, z: 0 })).toBe(reset);
  });
  it("uses automatic points when changing to a differently shaped attachment", () => {
    const object = { ...createStudioObject("cable-machine", id, 0), cableAttachment: "lat-bar" as const, gripOffsets: { left: { x: -.1, y: 0, z: 0 } } };
    expect(setCableAttachment(object, "lat-bar").gripOffsets).toEqual(object.gripOffsets);
    expect(setCableAttachment(object, "d-handle").gripOffsets).toBeUndefined();
  });
  it("round-trips independent grip offsets on every equipment type", () => {
    for (const slug of studioAssetSlugs) {
      const object = { ...createStudioObject(slug, id, 0), gripOffsets: { left: { x: .02, y: -.01, z: .03 }, right: { x: -.04, y: 0, z: 0 } } };
      const layout = { body: identityTransform, objects: [object] };
      expect(studioLayoutSchema.safeParse(JSON.parse(JSON.stringify(layout))).success, slug).toBe(true);
      expect(studioLayoutSchema.parse(layout)).toEqual(layout);
    }
  });
  it("rejects malformed, unbounded, and unknown grip coordinates", () => {
    for (const gripOffsets of [null, [], { middle: { x: 0, y: 0, z: 0 } }, { left: { x: 2.01, y: 0, z: 0 } }, { left: { x: 0, y: NaN, z: 0 } }, { left: { x: 0, y: 0 } }, { left: { x: 0, y: 0, z: 0, extra: 1 } }]) {
      expect(studioLayoutSchema.safeParse({ body: identityTransform, objects: [{ ...createStudioObject("barbell", id, 0), gripOffsets }] }).success).toBe(false);
    }
  });
  for (const side of ["left", "right"] as const) it(`keeps a custom ${side} barbell grip attached over a rep`, () => {
    const rig = createAnatomyRig(model.clone(true)), bar = new Group();
    const object = { ...createStudioObject("barbell", id, 0), attachment: side, gripOffsets: { [side]: { x: side === "left" ? -.08 : .08, y: 0, z: 0 } } };
    try {
      for (let step = 0; step <= 16; step++) {
        poseAnatomyRig(rig, {}, side);
        bar.position.set(side === "left" ? .45 : -.45, 1.3 + .1 * Math.sin(step / 16 * Math.PI), .4);
        bar.rotation.z = .1 * Math.sin(step / 16 * Math.PI); bar.updateMatrixWorld(true);
        const target = bar.localToWorld(new Vector3(side === "left" ? -.08 : .08, .2, 0));
        expect(weightGripPoint(object, side).distanceTo(new Vector3(side === "left" ? -.08 : .08, .2, 0))).toBeLessThan(1e-6);
        expect(reachStudioGrip(rig, side, bar.localToWorld(weightGripPoint(object, side)), bar.getWorldQuaternion(new Quaternion()))).toBeLessThan(.005);
        expect(rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(target)).toBeLessThan(.005);
      }
    } finally { rig.dispose(); }
  });
  for (const kind of cableAttachmentSlugs.filter(kind => kind !== "cuff")) for (const side of ["left", "right"] as const) it(`keeps the edited ${side} contact on a moving ${kind}`, () => {
    const rig = createAnatomyRig(model.clone(true)), tower = new Group(); tower.rotation.y = .4; tower.scale.setScalar(.8);
    const object = { ...createStudioObject("cable-machine", id, 0), attachment: side, cableAttachment: kind, gripOffsets: { [side]: { x: .025, y: .01, z: -.005 } } };
    try {
      for (let step = 0; step <= 16; step++) {
        const pose: RigPose = { [`${side}-elbow`]: { x: 30 + 60 * Math.sin(step / 16 * Math.PI), y: 0, z: 0 }, [`${side}-wrist`]: { x: -90, y: 0, z: 0 } };
        poseAnatomyRig(rig, pose, side);
        const frame = studioCableFrame(rig, object, tower, pose);
        const sign = side === "left" ? 1 : -1;
        const defaultPoint = new Vector3(kind === "d-handle" ? 0 : sign * (kind === "lat-bar" ? .5 : kind === "v-bar" ? .13 : .24), kind === "angled-bar" ? -.24 * Math.tan(Math.PI / 9) : kind === "lat-bar" ? -.08 : kind === "v-bar" ? -.13 : 0, 0);
        const branch = frame.ropeGrips.find(grip => grip.side === side);
        const target = kind === "rope" ? new Vector3(.025, .01, -.005).multiplyScalar(frame.scale).applyQuaternion(branch!.rotation).add(branch!.point)
          : defaultPoint.add(new Vector3(.025, .01, -.005)).multiplyScalar(frame.scale).applyQuaternion(frame.rotation).add(frame.center);
        expect(rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(target), `sample ${step}`).toBeLessThan(.005);
      }
    } finally { rig.dispose(); }
  });
  for (const slug of ["smith-machine", "lat-pulldown-machine", "leg-press", "cable-row-machine", "pec-deck"] as const) it(`keeps edited ${slug} grips relative to the moving handles`, () => {
    const scene = machineDemoScene(slug, id);
    scene.studio!.objects[0] = { ...scene.studio!.objects[0], gripOffsets: { left: { x: -.08, y: 0, z: 0 }, right: { x: .08, y: 0, z: 0 } } };
    const rig = createAnatomyRig(model.clone(true));
    try {
      for (let step = 0; step <= 16; step++) {
        const time = scene.durationMs * step / 16;
        poseAnatomyRig(rig, {}, true); applyStudioMachine(rig, scene, time);
        const object = sampleStudioObject(scene.studio!.objects[0], time);
        for (const side of ["left", "right"] as const) {
          const automatic = machineHandlePoint(object, side);
          automatic.x += side === "left" ? -.08 : .08;
          const target = studioPointToWorld(automatic, object);
          const palm = ["smith-machine", "cable-row-machine", "pec-deck"].includes(slug) ? new Vector3(side === "left" ? .03 : -.03, -.11, .12) : studioGripOffset(side);
          expect(rig.handBones[side].localToWorld(palm).distanceTo(target), `${slug} ${side} sample ${step}`).toBeLessThan(.005);
        }
      }
    } finally { rig.dispose(); }
  });
  for (const side of ["left", "right"] as const) for (const cuffPosition of ["wrist", "upper-arm"] as const) it(`keeps an edited ${side} ${cuffPosition} cuff attached through a rep`, () => {
    const rig = createAnatomyRig(model.clone(true)), tower = new Group(); tower.scale.setScalar(.8); tower.rotation.y = .4;
    const object = { ...createStudioObject("cable-machine", id, 0), attachment: side, cableAttachment: "cuff" as const, cuffPosition, gripOffsets: { [side]: { x: .01, y: .02, z: 0 } } };
    try {
      for (let i = 0; i <= 16; i++) {
        const pose: RigPose = { [`${side}-elbow`]: { x: 30 + 60 * Math.sin(i / 16 * Math.PI), y: 0, z: 0 } };
        poseAnatomyRig(rig, pose, false);
        const frame = studioCableFrame(rig, object, tower, pose);
        const expected = cuffPosition === "wrist" ? rig.handBones[side].getWorldPosition(new Vector3())
          : rig.bones[`${side}-elbow`].getWorldPosition(new Vector3()).lerp(rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3()), .22);
        const contact = new Vector3(.01, .02, 0).multiplyScalar(.8).applyQuaternion(frame.rotation).add(frame.center);
        expect(contact.distanceTo(expected)).toBeLessThan(1e-6);
      }
    } finally { rig.dispose(); }
  });
});
