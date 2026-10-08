import type { Vector3 } from "three";
import type { AnatomyRig } from "./anatomy";
import { solveLimbPose } from "./limb-pose";
import type { RigPose } from "./workshop";

/** Save arm angles without changing the tower, body placement or leg pose. */
export function solveCablePose(rig: AnatomyRig, pose: RigPose, targets: Partial<Record<"left" | "right", Vector3>>, frontalPlane = false) {
  let poses: RigPose = {}, error = 0;
  for (const side of ["left", "right"] as const) {
    if (!targets[side]) continue;
    const result = solveLimbPose(rig, `${side}-hand`, pose, targets[side]!, frontalPlane);
    poses = { ...poses, ...result.poses }; error = Math.max(error, result.error);
  }
  return { poses, error };
}
