import { describe, expect, it } from "vitest";
import { PreviewResolution } from "./preview-quality";

describe("adaptive preview resolution", () => {
  it("responds only to consecutive active frames and stays bounded", () => {
    const resolution = new PreviewResolution(1.75);
    for (let index = 0; index < 100; index++) resolution.observe(1000, false);
    expect(resolution.pixelRatio).toBe(1);
    for (let index = 0; index < 240; index++) resolution.observe(80, true);
    expect(resolution.pixelRatio).toBe(.75);
    for (let index = 0; index < 240; index++) resolution.observe(10, true);
    expect(resolution.pixelRatio).toBe(1.75);
  });

  it("discards idle gaps and incomplete sample windows", () => {
    const resolution = new PreviewResolution(2);
    for (let index = 0; index < 29; index++) resolution.observe(80, true);
    resolution.observe(2000, false);
    resolution.observe(80, true);
    expect(resolution.pixelRatio).toBe(1);
    for (let index = 0; index < 28; index++) resolution.observe(80, true);
    expect(resolution.pixelRatio).toBe(1);
    resolution.observe(80, true);
    expect(resolution.pixelRatio).toBe(.75);
  });
});
