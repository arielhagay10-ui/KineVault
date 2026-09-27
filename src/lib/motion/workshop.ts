export const jointSlugs = [
  "torso", "left-shoulder", "right-shoulder", "left-elbow", "right-elbow",
  "left-hip", "right-hip", "left-knee", "right-knee",
] as const;
export type JointSlug = typeof jointSlugs[number];
export type JointAngles = { x: number; y: number; z: number };
export type RigPose = Partial<Record<JointSlug, JointAngles>>;
export type WorkshopKeyframe = { timeMs: number; poses: RigPose };
export type WorkshopScene = {
  durationMs: number;
  cameraAngle: "front" | "side" | "three_quarter";
  equipment: { slug: "dumbbell-pair" | "barbell" | "single-cable"; x: number; y: number; z: number; scale: number } | null;
  keyframes: WorkshopKeyframe[];
};

export const jointLimits: Record<JointSlug, { x: [number, number]; y: [number, number]; z: [number, number] }> = {
  torso: { x: [-35, 35], y: [-45, 45], z: [-30, 30] },
  "left-shoulder": { x: [-160, 160], y: [-90, 90], z: [-170, 170] },
  "right-shoulder": { x: [-160, 160], y: [-90, 90], z: [-170, 170] },
  "left-elbow": { x: [-15, 155], y: [-20, 20], z: [-150, 150] },
  "right-elbow": { x: [-15, 155], y: [-20, 20], z: [-150, 150] },
  "left-hip": { x: [-120, 120], y: [-60, 60], z: [-75, 75] },
  "right-hip": { x: [-120, 120], y: [-60, 60], z: [-75, 75] },
  "left-knee": { x: [-150, 15], y: [-15, 15], z: [-30, 30] },
  "right-knee": { x: [-150, 15], y: [-15, 15], z: [-30, 30] },
};

export const defaultScene: WorkshopScene = {
  durationMs: 3200,
  cameraAngle: "three_quarter",
  equipment: { slug: "dumbbell-pair", x: 0, y: 0, z: 0, scale: 1 },
  keyframes: [
    { timeMs: 0, poses: { "left-shoulder": { x: 0, y: 0, z: 5 }, "right-shoulder": { x: 0, y: 0, z: -5 } } },
    { timeMs: 1600, poses: { "left-shoulder": { x: 0, y: 0, z: -75 }, "right-shoulder": { x: 0, y: 0, z: 75 } } },
    { timeMs: 3200, poses: { "left-shoulder": { x: 0, y: 0, z: 5 }, "right-shoulder": { x: 0, y: 0, z: -5 } } },
  ],
};

export function sampleWorkshopPose(frames: WorkshopKeyframe[], timeMs: number): RigPose {
  if (frames.length < 2) throw new Error("A scene needs two keyframes");
  const time = Math.min(frames[frames.length - 1].timeMs, Math.max(0, timeMs));
  const found = frames.findIndex((frame) => frame.timeMs >= time);
  const nextIndex = found < 0 ? frames.length - 1 : Math.max(1, found);
  const previous = frames[nextIndex - 1];
  const next = frames[nextIndex];
  const span = next.timeMs - previous.timeMs;
  const blend = span === 0 ? 0 : (time - previous.timeMs) / span;
  const result: RigPose = {};
  for (const slug of jointSlugs) {
    const a = previous.poses[slug] ?? { x: 0, y: 0, z: 0 };
    const b = next.poses[slug] ?? { x: 0, y: 0, z: 0 };
    result[slug] = {
      x: a.x + (b.x - a.x) * blend,
      y: a.y + (b.y - a.y) * blend,
      z: a.z + (b.z - a.z) * blend,
    };
  }
  return result;
}
