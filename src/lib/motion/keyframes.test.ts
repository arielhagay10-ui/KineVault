import { describe, expect, it } from "vitest";
import { lateralRaiseMotion, sampleShoulderMotion } from "./keyframes";

describe("sampleShoulderMotion", () => {
  it("reaches the raised pose and loops back to its starting pose", () => {
    const start = sampleShoulderMotion(lateralRaiseMotion, 0);
    const top = sampleShoulderMotion(lateralRaiseMotion, 0.4);
    const end = sampleShoulderMotion(lateralRaiseMotion, 1);
    expect(Math.abs(top.leftShoulderZ)).toBeGreaterThan(1);
    expect(Math.abs(top.rightShoulderZ)).toBeGreaterThan(1);
    expect(end).toEqual(start);
  });

  it("interpolates joint poses rather than snapping between them", () => {
    const inBetween = sampleShoulderMotion(lateralRaiseMotion, 0.175);
    expect(inBetween.leftShoulderZ).toBeLessThan(0);
    expect(inBetween.leftShoulderZ).toBeGreaterThan(-1.28);
  });
});
