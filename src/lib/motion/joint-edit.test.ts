import { expect, it } from "vitest";
import { jointEditChanges } from "./joint-edit";

it("edits both shoulders with mirrored anatomical rotation", () => {
  expect(jointEditChanges("left-shoulder", { x: 60, y: 15, z: -20 }, true)).toEqual({
    "left-shoulder": { x: 60, y: 15, z: -20 },
    "right-shoulder": { x: 60, y: -15, z: 20 },
  });
});

it("keeps wrist turn and flexion anatomical when editing both sides", () => {
  expect(jointEditChanges("right-wrist", { x: 30, y: 10, z: 15 }, true)).toEqual({
    "right-wrist": { x: 30, y: 10, z: 15 },
    "left-wrist": { x: 30, y: 10, z: -15 },
  });
});

it("changes only the chosen joint in single-side and torso edits", () => {
  const angles = { x: 10, y: 0, z: 0 };
  expect(jointEditChanges("right-elbow", angles, false)).toEqual({ "right-elbow": angles });
  expect(jointEditChanges("torso", angles, true)).toEqual({ torso: angles });
});
