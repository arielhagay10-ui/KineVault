import { describe, expect, it } from "vitest";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { cpus, platform, arch } from "node:os";
import { Euler, Group, Quaternion, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { applyStudioSupports, bakeLegacySupportScene, bakeSupportRelease, evaluateSupportScene, previewSupportReposition, supportContactPoint, supportPoseFromRig } from "./support-contacts";
import { applyStudioSeating } from "./studio-seat";
import { createStudioObject, sampleStudioObject, studioPointToWorld } from "./studio";
import { sampleHeldWeightPose } from "./held-weight-pose";
import { weightAtPalm } from "./automatic-weight-grip";
import { reachStudioGrip, studioGripOffset, weightGripPoint } from "./studio-grip";
import { supportElbowTarget } from "./support-contacts";
import { createSupportSetup, supportSetups } from "./support-setups";
import { supportSurfaceFrame, supportSurfaceFromWorld } from "./support-surfaces";
import { blankWorkshopScene, identityTransform, jointLimits, supportRegions, type JointSlug, type RigPose, type StudioLayout, type StudioObject } from "./workshop";

describe("surface support solving", () => {
  it.each([0, 1])("keeps baked support angles inside joint limits at boundary %s", boundary => {
    const rig = createAnatomyRig(new Group());
    try {
      for (const slug of Object.keys(jointLimits) as JointSlug[]) {
        for (const axis of ["x", "y", "z"] as const) {
          const [min, max] = jointLimits[slug][axis];
          poseAnatomyRig(rig, { [slug]: { x: 0, y: 0, z: 0, [axis]: jointLimits[slug][axis][boundary] } });
          const angle = supportPoseFromRig(rig)[slug]![axis];
          expect(angle, `${slug} ${axis}`).toBeGreaterThanOrEqual(min);
          expect(angle, `${slug} ${axis}`).toBeLessThanOrEqual(max);
        }
      }
    } finally { rig.dispose(); }
  });
  it.each(["chest", "back"] as const)("keeps %s bracing upright on the pad as the authored torso changes", region => {
    const rig = createAnatomyRig(new Group());
    const bench = { ...createStudioObject("bench", "bench", 0), rotationY: 35, benchAngle: 60 };
    const studio: StudioLayout = { body: { ...identityTransform }, objects: [bench], supports: [
      { region, objectId: bench.id, surface: "pad", point: { x: 0, y: .8, z: .054 }, normal: { x: 0, y: 0, z: 1 }, turn: 0 },
    ] };
    const padUp = new Vector3(0, 1, 0).applyQuaternion(supportSurfaceFrame(bench, "pad").rotation);
    try {
      for (const tilt of [-25, -.001, 0, .001, 25]) {
        const pose = { torso: { x: tilt, y: 0, z: 0 } };
        poseAnatomyRig(rig, pose);
        expect(applyStudioSupports(rig, studio, 0, pose)[0].reachable).toBe(true);
        const torsoUp = new Vector3(0, 1, 0).applyQuaternion(rig.bones.torso.getWorldQuaternion(new Quaternion()));
        expect(torsoUp.dot(padUp), `${region}, torso tilt ${tilt}`).toBeGreaterThan(.999);
      }
    } finally { rig.dispose(); }
  });
  it("does no work for existing scenes", () => {
    const rig = createAnatomyRig(new Group());
    try { poseAnatomyRig(rig, {}); const before = rig.root.matrixWorld.clone(); expect(applyStudioSupports(rig, undefined, 0, {})).toEqual([]); expect(rig.root.matrixWorld).toEqual(before); }
    finally { rig.dispose(); }
  });
  it.each(supportRegions)("reaches %s without changing bone lengths at 17 poses", region => {
    const rig = createAnatomyRig(new Group()), body = new Group(); body.scale.setScalar(1.2); body.rotation.y = .3; body.add(rig.root);
    const studio: StudioLayout = { body: { ...identityTransform, scale: 1.2 }, objects: [] };
    try {
      for (let i = 0; i <= 16; i++) {
        const desired: RigPose = { "left-shoulder": { x: -25, y: 0, z: 8 }, "right-shoulder": { x: -25, y: 0, z: -8 }, "left-elbow": { x: 60, y: 0, z: 0 }, "right-elbow": { x: 60, y: 0, z: 0 }, "left-hip": { x: -20, y: 0, z: 0 }, "right-hip": { x: -20, y: 0, z: 0 }, "left-knee": { x: -45, y: 0, z: 0 }, "right-knee": { x: -45, y: 0, z: 0 } };
        poseAnatomyRig(rig, desired);
        const target = supportContactPoint(rig, region);
        const contact = supportSurfaceFromWorld(region, null, "floor", target);
        // A generic static platform at this world point isolates each anatomical solve.
        contact.point = { x: target.x, y: target.y, z: target.z };
        studio.supports = [contact];
        const lengths = Object.values(rig.bones).map(bone => bone.position.length());
        const changed = { ...desired, "left-elbow": { x: 60 + i, y: 0, z: 0 }, "right-elbow": { x: 60 - i, y: 0, z: 0 } };
        poseAnatomyRig(rig, changed);
        const reports = applyStudioSupports(rig, studio, 0, changed);
        expect(reports[0].error, `${region} sample ${i}`).toBeLessThan(.005);
        expect(Object.values(rig.bones).map(bone => bone.position.length())).toEqual(lengths);
      }
    } finally { rig.dispose(); }
  });
  it("reports unreachable targets and restores a reposition preview", () => {
    const rig = createAnatomyRig(new Group());
    try {
      poseAnatomyRig(rig, {}); const before = rig.root.position.clone();
      const studio: StudioLayout = { body: { ...identityTransform }, objects: [], supports: [{ region: "left-hand", objectId: null, surface: "floor", point: { x: 50, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 }, turn: 0 }] };
      const preview = previewSupportReposition(rig, studio, 0, {});
      expect(preview.reachable).toBe(false); expect(rig.root.position).toEqual(before);
      expect(new Vector3(preview.body.x, preview.body.y, preview.body.z).length()).toBeLessThanOrEqual(.750001);
    } finally { rig.dispose(); }
  });
  it("evaluates authored candidates without changing the live rig or its parent", () => {
    const rig = createAnatomyRig(new Group()), parent = new Group(); parent.add(rig.root);
    try {
      poseAnatomyRig(rig, { "left-elbow": { x: 55, y: 0, z: 0 } }); const before = rig.handBones.left.getWorldPosition(new Vector3());
      const scene = structuredClone(blankWorkshopScene);
      scene.studio!.supports = [{ region: "pelvis", objectId: null, surface: "floor", point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 }, turn: 30 }];
      expect(evaluateSupportScene(scene, rig, 100)[0].reachable).toBe(true);
      expect(rig.root.parent).toBe(parent); expect(rig.handBones.left.getWorldPosition(new Vector3()).distanceTo(before)).toBeLessThan(1e-10);
    } finally { rig.dispose(); }
  });
  it("does not accumulate contact turn across repeated solves", () => {
    const rig = createAnatomyRig(new Group());
    try {
      const studio: StudioLayout = { body: { ...identityTransform }, objects: [], supports: [{ region: "back", objectId: null, surface: "floor", point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 }, turn: 35 }] };
      poseAnatomyRig(rig, {}); applyStudioSupports(rig, studio, 0, {}); const before = rig.root.quaternion.clone();
      applyStudioSupports(rig, studio, 0, {}); expect(rig.root.quaternion.angleTo(before)).toBeLessThan(1e-7);
    } finally { rig.dispose(); }
  });
  it.each(["front", "left", "right", "back", "supine", "prone"] as const)("converts legacy %s bench seating without snapping", facing => {
    const rig = createAnatomyRig(new Group()), parent = new Group(); parent.add(rig.root);
    try {
      const scene = structuredClone(blankWorkshopScene), bench = { ...createStudioObject("bench", "bench", 0), x: 0, z: 0 };
      scene.studio!.objects = [bench]; scene.studio!.seating = { benchId: bench.id, facing };
      poseAnatomyRig(rig, scene.keyframes[0].poses); applyStudioSeating(rig, scene.studio, 0, scene.keyframes[0].poses);
      const before = rig.bones.pelvis.getWorldPosition(new Vector3()), foot = rig.footBones.left.getWorldPosition(new Vector3());
      const converted = bakeLegacySupportScene(scene, rig);
      poseAnatomyRig(rig, converted.keyframes[0].poses); applyStudioSupports(rig, converted.studio, 0, converted.keyframes[0].poses);
      expect(converted.studio!.seating).toBeUndefined(); expect(rig.bones.pelvis.getWorldPosition(new Vector3()).distanceTo(before)).toBeLessThan(.005);
      expect(rig.footBones.left.getWorldPosition(new Vector3()).distanceTo(foot)).toBeLessThan(.005);
    } finally { rig.dispose(); }
  });
  it.each(supportSetups)("creates reachable %s supports", setup => {
    const rig = createAnatomyRig(new Group());
    try {
      const scene = structuredClone(blankWorkshopScene); scene.studio!.objects = [{ ...createStudioObject("bench", "bench", 0), x: 0, z: 0, benchAngle: 0 }];
      const next = createSupportSetup(scene, setup, rig);
      const reports = evaluateSupportScene(next, rig, 0);
      expect(reports.length).toBeGreaterThan(0);
      expect(reports.every(report => report.reachable), JSON.stringify(reports)).toBe(true);
    } finally { rig.dispose(); }
  });
  it("bakes supported limb angles before release", () => {
    const rig = createAnatomyRig(new Group());
    try {
      const scene = structuredClone(blankWorkshopScene); poseAnatomyRig(rig, { "left-elbow": { x: 65, y: 0, z: 0 } });
      const target = supportContactPoint(rig, "left-hand"); scene.studio!.supports = [{ region: "left-hand", objectId: null, surface: "floor", point: { x: target.x, y: target.y, z: target.z }, normal: { x: 0, y: 1, z: 0 }, turn: 0 }];
      const released = bakeSupportRelease(scene, "left-hand", rig);
      poseAnatomyRig(rig, released.keyframes[0].poses);
      expect(released.studio!.supports).toHaveLength(0); expect(supportContactPoint(rig, "left-hand").distanceTo(target)).toBeLessThan(.005);
    } finally { rig.dispose(); }
  });
  it("reconstructs the displayed supported wrist without rerunning supports", () => {
    const rig = createAnatomyRig(new Group());
    try {
      poseAnatomyRig(rig, {}); const target = supportContactPoint(rig, "left-hand").add(new Vector3(-.04, .04, 0));
      const rack = { ...createStudioObject("squat-rack", "rack", 0), x: 0, y: 0, z: 0 };
      const studio: StudioLayout = { body: { ...identityTransform }, objects: [rack], supports: [{ region: "left-hand", objectId: rack.id, surface: "body", point: { x: target.x, y: target.y, z: target.z }, normal: { x: 0, y: 1, z: 0 }, turn: 0 }] };
      const reports = applyStudioSupports(rig, studio, 0, {}), before = supportContactPoint(rig, "left-hand"), pose = supportPoseFromRig(rig);
      expect(before.distanceTo(target), JSON.stringify({ reports, pose })).toBeLessThan(.005);
      poseAnatomyRig(rig, pose); expect(supportContactPoint(rig, "left-hand").distanceTo(before), JSON.stringify(pose)).toBeLessThan(.005);
    } finally { rig.dispose(); }
  });
  it("keeps supported soles facing the surface within ankle bounds", () => {
    const rig = createAnatomyRig(new Group());
    try {
      poseAnatomyRig(rig, {}); const target = supportContactPoint(rig, "left-foot");
      const studio: StudioLayout = { body: { ...identityTransform }, objects: [], supports: [{ region: "left-foot", objectId: null, surface: "floor", point: { x: target.x, y: target.y, z: target.z }, normal: { x: 0, y: 1, z: 0 }, turn: 0 }] };
      expect(applyStudioSupports(rig, studio, 0, {})[0].reachable).toBe(true);
      const sole = new Vector3(0, -1, 0).applyQuaternion(rig.footBones.left.getWorldQuaternion(new Quaternion()));
      expect(sole.dot(new Vector3(0, -1, 0))).toBeGreaterThan(.99);
    } finally { rig.dispose(); }
  });
  it("keeps an elbow anchored while a held weight curls at 17 playback samples", () => {
    const rig = createAnatomyRig(new Group());
    try {
      const scene = structuredClone(blankWorkshopScene), rack = { ...createStudioObject("squat-rack", "rack", 0), x: 0, y: 0, z: 0 };
      const weight: StudioObject = { ...createStudioObject("dumbbell", "weight", 0), attachment: "left", poseDriver: "weight" };
      scene.keyframes = Array.from({ length: 17 }, (_, index) => ({ timeMs: scene.durationMs * index / 16, poses: { "left-shoulder": { x: -30, y: 0, z: 0 }, "left-elbow": { x: 50 + index * 3, y: 0, z: 0 }, "left-wrist": { x: 0, y: 0, z: 0 } } }));
      weight.frames = scene.keyframes.map(frame => { poseAnatomyRig(rig, frame.poses); return { timeMs: frame.timeMs, ...weightAtPalm(rig, weight, "left") }; });
      poseAnatomyRig(rig, scene.keyframes[0].poses);
      const anchor = supportContactPoint(rig, "left-elbow");
      scene.studio!.objects = [rack, weight]; scene.studio!.supports = [{ region: "left-elbow", objectId: rack.id, surface: "body", point: { x: anchor.x, y: anchor.y, z: anchor.z }, normal: { x: 0, y: 1, z: 0 }, turn: 0 }];
      for (const frame of scene.keyframes) {
        const sampled = sampleHeldWeightPose(scene, frame.timeMs); poseAnatomyRig(rig, sampled);
        expect(supportContactPoint(rig, "left-elbow").distanceTo(anchor)).toBeLessThan(.005);
        const object = sampleStudioObject(weight, frame.timeMs), grip = studioPointToWorld(weightGripPoint(object, "left"), object);
        expect(rig.handBones.left.localToWorld(studioGripOffset("left")).distanceTo(grip)).toBeLessThan(.005);
        poseAnatomyRig(rig, frame.poses); applyStudioSupports(rig, scene.studio, frame.timeMs, frame.poses);
        const elbow = supportElbowTarget(rig, scene.studio, "left", frame.timeMs);
        const shaft = new Quaternion().setFromEuler(new Euler(object.rotationX * Math.PI / 180, object.rotationY * Math.PI / 180, object.rotationZ * Math.PI / 180));
        expect(reachStudioGrip(rig, "left", grip, shaft, frame.poses["left-wrist"], elbow)).toBeLessThan(.005);
        expect(supportContactPoint(rig, "left-elbow").distanceTo(anchor)).toBeLessThan(.005);
      }
    } finally { rig.dispose(); }
  });
  it("keeps supports on the licensed anatomy rig across playback and body resizing", async () => {
    const bytes = await readFile("public/models/z-anatomy/model.glb");
    const model = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    const rig = createAnatomyRig(model.scene);
    try {
      for (const scale of [.8, 1, 1.3]) for (const setup of supportSetups) {
        const scene = structuredClone(blankWorkshopScene);
        scene.studio!.body.scale = scale;
        scene.studio!.objects = [{ ...createStudioObject("bench", "bench", 0), x: .3, z: -.2, rotationY: 30, scale, benchAngle: 0 }];
        const next = createSupportSetup(scene, setup, rig);
        for (let index = 0; index <= 16; index++) {
          const reports = evaluateSupportScene(next, rig, next.durationMs * index / 16);
          expect(reports.every(report => report.error < .005 * scale), `${setup}, scale ${scale}: ${JSON.stringify(reports)}`).toBe(true);
        }
      }
      const audit: { setup: string; minimumY: number; mesh: string }[] = [];
      for (const setup of ["floor-sitting", "floor-kneeling", "floor-supine", "floor-prone"] as const) {
        const next = createSupportSetup(structuredClone(blankWorkshopScene), setup, rig), body = new Group();
        const transform = next.studio!.body;
        body.position.set(transform.x, transform.y, transform.z); body.rotation.set(transform.rotationX * Math.PI / 180, transform.rotationY * Math.PI / 180, transform.rotationZ * Math.PI / 180); body.scale.setScalar(transform.scale); body.add(rig.root);
        poseAnatomyRig(rig, next.keyframes[0].poses); applyStudioSupports(rig, next.studio, 0, next.keyframes[0].poses);
        body.updateMatrixWorld(true); rig.skeleton.update();
        let minimumY = Infinity, minimumMesh = ""; const vertex = new Vector3();
        for (const mesh of rig.meshes) for (let index = 0; index < mesh.geometry.getAttribute("position").count; index++) {
          mesh.localToWorld(mesh.getVertexPosition(index, vertex));
          if (vertex.y < minimumY) { minimumY = vertex.y; minimumMesh = mesh.name; }
        }
        audit.push({ setup, minimumY, mesh: minimumMesh }); body.remove(rig.root);
      }
      await mkdir(".local-artifacts/supports", { recursive: true });
      await writeFile(".local-artifacts/supports/anatomy-contact-audit.json", JSON.stringify(audit, null, 2));
      expect(audit.every(item => item.minimumY > -.03), JSON.stringify(audit)).toBe(true);
      const scene = structuredClone(blankWorkshopScene);
      scene.studio!.objects = [{ ...createStudioObject("bench", "bench", 0), x: 0, z: 0, benchAngle: 0 }];
      const supported = createSupportSetup(scene, "bench-hand-knee", rig), body = new Group(), transform = supported.studio!.body;
      body.position.set(transform.x, transform.y, transform.z); body.rotation.set(transform.rotationX * Math.PI / 180, transform.rotationY * Math.PI / 180, transform.rotationZ * Math.PI / 180); body.add(rig.root);
      const measurements: { run: number; supports: boolean; p50Ms: number; p95Ms: number }[] = [];
      for (let run = 0; run < 3; run++) for (const enabled of [false, true]) {
        const times: number[] = [];
        for (let sample = 0; sample < 140; sample++) {
          const start = performance.now();
          poseAnatomyRig(rig, supported.keyframes[0].poses);
          applyStudioSupports(rig, enabled ? supported.studio : undefined, sample * 20, supported.keyframes[0].poses);
          body.updateMatrixWorld(true); rig.skeleton.update();
          if (sample >= 20) times.push(performance.now() - start);
        }
        times.sort((a, b) => a - b); measurements.push({ run: run + 1, supports: enabled, p50Ms: times[Math.floor(times.length * .5)], p95Ms: times[Math.floor(times.length * .95)] });
      }
      body.remove(rig.root);
      await writeFile(".local-artifacts/supports/solver-cpu-benchmark.json", JSON.stringify({ hardware: { cpu: cpus()[0]?.model, platform: platform(), arch: arch() }, note: "CPU pose + support stage only; no GPU/frame-time acceptance claim. Same licensed anatomy and authored pose, three warmed runs with and without two bench contacts.", measurements }, null, 2));
    } finally { rig.dispose(); }
  });
});
