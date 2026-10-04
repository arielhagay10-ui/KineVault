import { describe, expect, it } from "vitest";
import { readMetadataRecovery, sameMetadata, matchesSavedMetadata } from "./metadata-recovery";

describe("metadata recovery", () => {
  const payload = JSON.stringify({ baseline: "original", values: [["privateId", "2d4df023-cb0c-4f7d-8067-527d42a0fb75"], ["name", "Recovered raise"], ["primaryMuscle", "lateral-deltoid"]], updatedAt: 1000 });
  it("recovers validated classifications for the exact draft", () => {
    const result = readMetadataRecovery(payload, "2d4df023-cb0c-4f7d-8067-527d42a0fb75", 2000);
    expect(result?.initial.name).toBe("Recovered raise");
    expect(result?.metadata.muscles).toEqual([{ slug: "lateral-deltoid", role: "primary" }]);
  });
  it("rejects another draft and expired or malformed copies", () => {
    expect(readMetadataRecovery(payload, "2d4df023-cb0c-4f7d-8067-527d42a0fb76", 2000)).toBeNull();
    expect(readMetadataRecovery(payload, "2d4df023-cb0c-4f7d-8067-527d42a0fb75", 700000000)).toBeNull();
    expect(readMetadataRecovery("invalid", "2d4df023-cb0c-4f7d-8067-527d42a0fb75", 2000)).toBeNull();
  });
  it("recognizes saved metadata despite database property and taxonomy ordering", () => {
    expect(sameMetadata({ name: "Raise", equipment: [{ slug: "cable", role: "required" }, { slug: "bench", role: "support" }] },
      { equipment: [{ role: "support", slug: "bench" }, { role: "required", slug: "cable" }], name: "Raise" })).toBe(true);
    expect(sameMetadata({ name: "Raise" }, { name: "Edited raise" })).toBe(false);
  });
  it("accepts derived parent joints after saving while retaining changed fields", () => {
    const result = readMetadataRecovery(payload, "2d4df023-cb0c-4f7d-8067-527d42a0fb75", 2000)!;
    const saved = { ...result.metadata, joints: [{ slug: "shoulder", role: "primary" as const }] };
    expect(matchesSavedMetadata(result.metadata, saved)).toBe(true);
    expect(matchesSavedMetadata({ ...result.metadata, name: "Different" }, saved)).toBe(false);
  });
  it("retains incomplete names and conflicting muscle edits until the owner corrects them", () => {
    const invalid = JSON.parse(payload);
    invalid.values[1][1] = "X";
    invalid.values.push(["secondaryMuscle", "lateral-deltoid"]);
    const result = readMetadataRecovery(JSON.stringify(invalid), "2d4df023-cb0c-4f7d-8067-527d42a0fb75", 2000);
    expect(result?.initial.name).toBe("X");
    expect(result?.metadata.muscles).toEqual([{ slug: "lateral-deltoid", role: "primary" }, { slug: "lateral-deltoid", role: "secondary" }]);
  });
  it("retains aliases and selections that require correction before saving", () => {
    const invalid = JSON.parse(payload);
    invalid.values.push(["aliases", "a".repeat(161) + "\n" + Array.from({ length: 21 }, (_, index) => `Alias ${index}`).join("\n")]);
    for (let index = 0; index < 21; index++) invalid.values.push(["jointAction", `action-${index}`]);
    const result = readMetadataRecovery(JSON.stringify(invalid), "2d4df023-cb0c-4f7d-8067-527d42a0fb75", 2000);
    expect(result?.metadata.aliases).toHaveLength(22);
    expect(result?.metadata.aliases[0]).toHaveLength(161);
    expect(result?.initial.jointActions).toHaveLength(21);
  });
});
