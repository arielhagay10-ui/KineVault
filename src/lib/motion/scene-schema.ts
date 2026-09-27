import { z } from "zod";
import { jointLimits, jointSlugs } from "./workshop";

const finite = z.number().finite();
const angles = z.object({ x: finite, y: finite, z: finite }).strict();
const poses = z.partialRecord(z.enum(jointSlugs), angles).superRefine((value, context) => {
  for (const [slug, angle] of Object.entries(value)) {
    const limits = jointLimits[slug as keyof typeof jointLimits];
    for (const axis of ["x", "y", "z"] as const) {
      if (angle[axis] < limits[axis][0] || angle[axis] > limits[axis][1]) {
        context.addIssue({ code: "custom", message: `${slug} ${axis} is outside the rig range` });
      }
    }
  }
});

export const workshopSceneSchema = z.object({
  durationMs: z.number().int().min(250).max(60_000),
  cameraAngle: z.enum(["front", "side", "three_quarter"]),
  equipment: z.object({
    slug: z.enum(["dumbbell-pair", "barbell", "single-cable"]),
    x: finite.min(-3).max(3),
    y: finite.min(-3).max(3),
    z: finite.min(-3).max(3),
    scale: finite.min(0.5).max(2),
  }).strict().nullable(),
  keyframes: z.array(z.object({ timeMs: z.number().int(), poses }).strict()).min(2).max(24),
}).strict().superRefine((scene, context) => {
  let previous = -1;
  scene.keyframes.forEach((frame, index) => {
    if (frame.timeMs <= previous || frame.timeMs > scene.durationMs) {
      context.addIssue({ code: "custom", message: `Keyframe ${index + 1} is out of order` });
    }
    previous = frame.timeMs;
  });
  if (scene.keyframes[0]?.timeMs !== 0 || previous !== scene.durationMs) {
    context.addIssue({ code: "custom", message: "Timeline must start at 0 and end at its duration" });
  }
});
