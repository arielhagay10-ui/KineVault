import { expect, it } from "vitest";
import { Group, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { createStudioObject } from "./studio";
import { workshopSceneSchema } from "./scene-schema";
import { cableAttachmentSlugs, blankWorkshopScene, identityTransform } from "./workshop";
import { studioCableFrame } from "./studio-cable";
import { solveCablePose } from "./cable-pose";
import { applyStudioMachine } from "./studio-machines";
import { createQuickScene } from "./quick-create";

it("accepts each row attachment without releasing seated support, while rejecting another held object", () => {
  for (const kind of cableAttachmentSlugs) {
    const row = { ...createStudioObject("cable-row-machine", "00000000-0000-4000-8000-000000000001", 0), machineUse: true,
      cableAttachment: kind, attachment: ["d-handle", "cuff"].includes(kind) ? "left" as const : "both" as const };
    const scene = { ...blankWorkshopScene, studio: { body: identityTransform, objects: [row] } };
    expect(workshopSceneSchema.safeParse(scene).success, kind).toBe(true);
    const weight = { ...createStudioObject("dumbbell", "00000000-0000-4000-8000-000000000002", 1), attachment: "right" as const };
    expect(workshopSceneSchema.safeParse({ ...scene, studio: { ...scene.studio, objects: [row, weight] } }).success).toBe(false);
  }
});

it("replays a dragged two-hand cable grip without moving the tower or erasing leg and torso angles", () => {
  const rig = createAnatomyRig(new Group()), body = new Group(), tower = new Group(); body.add(rig.root);
  const cable = { ...createStudioObject("cable-machine", "cable", 0), cableAttachment: "straight-bar" as const, attachment: "both" as const };
  const pose = { torso: { x: 15, y: 0, z: 0 }, "left-hip": { x: 30, y: 0, z: 0 }, "left-knee": { x: -20, y: 0, z: 0 } };
  try {
    poseAnatomyRig(rig, pose, true);
    const before = studioCableFrame(rig, cable, tower, pose).center.clone();
    const targets = { left: rig.handBones.left.getWorldPosition(new Vector3()).add(new Vector3(0, .12, 0)), right: rig.handBones.right.getWorldPosition(new Vector3()).add(new Vector3(0, .12, 0)) };
    const result = solveCablePose(rig, pose, targets);
    const saved = { ...pose, ...result.poses };
    expect(saved.torso).toEqual(pose.torso); expect(saved["left-hip"]).toEqual(pose["left-hip"]); expect(saved["left-knee"]).toEqual(pose["left-knee"]);
    poseAnatomyRig(rig, saved, true);
    const after = studioCableFrame(rig, cable, tower, saved);
    expect(after.center.y - before.y).toBeGreaterThan(.06);
    expect(after.reachable).toBe(true); expect(tower.position.toArray()).toEqual([0, 0, 0]);
  } finally { rig.dispose(); }
});

it("keeps seated attachments consistent between the pose solver and the rendered cable", () => {
  const rig = createAnatomyRig(new Group()), tower = new Group();
  try {
    for (const kind of cableAttachmentSlugs) {
      const scene = createQuickScene("cable-row-machine"), row = scene.studio!.objects[0];
      Object.assign(row, { cableAttachment: kind, attachment: ["d-handle", "cuff"].includes(kind) ? "left" : "both" });
      tower.position.set(row.x, row.y, row.z); tower.rotation.set(row.rotationX * Math.PI / 180, row.rotationY * Math.PI / 180, row.rotationZ * Math.PI / 180); tower.scale.setScalar(row.scale);
      for (let step = 0; step <= 16; step++) {
        row.frames = undefined; row.machinePosition = .2 + .6 * Math.sin(step / 16 * Math.PI);
        poseAnatomyRig(rig, {}, true);
        const report = applyStudioMachine(rig, scene, step * 200);
        const frame = studioCableFrame(rig, row, tower, {});
        expect([...frame.center.toArray(), ...frame.connection.toArray()].every(Number.isFinite), `${kind} ${step}`).toBe(true);
        expect(report?.hands.every(hand => hand.contactError < .005), `${kind} ${step}`).toBe(true);
      }
    }
  } finally { rig.dispose(); }
});

it("routes a free row cable through its real pulley rather than a free tower's pulley", () => {
  const rig = createAnatomyRig(new Group()), tower = new Group();
  tower.position.set(2, .2, -1); tower.rotation.y = .4;
  try {
    poseAnatomyRig(rig, {}, true);
    const row = { ...createStudioObject("cable-row-machine", "row", 0), cableAttachment: "straight-bar" as const, attachment: "both" as const };
    const frame = studioCableFrame(rig, row, tower, {});
    expect(frame.pulley.distanceTo(tower.localToWorld(new Vector3(0, 1.23, 1.35)))).toBeLessThan(1e-6);
  } finally { rig.dispose(); }
});
