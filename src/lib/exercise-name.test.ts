import { describe, expect, it } from "vitest";
import { normalizeExerciseName } from "./exercise-name";

describe("normalizeExerciseName", () => {
  it("finds exact candidates despite casing, spacing, and punctuation", () => {
    expect(normalizeExerciseName("  Single-Arm   Cable Lateral Raise! "))
      .toBe(normalizeExerciseName("single arm cable lateral raise"));
  });

  it("keeps distinct variations distinct", () => {
    expect(normalizeExerciseName("Cable Lateral Raise"))
      .not.toBe(normalizeExerciseName("Behind-Body Cable Lateral Raise"));
  });

  it("preserves letters from non-English names for future localization", () => {
    expect(normalizeExerciseName("Élévation latérale"))
      .toBe("élévation latérale");
  });
});
