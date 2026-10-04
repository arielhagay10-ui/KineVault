import { describe, expect, it } from "vitest";
import { readWorkshopTutorial, tutorialStorageKey } from "./workshop-tutorial";

describe("workshop tutorial eligibility", () => {
  it("starts only for someone creating their first exercise", () => {
    expect(readWorkshopTutorial(null, true)).toEqual({ open: true, step: 0 });
    expect(readWorkshopTutorial(null, false)).toEqual({ open: false, step: 0 });
  });
  it("keeps a skipped or completed tutorial closed on later visits", () => {
    expect(readWorkshopTutorial('{"open":false,"step":2}', true)).toEqual({ open: false, step: 2 });
    expect(readWorkshopTutorial('{"open":true,"step":3}', false)).toEqual({ open: false, step: 3 });
  });
  it("resumes the first exercise tutorial without losing its step", () => {
    expect(readWorkshopTutorial('{"open":true,"step":3}', true)).toEqual({ open: true, step: 3 });
  });
  it("recovers from invalid storage without returning invalid navigation", () => {
    for (const raw of ["broken", "null", '{"open":true,"step":-1}', '{"open":true,"step":99}', '{"open":"yes","step":0}']) {
      expect(readWorkshopTutorial(raw, true)).toEqual({ open: true, step: 0 });
    }
  });
  it("keeps tutorial progress separate for each account", () => {
    expect(tutorialStorageKey("first")).not.toBe(tutorialStorageKey("second"));
  });
});
