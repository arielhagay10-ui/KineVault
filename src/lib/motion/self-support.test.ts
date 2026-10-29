import { expect, it } from "vitest";
import { studioLayoutSchema } from "./scene-schema";
import { identityTransform, type SupportContact } from "./workshop";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { applyStudioSupports, supportContactPoint } from "./support-contacts";
import { supportSurfaceToWorld } from "./support-surfaces";
import { pickSelfSupport } from "./self-support";

const contact: SupportContact = { region: "left-hand", objectId: null, surface: "self:left-hip", point: { x: 0, y: -.1, z: .15 }, normal: { x: 0, y: 0, z: 1 }, turn: 0 };

it("allows an arm to brace on the human without equipment", () => {
  expect(studioLayoutSchema.safeParse({ body: identityTransform, objects: [], supports: [contact] }).success).toBe(true);
});

it("keeps the palm on the moving thigh through 17 poses and a serialized reload", () => {
  const rig = createAnatomyRig(new Group());
  const studio = JSON.parse(JSON.stringify({ body: identityTransform, objects: [], supports: [contact] }));
  try {
    for (let i = 0; i <= 16; i++) {
      const pose = { "left-hip": { x: -i, y: 0, z: 0 } };
      poseAnatomyRig(rig, pose);
      const thighBefore = rig.bones["left-hip"].quaternion.clone();
      const report = applyStudioSupports(rig, studio, 0, pose)[0];
      const target = supportSurfaceToWorld(contact, studio, 0, rig)!;
      expect(report.reachable, `pose ${i}, error ${report.error}`).toBe(true);
      expect(supportContactPoint(rig, "left-hand", target.normal).distanceTo(target.point)).toBeLessThan(.005);
      expect(rig.bones["left-hip"].quaternion.equals(thighBefore)).toBe(true);
      if (i === 16) expect(target.point.distanceTo(new Vector3(0, 0, 0))).toBeGreaterThan(.2);
    }
  } finally { rig.dispose(); }
});

it("rejects self support on the supported chain and invalid body targets", () => {
  for (const invalid of [{ ...contact, region: "left-knee" }, { ...contact, surface: "self:left-shoulder" }, { ...contact, objectId: "96aa9eef-9476-44dc-88bd-9e512e840718" }]) {
    expect(studioLayoutSchema.safeParse({ body: identityTransform, objects: [], supports: [invalid] }).success).toBe(false);
  }
});

it("raycasts the hidden named anatomy parts and stores a body-local point", () => {
  const source = new Group();
  const geometry = new BoxGeometry(.2, .2, .2).translate(0, 2.1, .15);
  const material = new MeshBasicMaterial();
  source.add(new Mesh(geometry, material));
  const rig = createAnatomyRig(source);
  try {
    poseAnatomyRig(rig, {});
    const ray = new Raycaster(new Vector3(0, 2.1 * .85, 3), new Vector3(0, 0, -1));
    const hit = pickSelfSupport(rig, ray, "left-hand")!;
    expect(hit.contact.surface).toBe("self:torso");
    expect(hit.contact.objectId).toBeNull();
    expect(hit.point.z).toBeCloseTo(.25 * .85);
    const studio = { body: identityTransform, objects: [] };
    expect(supportSurfaceToWorld(hit.contact, studio, 0, rig)!.point.distanceTo(hit.point)).toBeLessThan(1e-6);
    poseAnatomyRig(rig, { torso: { x: 30, y: 0, z: 0 } });
    const moved = supportSurfaceToWorld(hit.contact, studio, 0, rig)!;
    expect(moved.point.distanceTo(hit.point)).toBeGreaterThan(.05);
    expect(pickSelfSupport(rig, ray, "left-knee")).toBeUndefined();
  } finally { rig.dispose(); geometry.dispose(); material.dispose(); }
});

it("solves the supporting leg before the braced hand regardless of contact order", () => {
  const rig = createAnatomyRig(new Group());
  const foot: SupportContact = { region: "left-foot", objectId: null, surface: "floor", point: { x: .35, y: 0, z: .2 }, normal: { x: 0, y: 1, z: 0 }, turn: 0 };
  const positions: Vector3[] = [];
  try {
    for (const supports of [[contact, foot], [foot, contact]]) {
      poseAnatomyRig(rig, {});
      rig.root.position.y = -.15;
      applyStudioSupports(rig, { body: identityTransform, objects: [], supports }, 0, {});
      positions.push(supportContactPoint(rig, "left-hand", new Vector3(0, 0, 1)));
    }
    expect(positions[0].distanceTo(positions[1])).toBeLessThan(1e-6);
  } finally { rig.dispose(); }
});

it("reports the final reach error when an external elbow and self hand share an arm", () => {
  const rig = createAnatomyRig(new Group());
  const rack = { ...identityTransform, id: "96aa9eef-9476-44dc-88bd-9e512e840718", slug: "squat-rack" as const, name: "Rack", attachment: "none" as const, pulleyHeight: 1 };
  const elbow: SupportContact = { region: "left-elbow", objectId: rack.id, surface: "body", point: { x: .35, y: 1.65, z: .15 }, normal: { x: 0, y: 1, z: 0 }, turn: 0 };
  const studio = { body: identityTransform, objects: [rack], supports: [elbow, contact] };
  try {
    poseAnatomyRig(rig, {});
    const reports = applyStudioSupports(rig, studio, 0, {});
    for (const support of studio.supports) {
      const frame = supportSurfaceToWorld(support, studio, 0, rig)!;
      const actual = supportContactPoint(rig, support.region, frame.normal).distanceTo(frame.point);
      expect(reports.find(report => report.region === support.region)!.error).toBeCloseTo(actual, 8);
    }
  } finally { rig.dispose(); }
});
