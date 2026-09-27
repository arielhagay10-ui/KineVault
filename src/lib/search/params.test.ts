import { describe, expect, it } from "vitest";
import { encodeCursor, nextPageUrl, parseExploreParams } from "./params";

describe("Explore URL parameters", () => {
  it("keeps repeated filters and applies all-value groups", () => {
    const parsed = parseExploreParams({
      jointAction: ["shoulder-abduction", "scapular-upward-rotation"],
      equipment: "cable",
      muscle: ["lateral-deltoid", "lateral-deltoid"],
      primaryMuscle: "lateral-deltoid",
      mechanic: "isolation",
      bodyPosition: "standing",
    });
    expect(parsed?.jointActions).toEqual(["shoulder-abduction", "scapular-upward-rotation"]);
    expect(parsed?.muscles).toEqual(["lateral-deltoid"]);
    expect(parsed?.equipment).toEqual(["cable"]);
    expect(parsed?.primaryMuscles).toEqual(["lateral-deltoid"]);
    expect(parsed?.mechanics).toEqual(["isolation"]);
    expect(parsed?.bodyPositions).toEqual(["standing"]);
  });

  it("rejects malformed or excessive filters", () => {
    expect(parseExploreParams({ jointAction: "shoulder abduction" })).toBeNull();
    expect(parseExploreParams({ muscle: Array(21).fill("lateral-deltoid") })).not.toBeNull();
    expect(parseExploreParams({ muscle: Array.from({ length: 21 }, (_, i) => `muscle-${i}`) })).toBeNull();
    expect(parseExploreParams({ resistanceProfile: "lengthened-bias" })).toBeNull();
    expect(parseExploreParams({ mechanic: "hybrid" })).toBeNull();
  });

  it("round-trips a cursor with its active filters", () => {
    const params = parseExploreParams({ jointAction: ["shoulder-abduction", "scapular-upward-rotation"], sort: "newest" });
    expect(params).not.toBeNull();
    if (!params) return;
    const cursor = {
      sort: "newest" as const,
      id: "00000000-0000-4000-8000-000000000001",
      publishedAt: "2026-09-27T10:00:00.000Z",
    };
    const url = new URL(nextPageUrl(params, cursor), "https://kinevault.example");
    expect(url.searchParams.get("cursor")).toBe(encodeCursor(cursor));
    expect(url.searchParams.getAll("jointAction")).toEqual(["shoulder-abduction", "scapular-upward-rotation"]);
    expect(parseExploreParams({
      jointAction: url.searchParams.getAll("jointAction"),
      sort: url.searchParams.get("sort") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
    })?.cursor).toEqual(cursor);
  });
});
