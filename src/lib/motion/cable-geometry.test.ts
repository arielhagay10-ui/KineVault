import { Vector3 } from "three";
import { expect, it } from "vitest";
import { createCableGeometry, updateCableGeometry } from "./cable-geometry";

it("switches handle to rope and back without losing branches or retaining segments", () => {
  const geometry = createCableGeometry(); const buffer = geometry.getAttribute("position");
  const points = Array.from({ length: 6 }, (_, i) => new Vector3(i, i + 1, 0));
  for (const count of [2, 6, 2, 6]) {
    updateCableGeometry(geometry, points.slice(0, count));
    expect(geometry.getAttribute("position")).toBe(buffer);
    expect(buffer.count).toBe(6); expect(geometry.drawRange.count).toBe(count);
    expect(buffer.getX(count - 1)).toBe(count - 1);
  }
  geometry.dispose();
});
