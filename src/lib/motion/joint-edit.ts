import { jointLimits, type JointAngles, type JointSlug, type RigPose } from "./workshop";

export function jointEditChanges(slug: JointSlug, angles: JointAngles, bothSides: boolean): RigPose {
  if (!bothSides || slug === "torso") return { [slug]: angles };
  const opposite = slug.replace(/^(left|right)-/, slug.startsWith("left-") ? "right-" : "left-") as JointSlug;
  const mirrored = { x: angles.x, y: slug.endsWith("wrist") ? angles.y : -angles.y, z: -angles.z };
  for (const axis of ["x", "y", "z"] as const) {
    const [min, max] = jointLimits[opposite][axis];
    mirrored[axis] = Math.max(min, Math.min(max, mirrored[axis]));
  }
  return { [slug]: angles, [opposite]: mirrored };
}
