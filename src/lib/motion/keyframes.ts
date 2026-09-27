export type ShoulderPose = {
  leftShoulderZ: number;
  rightShoulderZ: number;
};

export type MotionKeyframe = {
  time: number;
  pose: ShoulderPose;
};

export const lateralRaiseMotion: readonly MotionKeyframe[] = [
  { time: 0, pose: { leftShoulderZ: 0.08, rightShoulderZ: -0.08 } },
  { time: 0.35, pose: { leftShoulderZ: -1.28, rightShoulderZ: 1.28 } },
  { time: 0.5, pose: { leftShoulderZ: -1.28, rightShoulderZ: 1.28 } },
  { time: 0.92, pose: { leftShoulderZ: 0.08, rightShoulderZ: -0.08 } },
  { time: 1, pose: { leftShoulderZ: 0.08, rightShoulderZ: -0.08 } },
];

export function sampleShoulderMotion(
  keyframes: readonly MotionKeyframe[],
  progress: number,
): ShoulderPose {
  if (keyframes.length < 2) {
    throw new Error("Motion needs at least two keyframes");
  }
  const clamped = Math.min(1, Math.max(0, progress));
  let nextIndex = keyframes.findIndex((frame) => frame.time >= clamped);
  if (nextIndex <= 0) {
    nextIndex = nextIndex === -1 ? keyframes.length - 1 : 1;
  }
  const before = keyframes[nextIndex - 1];
  const after = keyframes[nextIndex];
  const span = after.time - before.time;
  const blend = span === 0 ? 0 : (clamped - before.time) / span;
  return {
    leftShoulderZ: before.pose.leftShoulderZ +
      (after.pose.leftShoulderZ - before.pose.leftShoulderZ) * blend,
    rightShoulderZ: before.pose.rightShoulderZ +
      (after.pose.rightShoulderZ - before.pose.rightShoulderZ) * blend,
  };
}
