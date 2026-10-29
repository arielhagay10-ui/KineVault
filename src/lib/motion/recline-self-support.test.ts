import { readFileSync } from "node:fs";
import { Group, Quaternion, Vector3 } from "three";
import { expect, it } from "vitest";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { applyStudioSupports, supportContactPoint } from "./support-contacts";
import { supportSurfaceToWorld } from "./support-surfaces";
import { sampleWorkshopPose, type WorkshopScene } from "./workshop";

it.each(["chest", "thigh"])("keeps the non-working hand on the %s during a recline curl", surface => {
  const scene = JSON.parse(readFileSync("tests/fixtures/recline-self-support.json", "utf8")) as WorkshopScene;
  if (surface === "thigh") scene.studio!.supports = [{ region: "right-hand", objectId: null, surface: "self:right-hip", point: { x: -.036996601, y: -.124706628, z: .152835577 }, normal: { x: -.328995398, y: -.105216394, z: .938451671 }, turn: 0 }];
  const rig = createAnatomyRig(new Group()), body = new Group();
  const transform = scene.studio!.body;
  body.position.set(transform.x, transform.y, transform.z); body.scale.setScalar(transform.scale); body.add(rig.root);
  try {
    for (let i = 0; i <= 16; i++) {
      const time = scene.durationMs * i / 16, pose = sampleWorkshopPose(scene.keyframes, time);
      poseAnatomyRig(rig, pose);
      const reports = applyStudioSupports(rig, scene.studio, time, pose);
      const contact = scene.studio!.supports!.find(contact => contact.region === "right-hand")!;
      const target = supportSurfaceToWorld(contact, scene.studio!, time, rig)!;
      const elbow = rig.bones.torso.worldToLocal(rig.bones["right-elbow"].getWorldPosition(new Vector3()));
      if (surface === "chest") {
        expect(elbow.z, `elbow behind torso, sample ${i}: ${elbow.toArray()}`).toBeGreaterThan(.05);
        expect(elbow.x, `elbow crosses torso, sample ${i}`).toBeLessThan(-.25);
      }
      const shoulder = rig.bones["right-shoulder"].getWorldPosition(new Vector3());
      const scale = rig.root.getWorldScale(new Vector3()).x;
      const reach = (rig.bones["right-elbow"].position.length() + rig.handBones.right.position.length()) * scale;
      expect(supportContactPoint(rig, "right-hand", target.normal).distanceTo(target.point), `sample ${i}: target distance ${shoulder.distanceTo(target.point)}, arm ${reach}`).toBeLessThan(.005);
      expect(reports.find(report => report.region === "right-hand")!.reachable).toBe(true);
    }
  } finally { rig.dispose(); }
});

it("turns a self-supported palm when its contact orientation changes", () => {
  const scene = JSON.parse(readFileSync("tests/fixtures/recline-self-support.json", "utf8")) as WorkshopScene;
  const rig = createAnatomyRig(new Group());
  const pose = sampleWorkshopPose(scene.keyframes, 0);
  const headings: Vector3[] = [];
  try {
    for (const turn of [0, 1, 45]) {
      scene.studio!.supports!.find(contact => contact.region === "right-hand")!.turn = turn;
      poseAnatomyRig(rig, pose);
      applyStudioSupports(rig, scene.studio, 0, pose);
      const contact = scene.studio!.supports!.find(contact => contact.region === "right-hand")!;
      const frame = supportSurfaceToWorld(contact, scene.studio!, 0, rig)!;
      expect(supportContactPoint(rig, "right-hand", frame.normal).distanceTo(frame.point)).toBeLessThan(.005);
      headings.push(new Vector3(1, 0, 0).applyQuaternion(rig.handBones.right.getWorldQuaternion(new Quaternion())));
    }
    expect(headings[0].angleTo(headings[1])).toBeLessThan(.05);
    expect(headings[0].angleTo(headings[2])).toBeGreaterThan(.1);
  } finally { rig.dispose(); }
});
