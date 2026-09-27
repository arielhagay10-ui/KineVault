import { describe, expect, it } from "vitest";
import { parsePrivateExerciseForm } from "./schema";

describe("private exercise form", () => {
  it("keeps normalized taxonomy choices", () => {
    const form = new FormData();
    form.set("name", "  Cable Lateral Raise  ");
    form.append("primaryMuscle", "lateral-deltoid");
    form.append("primaryMuscle", "lateral-deltoid");
    form.append("jointAction", "shoulder-abduction");
    form.append("equipment", "cable");
    const parsed = parsePrivateExerciseForm(form);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.name).toBe("Cable Lateral Raise");
    expect(parsed.data.primaryMuscles).toEqual(["lateral-deltoid"]);
  });

  it("rejects a muscle assigned to two roles", () => {
    const form = new FormData();
    form.set("name", "Private Raise");
    form.append("primaryMuscle", "lateral-deltoid");
    form.append("secondaryMuscle", "lateral-deltoid");
    expect(parsePrivateExerciseForm(form).success).toBe(false);
  });
});
