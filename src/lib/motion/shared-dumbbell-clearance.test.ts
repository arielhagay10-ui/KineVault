import { readFile } from "node:fs/promises";
import { beforeAll, expect, it } from "vitest";
import { Box3, Group, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createAnatomyRig, plantAnatomyFeet, poseAnatomyRig } from "./anatomy";
import { automaticWeightTransform, solveDumbbellGrip } from "./automatic-weight-grip";
import { createStudioObject } from "./studio";
import { blankWorkshopScene, identityTransform, type RigPose } from "./workshop";

let source: Group;
beforeAll(async () => {
  const bytes = await readFile("public/models/z-anatomy/model.glb");
  source = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "")).scene;
});

it("keeps both upper arms and forearms outside the real torso during a default goblet squat", () => {
  const rig = createAnatomyRig(source);
  const body = rig.meshes.filter(mesh => /pectoralis_major|rectus_abdominis|oblique.*abdom|latissimus/i.test(mesh.name));
  const weight = { ...createStudioObject("dumbbell", "weight", 0), attachment: "both" as const };
  try {
    for (let step = 0; step <= 16; step++) {
      const squat = Math.sin(step / 16 * Math.PI);
      const pose: RigPose = { torso: { x: 35 * squat, y: 0, z: 0 },
        "left-hip": { x: 60 * squat, y: 0, z: 0 }, "right-hip": { x: 60 * squat, y: 0, z: 0 },
        "left-knee": { x: -90 * squat, y: 0, z: 0 }, "right-knee": { x: -90 * squat, y: 0, z: 0 } };
      const scene = { ...structuredClone(blankWorkshopScene), motionStyle: "squat" as const,
        keyframes: [0, 3200].map(timeMs => ({ timeMs, poses: pose })) };
      const placed = { ...weight, ...automaticWeightTransform(identityTransform, weight, "both", scene, 0) };
      poseAnatomyRig(rig, pose, true); plantAnatomyFeet(rig, "squat", pose);
      expect(solveDumbbellGrip(rig, placed, pose, new Vector3())!.limited).toBe(false);
      const torso = rig.bones.torso;
      const vertices = body.flatMap(mesh => Array.from({ length: mesh.geometry.getAttribute("position").count }, (_, index) =>
        torso.worldToLocal(mesh.localToWorld(mesh.getVertexPosition(index, new Vector3())))));
      for (const side of ["left", "right"] as const) {
        const shoulder = torso.worldToLocal(rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3()));
        const elbow = torso.worldToLocal(rig.bones[`${side}-elbow`].getWorldPosition(new Vector3()));
        const wrist = torso.worldToLocal(rig.handBones[side].getWorldPosition(new Vector3()));
        for (const [part, start, end] of [["upper arm", shoulder, elbow], ["forearm", elbow, wrist]] as const) {
          // The proximal upper arm joins the shoulder/chest. Check the distal
          // upper arm and the whole forearm, which must not pass through ribs.
          for (const fraction of part === "upper arm" ? [.7, .85, 1] : [.2, .4, .6, .8, 1]) {
            const point = start.clone().lerp(end, fraction);
            const section = vertices.filter(vertex => Math.abs(vertex.y - point.y) < .04);
            if (!section.length) continue;
            const bounds = new Box3().setFromPoints(section);
            const clearance = Math.max(point.x - bounds.max.x, bounds.min.x - point.x, point.z - bounds.max.z, bounds.min.z - point.z);
            expect(clearance, JSON.stringify({ step, side, part, fraction, point: point.toArray(), elbow: elbow.toArray(), wrist: wrist.toArray(), bounds: [bounds.min.toArray(), bounds.max.toArray()] })).toBeGreaterThan(.025);
          }
        }
      }
    }
  } finally { rig.dispose(); }
});
