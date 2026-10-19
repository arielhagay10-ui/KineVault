"use client";

import { useMemo, type ReactNode } from "react";
import type { MotionPlaybackClock } from "@/lib/motion/playback";
import type { createHeldWeightPoseSampler } from "@/lib/motion/held-weight-pose";
import type { JointAngles, JointSlug, WorkshopScene } from "@/lib/motion/workshop";
import { usePlaybackDisplayTime } from "./use-motion-playback";

/** The active inspector shares the owner's solver without subscribing the editor shell. */
export function WorkshopJointValues({ scene, playback, sampler, joint, initial, active, children }: {
  scene: WorkshopScene; playback: MotionPlaybackClock;
  sampler: ReturnType<typeof createHeldWeightPoseSampler>; joint: JointSlug;
  initial: JointAngles; active: boolean; children: (angles: JointAngles) => ReactNode;
}) {
  const time = usePlaybackDisplayTime(playback, playback.timeMs, active);
  const angles = useMemo(() => active && playback.playing ? sampler.sample(scene, time)[joint] ?? initial : initial,
    [scene, time, joint, initial, active, playback, sampler]);
  return children(angles);
}
