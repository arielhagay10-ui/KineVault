import { describe, expect, it } from "vitest";
import { formSnapshot } from "./form-state";

describe("metadata dirty state", () => {
  it("ignores search controls and action transport fields", () => {
    const data = new FormData();
    data.set("name", "Cable raise");
    data.set("$ACTION_ID_test", "");
    expect(formSnapshot(data)).toBe('[["name","Cable raise"]]');
  });
  it("detects classification changes and becomes clean when reverted", () => {
    const data = new FormData();
    data.set("name", "Cable raise");
    data.append("primaryMuscle", "lateral-deltoid");
    const baseline = formSnapshot(data);
    data.append("primaryMuscle", "biceps-brachii");
    expect(formSnapshot(data)).not.toBe(baseline);
    data.delete("primaryMuscle");
    data.append("primaryMuscle", "lateral-deltoid");
    expect(formSnapshot(data)).toBe(baseline);
  });
  it("treats equivalent repeated selections as unchanged", () => {
    const first = new FormData(); const second = new FormData();
    first.append("equipment", "cable"); first.append("equipment", "dumbbell");
    second.append("equipment", "dumbbell"); second.append("equipment", "cable");
    expect(formSnapshot(first)).toBe(formSnapshot(second));
  });
});
