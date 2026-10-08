import { describe, expect, it } from "vitest";
import { summarizeDeviceFrames, proposeDeviceBudget, calibrateDeviceCaptures, checkDeviceBudget, deviceCaptureSchema } from "./device-profile";

describe("rendered-frame device profiles", () => {
  it("measures actual rendered intervals and nearest-rank percentiles", () => {
    expect(summarizeDeviceFrames([100, 116, 136, 160, 200])).toEqual({
      frames: 4, elapsedMs: 100, medianMs: 20, p95Ms: 40, p99Ms: 40, maximumMs: 40,
    });
  });

  it("rejects empty, unordered and non-finite captures instead of certifying them", () => {
    for (const frames of [[], [1], [2, 1], [1, NaN], [1, 1]]) {
      expect(() => summarizeDeviceFrames(frames)).toThrow();
    }
  });

  it("requires three measured physical runs with the same device and scenario", () => {
    const run = { device: "Phone A", scenario: "playback", workload: "lateral-raise", physical: true, renderer: "Apple GPU", p95Ms: 20 };
    expect(proposeDeviceBudget([run, run, { ...run, p95Ms: 25 }])).toEqual({
      device: "Phone A", scenario: "playback", workload: "lateral-raise", renderer: "Apple GPU", runs: 3, p95Ms: 30,
      observedP95Ms: 25, needsLodEvaluation: false, status: "proposed",
    });
    expect(() => proposeDeviceBudget([run, run])).toThrow();
    expect(() => proposeDeviceBudget([run, run, { ...run, device: "Phone B" }])).toThrow();
    expect(() => proposeDeviceBudget([run, run, { ...run, physical: false }])).toThrow();
  });

  it("rejects software GPUs and flags slow physical playback for LOD investigation", () => {
    const run = { device: "Phone A", scenario: "playback", workload: "lateral-raise", physical: true, renderer: "Adreno 610", p95Ms: 50 };
    expect(proposeDeviceBudget([run, run, run]).needsLodEvaluation).toBe(true);
    for (const renderer of ["SwiftShader", "llvmpipe", "Software Rasterizer", "unknown"]) {
      expect(() => proposeDeviceBudget(Array.from({ length: 3 }, () => ({ ...run, renderer })))).toThrow();
    }
  });

  it("rejects repeated captures and changes to build, browser or render dimensions", () => {
    const capture = { device: "Phone A", scenario: "playback", workload: "lateral-raise", physical: true, renderer: "Apple GPU", valid: true,
      build: "revision", userAgent: "Safari", viewport: { width: 390, height: 844, pixelRatio: 3 },
      canvas: { width: 780, height: 640, pixelRatio: 2 },
      frames: { frames: 600, elapsedMs: 15000, p95Ms: 20 } };
    const runs = [0, 1, 2].map(i => ({ ...capture, captureId: `00000000-0000-4000-8000-00000000000${i}`,
      measuredAt: `2026-10-06T18:00:${i}0.000Z` }));
    expect(calibrateDeviceCaptures(runs).p95Ms).toBe(24);
    expect(() => calibrateDeviceCaptures([runs[0], runs[0], runs[0]])).toThrow();
    for (const change of [{ build: "other" }, { userAgent: "Chrome" },
      { viewport: { width: 844, height: 390, pixelRatio: 3 } }, { valid: false },
      { canvas: { width: 390, height: 320, pixelRatio: 1 } },
      { frames: { frames: 2, elapsedMs: 15000, p95Ms: 20 } }]) {
      expect(() => calibrateDeviceCaptures([runs[0], runs[1], { ...runs[2], ...change }])).toThrow();
    }
  });

  it("leaves enough capture time for ten seconds of rendered intervals", () => {
    expect(deviceCaptureSchema.safeParse({ device: "Phone A", physical: true, scenario: "playback",
      workload: "lateral-raise", build: "revision", durationMs: 10000 }).success).toBe(false);
    expect(deviceCaptureSchema.safeParse({ device: "Phone A", physical: true, scenario: "playback",
      workload: "lateral-raise", build: "revision", durationMs: 12000 }).success).toBe(true);
  });

  it("enforces approved budgets only for matching hardware and rendering conditions", () => {
    const captures = [0, 1, 2].map(i => ({ device: "Phone A", physical: true, scenario: "playback", workload: "lateral-raise", renderer: "Apple GPU",
      valid: true, build: "new-build", userAgent: "Safari", viewport: { width: 390, height: 844, pixelRatio: 3 },
      canvas: { width: 780, height: 640, pixelRatio: 2 }, captureId: `00000000-0000-4000-8000-00000000000${i}`,
      measuredAt: `2026-10-06T18:00:${i}0.000Z`, frames: { frames: 600, elapsedMs: 15000, p95Ms: 20 + i } }));
    const budget = { ...captures[0], build: "old-build", status: "approved", p95Ms: 24 };
    expect(checkDeviceBudget(captures, budget).passed).toBe(true);
    expect(checkDeviceBudget(captures, { ...budget, p95Ms: 21 }).passed).toBe(false);
    expect(() => checkDeviceBudget(captures, { ...budget, status: "proposed" })).toThrow();
    expect(() => checkDeviceBudget(captures, { ...budget, renderer: "Other GPU" })).toThrow();
    expect(() => checkDeviceBudget(captures, { ...budget, workload: "simpler-scene" })).toThrow();
    expect(() => checkDeviceBudget(captures, { ...budget, canvas: { width: 390, height: 320, pixelRatio: 1 } })).toThrow();
  });
});
