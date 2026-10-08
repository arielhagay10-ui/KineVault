import { expect, it } from "vitest";
import { blankWorkshopScene, type WorkshopScene } from "./workshop";
import { resetWorkshopJoints } from "./workshop-pose";

it("resets movable joints in one pose and preserves equipment-controlled joints and other poses", () => {
  const scene: WorkshopScene = { ...blankWorkshopScene, keyframes: [0, 3200].map(timeMs => ({ timeMs, poses: {
    "left-elbow": { x: 70, y: 0, z: 0 }, "right-knee": { x: -45, y: 0, z: 0 }, torso: { x: 20, y: 0, z: 0 },
  } })) };
  const before = structuredClone(scene);
  const reset = resetWorkshopJoints(scene, 0, "selected", ["left-elbow"]);
  expect(reset.keyframes[0].poses).toEqual({ "left-elbow": { x: 70, y: 0, z: 0 } });
  expect(reset.keyframes[1]).toEqual(scene.keyframes[1]);
  expect(reset.studio).toEqual(scene.studio);
  expect(scene).toEqual(before);
  expect(resetWorkshopJoints(scene, 0, "all", []).keyframes.map(frame => frame.poses)).toEqual([{}, {}]);
});
