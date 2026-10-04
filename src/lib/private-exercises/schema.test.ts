import { describe, expect, it } from "vitest";
import { parsePrivateExerciseForm, parsePrivateMetadata } from "./schema";

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
  it("keeps strict save limits separate from recoverable draft limits", () => {
    const form = new FormData(); form.set("name", "Recovery boundaries");
    for (let index = 0; index < 21; index++) form.append("jointAction", `action-${index}`);
    expect(parsePrivateExerciseForm(form).success).toBe(false);
    const recovered = parsePrivateExerciseForm(form, true);
    expect(recovered.success).toBe(true);
    if (!recovered.success) return;
    form.set("aliases", "a".repeat(161));
    expect(parsePrivateMetadata(form, recovered.data).success).toBe(false);
    expect(parsePrivateMetadata(form, recovered.data, true).success).toBe(true);
  });

  it("preserves action roles and validates detailed fields", () => {
    const form = new FormData();
    form.set("name", "Detailed raise");
    form.append("jointAction", "scapular-upward-rotation");
    form.set("actionRole.scapular-upward-rotation", "secondary");
    form.set("execution_instructions", "  Raise the arm.  ");
    form.append("attachments", "d-handle");
    const basic = parsePrivateExerciseForm(form);
    expect(basic.success).toBe(true);
    if (!basic.success) return;
    const metadata = parsePrivateMetadata(form, basic.data);
    expect(metadata.success).toBe(true);
    if (metadata.success) {
      expect(metadata.data.joint_actions).toEqual([{ slug: "scapular-upward-rotation", role: "secondary" }]);
      expect(metadata.data.execution_instructions).toBe("Raise the arm.");
      expect(metadata.data.attachments).toEqual(["d-handle"]);
    }
    form.set("laterality", "arbitrary");
    expect(parsePrivateMetadata(form, basic.data).success).toBe(false);
  });
});
