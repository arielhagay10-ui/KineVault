import { randomUUID } from "node:crypto";
import { automaticWeightTransform } from "../../src/lib/motion/automatic-weight-grip";
import { createStudioObject } from "../../src/lib/motion/studio";
import { editHeldWeightPose, sampleHeldWeightPose } from "../../src/lib/motion/held-weight-pose";
import { jointEditChanges } from "../../src/lib/motion/joint-edit";
import { blankWorkshopScene, identityTransform, type WorkshopScene } from "../../src/lib/motion/workshop";

export function sharedDumbbellScene(variant: "goblet" | "pullover", attached = false) {
  const weight = { ...createStudioObject("dumbbell", randomUUID(), 0), attachment: attached ? "both" as const : "none" as const };
  const bench = { ...createStudioObject("bench", randomUUID(), 0), ...identityTransform, benchAngle: 0 };
  const scene: WorkshopScene = { ...structuredClone(blankWorkshopScene), motionStyle: variant === "goblet" ? "squat" : "free",
    studio: { body: identityTransform, objects: variant === "goblet" ? [weight] : [bench, weight],
      ...(variant === "pullover" ? { seating: { benchId: bench.id, facing: "supine" as const } } : {}) },
    keyframes: [0, 1600, 3200].map(timeMs => ({ timeMs, poses: variant === "goblet" ? {
      torso: { x: timeMs === 1600 ? 35 : 0, y: 0, z: 0 },
      "left-elbow": { x: 85, y: 0, z: 0 }, "right-elbow": { x: 85, y: 0, z: 0 },
      "left-hip": { x: timeMs === 1600 ? 60 : 0, y: 0, z: 0 }, "right-hip": { x: timeMs === 1600 ? 60 : 0, y: 0, z: 0 },
      "left-knee": { x: timeMs === 1600 ? -90 : 0, y: 0, z: 0 }, "right-knee": { x: timeMs === 1600 ? -90 : 0, y: 0, z: 0 },
    } : {
      "left-shoulder": { x: timeMs === 1600 ? -150 : -90, y: 0, z: 0 }, "right-shoulder": { x: timeMs === 1600 ? -150 : -90, y: 0, z: 0 },
      "left-elbow": { x: 25, y: 0, z: 0 }, "right-elbow": { x: 25, y: 0, z: 0 },
    } })) };
  if (attached) weight.frames = scene.keyframes.map(({ timeMs }) => ({ timeMs, ...automaticWeightTransform(identityTransform, weight, "both", scene, timeMs) }));
  return { scene, weight };
}

export function nearLimitPulloverScene() {
  const { scene, weight } = sharedDumbbellScene("pullover", true);
  weight.poseDriver = "arm";
  scene.keyframes = scene.keyframes.map(frame => ({ ...frame, poses: Object.fromEntries((["left", "right"] as const).flatMap(side => {
    const peak = frame.timeMs === 1600, sign = side === "left" ? 1 : -1;
    return [
      [`${side}-shoulder`, { x: peak ? -75 : -160, y: (peak ? -80 : -81.18) * sign, z: -15.12 * sign }],
      [`${side}-elbow`, { x: 26.08, y: 0, z: 0 }],
      [`${side}-wrist`, { x: peak ? 66.61 : 11.2, y: peak ? 43.57 : -19.88, z: 17.93 * sign }],
    ];
  })) }));
  return { scene, weight };
}

export function changingElbowPulloverScene(side?: "left" | "right") {
  const fixture = sharedDumbbellScene("pullover", true), weight = fixture.weight;
  let scene = fixture.scene;
  for (const frame of scene.keyframes) for (const hand of ["left", "right"] as const) {
    frame.poses[`${hand}-elbow`] = { x: frame.timeMs === 1600 ? 85 : 0, y: 0, z: 0 };
  }
  weight.frames = scene.keyframes.map(frame => ({ timeMs: frame.timeMs, ...automaticWeightTransform(scene.studio!.body, weight, "both", scene, frame.timeMs) }));
  if (side) {
    for (const [index, x] of [[0, -90], [1, -150]] as const) {
      const angles = sampleHeldWeightPose(scene, index * 1600)[`${side}-shoulder`]!;
      scene = editHeldWeightPose(scene, index, index === 0 ? "all" : "selected", jointEditChanges(`${side}-shoulder`, { ...angles, x }, true), side, "x");
    }
  }
  return { scene, weight: scene.studio!.objects[1] };
}
