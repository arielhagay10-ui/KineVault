import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Group, Quaternion, Vector3 } from "three";
import { createAnatomyRig, plantAnatomyFeet, poseAnatomyRig, type AnatomyRig } from "./anatomy";
import type { RigPose } from "./workshop";

const progressSamples = [-10, 0, 1.75, 3.5, 7, 10.5, 14, 17.5, 21, 24.5, 28, 31.5, 33.25, 35, 50];

function plantedState(rig: AnatomyRig, style: string, torso: number, ankles: boolean) {
  const pose: RigPose = { torso: { x: torso, y: 0, z: 0 }, "left-hip": { x: 30, y: 0, z: 0 }, "right-knee": { x: 40, y: 0, z: 0 },
    ...ankles ? { "left-ankle": { x: 12, y: -4, z: 3 }, "right-ankle": { x: -8, y: 5, z: -2 } } : {} };
  poseAnatomyRig(rig, pose);
  plantAnatomyFeet(rig, style, pose);
  const values = [...rig.root.position.toArray(), ...rig.root.quaternion.toArray(), ...rig.bones.torso.quaternion.toArray()];
  for (const side of ["left", "right"] as const) values.push(...rig.bones[`${side}-hip`].quaternion.toArray(), ...rig.bones[`${side}-knee`].quaternion.toArray(),
    ...rig.footBones[side].quaternion.toArray(), ...rig.footBones[side].getWorldPosition(new Vector3()).toArray());
  return values;
}

// SHA-256 of every sampled value, recorded from the styles before deep-squat and
// deadlift were added. Any change to an existing style's output fails here.
const existingStyles: Record<string, string> = {
  free: "17e08b2a8b0030b92206cb933838e0a9a0aabc5b9d6e558021b5995fa04e636b",
  squat: "fb3639980343312ae6e25649eaaba61f5741fffe169e962783b842434eac5af2",
  hinge: "7eaf122856ebc9325b75fbf5b20a3312622f75f4382024b673ffa88bc5e9bb88",
  row: "019ceb42a138180cdc13ad17b39901eea9f6d768f151adfacb80f874c190702c",
  "split-squat": "99ac22a21ba2b409682f483faa06f9ee42580bb44b08975ff7cc4c34b98cd23c",
  "bench-press": "98cbccda7d35101b4ba0e16eb9157b32cfaa4cfa3dc573c343b15facb60c4c4f",
  "seated-curl": "1c5644942c6a052e8491d1a3261947b36adcb76fc9556799e70d6186173eb8a9",
  "incline-curl": "391e6b881c2ed8a49aa3c221fd163f0339f69c9e8a3c0b69e898bec0cc2b7ed7",
};

describe("planted movement styles", () => {
  it("keeps existing style output byte-for-byte unchanged", () => {
    const rig = createAnatomyRig(new Group());
    try {
      for (const [style, digest] of Object.entries(existingStyles)) {
        const values = progressSamples.flatMap(torso => [false, true].flatMap(ankles => plantedState(rig, style, torso, ankles)));
        expect(createHash("sha256").update(values.join(",")).digest("hex"), style).toBe(digest);
      }
    } finally { rig.dispose(); }
  });

  it.each(["deep-squat", "deadlift"])("keeps both %s feet planted and flat", style => {
    const rig = createAnatomyRig(new Group());
    try {
      for (const torso of progressSamples) {
        plantedState(rig, style, torso, false);
        for (const side of ["left", "right"] as const) {
          const foot = rig.footBones[side].getWorldPosition(new Vector3());
          expect(foot.distanceTo(new Vector3(side === "left" ? .153 : -.153, .119, -.034))).toBeLessThan(.001);
          expect(rig.footBones[side].getWorldQuaternion(new Quaternion()).angleTo(new Quaternion())).toBeLessThan(1e-5);
        }
      }
    } finally { rig.dispose(); }
  });

  it("reaches parallel squat depth and a conventional floor-start deadlift", () => {
    const rig = createAnatomyRig(new Group());
    const joint = (name: "left-hip" | "left-knee" | "left-shoulder") => rig.bones[name].getWorldPosition(new Vector3());
    try {
      plantedState(rig, "deep-squat", 35, false);
      const [hip, knee] = [joint("left-hip"), joint("left-knee")];
      expect(hip.y).toBeLessThanOrEqual(knee.y);
      plantedState(rig, "deadlift", 35, false);
      const [start, startKnee, shoulder] = [joint("left-hip"), joint("left-knee"), joint("left-shoulder")];
      expect(start.y).toBeGreaterThan(startKnee.y);
      expect(start.y).toBeLessThan(shoulder.y);
      const trunk = Math.atan2(shoulder.y - start.y, shoulder.z - start.z) * 180 / Math.PI;
      expect(trunk).toBeGreaterThan(30);
      expect(trunk).toBeLessThan(45);
      expect(shoulder.y).toBeLessThan(1.25);
      plantedState(rig, "deadlift", 0, false);
      expect(rig.root.quaternion.angleTo(new Quaternion())).toBe(0);
    } finally { rig.dispose(); }
  });
});
