import type { WorkshopScene } from "./workshop";

// One simultaneous supinated rep: quiet upper arms, upright torso, planted feet.
// Cosine-spaced angles slow the turnarounds without changing other saved demos.
export const seatedCurlScene: WorkshopScene = {
  motionStyle: "seated-curl",
  durationMs: 4800,
  cameraAngle: "three_quarter",
  equipment: { slug: "dumbbell-pair", x: 0, y: 0, z: 0, scale: 1 },
  keyframes: Array.from({ length: 17 }, (_, index) => {
    const flexion = 10 + 105 * (1 - Math.cos(index * Math.PI / 8)) / 2;
    return { timeMs: index * 300, poses: {
      "left-shoulder": { x: 0, y: 0, z: -5 },
      "right-shoulder": { x: 0, y: 0, z: 5 },
      "left-elbow": { x: flexion, y: 0, z: 0 },
      "right-elbow": { x: flexion, y: 0, z: 0 },
    } };
  }),
  annotations: [
    { startMs: 0, endMs: 2400, label: "Curl", note: "Keep palms supinated and upper arms beside the torso.", jointAction: "elbow-flexion" },
    { startMs: 2400, endMs: 4800, label: "Lower", note: "Lower both weights under control without rocking.", jointAction: null },
  ],
};
