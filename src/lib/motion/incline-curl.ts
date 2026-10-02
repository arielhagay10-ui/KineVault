import type { WorkshopScene } from "./workshop";

export const inclineCurlScene: WorkshopScene = {
  motionStyle: "incline-curl", durationMs: 4800, cameraAngle: "three_quarter",
  equipment: { slug: "dumbbell-pair", x: 0, y: 0, z: 0, scale: 1 },
  keyframes: Array.from({ length: 17 }, (_, index) => ({ timeMs: index * 300, poses: {
    // Counter the reclined torso so upper arms hang in gravity's direction.
    "left-shoulder": { x: 45, y: 0, z: -5 }, "right-shoulder": { x: 45, y: 0, z: 5 },
    "left-elbow": { x: 10 + 105 * (1 - Math.cos(index * Math.PI / 8)) / 2, y: 0, z: 0 },
    "right-elbow": { x: 10 + 105 * (1 - Math.cos(index * Math.PI / 8)) / 2, y: 0, z: 0 },
  } })),
  annotations: [
    { startMs: 0, endMs: 2400, label: "Curl", note: "Keep the back on the pad and upper arms hanging beside the bench.", jointAction: "elbow-flexion" },
    { startMs: 2400, endMs: 4800, label: "Lower", note: "Lower both weights with straight wrists and no shoulder swing.", jointAction: null },
  ],
};
