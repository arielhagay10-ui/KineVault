export const jointSlugs = [
  "torso", "left-shoulder", "right-shoulder", "left-elbow", "right-elbow",
  "left-hip", "right-hip", "left-knee", "right-knee", "left-wrist", "right-wrist", "left-ankle", "right-ankle",
] as const;
export type JointSlug = typeof jointSlugs[number];
export type JointAngles = { x: number; y: number; z: number };
export type RigPose = Partial<Record<JointSlug, JointAngles>>;
export type WorkshopKeyframe = { timeMs: number; poses: RigPose };
export type MotionAnnotation = { startMs: number; endMs: number; label: string; note: string | null; jointAction: string | null };
export type SceneTransform = { x: number; y: number; z: number; rotationX: number; rotationY: number; rotationZ: number; scale: number };
export type ScenePoint = { x: number; y: number; z: number };
export type ScenePresentation = { highlight: string; isolate: boolean; view: "front" | "side" | "three_quarter" | "back" };
export const studioAssetSlugs = ["cable-machine", "bench", "squat-rack", "barbell", "dumbbell", "kettlebell", "lat-pulldown-machine", "smith-machine", "leg-press", "cable-row-machine", "pec-deck"] as const;
export const cableAttachmentSlugs = ["d-handle", "rope", "straight-bar", "angled-bar", "lat-bar", "v-bar", "cuff"] as const;
export type CableAttachment = typeof cableAttachmentSlugs[number];
export type StudioObject = SceneTransform & {
  id: string; name: string; slug: typeof studioAssetSlugs[number];
  attachment: "none" | "left" | "right" | "both"; pulleyHeight: number;
  frames?: (SceneTransform & { timeMs: number; machinePosition?: number; machineHandleHeight?: number })[];
  machinePosition?: number;
  machineHandleHeight?: number;
  machineUse?: boolean;
  machineGrip?: "supinated" | "pronated";
  machineMode?: "regular" | "reverse";
  machinePalm?: "inward" | "outward";
  machineElbowPath?: "beside-body" | "shoulder-height";
  benchAngle?: number;
  cableAttachment?: CableAttachment;
  cuffPosition?: "wrist" | "upper-arm";
  shoulderAlignment?: "left" | "right";
  elbowLocks?: Partial<Record<"left" | "right", ScenePoint>>;
};
export type BenchFacing = "front" | "left" | "right" | "back" | "supine" | "prone";
export type StudioLayout = { body: SceneTransform; objects: StudioObject[]; frontalPlane?: boolean; presentation?: ScenePresentation; seating?: { benchId: string; facing: BenchFacing } };
export const identityTransform: SceneTransform = { x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1 };
export const blankWorkshopScene: WorkshopScene = {
  motionStyle: "free", durationMs: 3200, cameraAngle: "three_quarter", equipment: null,
  studio: { body: { ...identityTransform }, objects: [] },
  keyframes: [{ timeMs: 0, poses: {} }, { timeMs: 1600, poses: {} }, { timeMs: 3200, poses: {} }],
};
export type WorkshopScene = {
  motionStyle?: "free" | "squat" | "hinge" | "row" | "split-squat" | "bench-press" | "seated-curl" | "incline-curl";
  durationMs: number;
  cameraAngle: "front" | "side" | "three_quarter";
  equipment: { slug: "dumbbell-pair" | "barbell" | "single-cable"; x: number; y: number; z: number; scale: number } | null;
  keyframes: WorkshopKeyframe[];
  annotations?: MotionAnnotation[];
  studio?: StudioLayout;
};

export const jointLimits: Record<JointSlug, { x: [number, number]; y: [number, number]; z: [number, number] }> = {
  torso: { x: [-35, 35], y: [-45, 45], z: [-30, 30] },
  "left-shoulder": { x: [-160, 160], y: [-90, 90], z: [-170, 170] },
  "right-shoulder": { x: [-160, 160], y: [-90, 90], z: [-170, 170] },
  "left-elbow": { x: [-15, 155], y: [-20, 20], z: [-150, 150] },
  "right-elbow": { x: [-15, 155], y: [-20, 20], z: [-150, 150] },
  "left-hip": { x: [-120, 120], y: [-60, 60], z: [-75, 75] },
  "right-hip": { x: [-120, 120], y: [-60, 60], z: [-75, 75] },
  "left-knee": { x: [-150, 5], y: [0, 0], z: [0, 0] },
  "right-knee": { x: [-150, 5], y: [0, 0], z: [0, 0] },
  // X stores forearm turn, Y wrist flexion, Z wrist deviation. Keeping flexion
  // below 90 degrees makes the persisted XYZ quaternion unambiguous.
  "left-wrist": { x: [-90, 90], y: [-70, 70], z: [-30, 30] },
  "right-wrist": { x: [-90, 90], y: [-70, 70], z: [-30, 30] },
  "left-ankle": { x: [-45, 20], y: [-20, 20], z: [-20, 30] },
  "right-ankle": { x: [-45, 20], y: [-20, 20], z: [-20, 30] },
};

// Knee storage keeps its original sign for existing scenes; controls show
// positive flexion and the rig bends the lower leg backward.
export function jointControlValue(slug: JointSlug, axis: keyof JointAngles, value: number) {
  return slug.endsWith("knee") && axis === "x" ? -value : value;
}

export function jointControlRange(slug: JointSlug, axis: keyof JointAngles): [number, number] {
  const [min, max] = jointLimits[slug][axis];
  return slug.endsWith("knee") && axis === "x" ? [-max, -min] : [min, max];
}

export const defaultScene: WorkshopScene = {
  durationMs: 3200,
  cameraAngle: "three_quarter",
  equipment: { slug: "dumbbell-pair", x: 0, y: 0, z: 0, scale: 1 },
  keyframes: [
    { timeMs: 0, poses: { "left-shoulder": { x: 0, y: 0, z: -15 }, "right-shoulder": { x: 0, y: 0, z: 15 } } },
    { timeMs: 1600, poses: { "left-shoulder": { x: 0, y: 0, z: -75 }, "right-shoulder": { x: 0, y: 0, z: 75 } } },
    { timeMs: 3200, poses: { "left-shoulder": { x: 0, y: 0, z: -15 }, "right-shoulder": { x: 0, y: 0, z: 15 } } },
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
    // Older scenes retain their automatic grip until a wrist is authored.
    if ((slug.endsWith("wrist") || slug.endsWith("ankle")) && !frames.some(frame => frame.poses[slug])) continue;
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
