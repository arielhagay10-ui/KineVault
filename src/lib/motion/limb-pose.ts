import { Matrix3, Vector3 } from "three";
import type { AnatomyRig } from "./anatomy";
import { studioAttachmentSlots } from "./studio";
import { jointLimits, type JointAngles, type JointSlug, type RigPose, type WorkshopScene } from "./workshop";

export const poseLimbs = ["left-hand", "right-hand", "left-foot", "right-foot"] as const;
export type PoseLimb = typeof poseLimbs[number];
export const limbNames: Record<PoseLimb, string> = { "left-hand": "Left hand", "right-hand": "Right hand", "left-foot": "Left foot", "right-foot": "Right foot" };

export function limbPoseBlock(scene: WorkshopScene, limb: PoseLimb): string | undefined {
  if (scene.studio?.objects.some(object => object.machineUse)) return "Leave the machine to pose hands and feet freely. Move its handles to keep contact.";
  if (scene.motionStyle && scene.motionStyle !== "free") return "Choose Free posing in Movement setup to move hands and feet freely.";
  if (limb.endsWith("foot") && scene.studio?.seating) return "Stand up to move feet freely. Seating keeps feet supported.";
  const side = limb.startsWith("left") ? "left" : "right";
  if (scene.equipment && (limb.endsWith("hand") || scene.equipment.slug === "single-cable")) return "Use editable equipment or remove the attached equipment before posing this limb.";
  const held = scene.studio?.objects.find(object => studioAttachmentSlots(object).some(slot => slot.startsWith(side) && (limb.endsWith("hand") ? !slot.endsWith("ankle") : slot.endsWith("ankle"))));
  if (held) return "Move the attached equipment to pose this limb, or release it first.";
}

/** Bounded damped least squares on saved angles. Bone translations never change.
 * Evaluations restore the displayed rig; replaying the result uses the same pose convention.
 */
export function solveLimbPose(rig: AnatomyRig, limb: PoseLimb, pose: RigPose, target: Vector3, frontalPlane = false) {
  const side = limb.startsWith("left") ? "left" : "right", hand = limb.endsWith("hand");
  const upperSlug: JointSlug = `${side}-${hand ? "shoulder" : "hip"}`;
  const hingeSlug: JointSlug = `${side}-${hand ? "elbow" : "knee"}`;
  const upper = rig.bones[upperSlug], hinge = rig.bones[hingeSlug], end = rig.bones[`${side}-${hand ? "wrist" : "ankle"}`];
  const originalUpper = upper.quaternion.clone(), originalHinge = hinge.quaternion.clone();
  const baseUpper = pose[upperSlug] ?? { x: 0, y: 0, z: 0 }, baseHinge = pose[hingeSlug] ?? { x: 0, y: 0, z: 0 };
  const ranges = [jointLimits[upperSlug].x, jointLimits[upperSlug].y, jointLimits[upperSlug].z, (hand ? [0, 155] : [-150, 0]) as [number, number]];
  if (hand && frontalPlane) { ranges[0] = [0, 0]; ranges[1] = [0, 0]; }
  const bound = (values: number[]) => values.map((value, i) => Math.max(ranges[i][0], Math.min(ranges[i][1], value)));
  const radians = Math.PI / 180;
  const evaluate = (values: number[]) => {
    upper.rotation.set(values[0] * radians, values[1] * radians, -values[2] * radians);
    hinge.rotation.set(-values[3] * radians, baseHinge.y * radians, -baseHinge.z * radians);
    return end.getWorldPosition(new Vector3());
  };
  let values = bound([baseUpper.x, baseUpper.y, baseUpper.z, baseHinge.x]);
  let best = values.slice(), error = Infinity;
  try {
    if (![target.x, target.y, target.z].every(Number.isFinite)) return { poses: {}, error: Infinity };
    error = evaluate(values).distanceTo(target);
    // A small bend gives a straight limb a usable Jacobian without changing its hinge direction.
    if (error >= .001 && Math.abs(values[3]) < 2) values[3] = hand ? 12 : -12;
    for (let iteration = 0; iteration < 80; iteration++) {
      const point = evaluate(values), difference = target.clone().sub(point), distance = difference.length();
      if (distance < error) { best = values.slice(); error = distance; }
      if (distance < .001) break;
      const jacobian = values.map((value, i) => {
        if (ranges[i][0] === ranges[i][1]) return new Vector3();
        const trial = values.slice(); trial[i] = value + .1;
        return evaluate(trial).sub(point).multiplyScalar(10);
      });
      const matrix = new Matrix3().set(
        jacobian.reduce((sum, j) => sum + j.x * j.x, .000015), jacobian.reduce((sum, j) => sum + j.x * j.y, 0), jacobian.reduce((sum, j) => sum + j.x * j.z, 0),
        jacobian.reduce((sum, j) => sum + j.y * j.x, 0), jacobian.reduce((sum, j) => sum + j.y * j.y, .000015), jacobian.reduce((sum, j) => sum + j.y * j.z, 0),
        jacobian.reduce((sum, j) => sum + j.z * j.x, 0), jacobian.reduce((sum, j) => sum + j.z * j.y, 0), jacobian.reduce((sum, j) => sum + j.z * j.z, .000015),
      ).invert();
      const correction = difference.applyMatrix3(matrix);
      const step = jacobian.map(j => Math.max(-12, Math.min(12, j.dot(correction))));
      let accepted = false;
      for (const scale of [1, .5, .25, .1]) {
        const next = bound(values.map((value, i) => value + step[i] * scale));
        if (evaluate(next).distanceTo(target) < distance) { values = next; accepted = true; break; }
      }
      if (!accepted) break;
    }
    const angles = (x: number, y: number, z: number): JointAngles => ({ x, y, z });
    return { poses: { [upperSlug]: angles(best[0], best[1], best[2]), [hingeSlug]: angles(best[3], baseHinge.y, baseHinge.z) }, error };
  } finally {
    upper.quaternion.copy(originalUpper); hinge.quaternion.copy(originalHinge);
    rig.root.updateWorldMatrix(true, true);
  }
}
