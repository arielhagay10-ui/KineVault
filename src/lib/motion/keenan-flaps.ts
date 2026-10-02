import type { WorkshopScene } from "./workshop";
import { createStudioObject } from "./studio";
import { identityTransform } from "./workshop";

// One upper-arm cuff loads frontal-plane shoulder adduction.
// The other arm rests against the pad; neither elbow changes during the rep.
const benchYaw = -20;
const heading = benchYaw * Math.PI / 180;
export const keenanFlapsScene: WorkshopScene = {
  motionStyle: "free", durationMs: 4800, cameraAngle: "three_quarter", equipment: null,
  studio: {
    body: { ...identityTransform },
    frontalPlane: true,
    seating: { benchId: "00000000-0000-4000-8000-000000000091", facing: "back" },
    presentation: { highlight: "group:lats", isolate: false, view: "three_quarter" },
    objects: [
      { ...createStudioObject("bench", "00000000-0000-4000-8000-000000000091", 0), x: 0, z: 0, benchAngle: 65, rotationY: benchYaw },
      {
        ...createStudioObject("cable-machine", "00000000-0000-4000-8000-000000000093", 1),
        name: "Right cuff cable", x: -1.8 * Math.sin(heading), z: -1.8 * Math.cos(heading), rotationY: benchYaw,
        pulleyHeight: 1.7, cableAttachment: "cuff", cuffPosition: "upper-arm", attachment: "right",
      },
    ],
  },
  keyframes: Array.from({ length: 17 }, (_, step) => {
    const pull = (1 - Math.cos(step * Math.PI / 8)) / 2;
    return { timeMs: step * 300, poses: {
      torso: { x: 0, y: 0, z: 8 },
      "left-shoulder": { x: 0, y: 0, z: -10 },
      "right-shoulder": { x: 0, y: 0, z: 85 - 70 * pull },
      "left-elbow": { x: 100, y: 0, z: 0 }, "right-elbow": { x: 30, y: 0, z: 0 },
      "left-wrist": { x: 0, y: 0, z: 0 }, "right-wrist": { x: 0, y: 0, z: 0 },
    } };
  }),
  annotations: [
    { startMs: 0, endMs: 2400, label: "Pull right arm down", note: "Keep the upper arm in the torso’s frontal plane, chest supported and elbow bend fixed.", jointAction: "shoulder-adduction" },
    { startMs: 2400, endMs: 4800, label: "Return", note: "Return the right upper arm out to the side without lifting or turning the chest.", jointAction: null },
  ],
};
