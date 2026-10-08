import { describe, expect, it } from "vitest";
import { placeTutorialMascot, type TutorialBox } from "./tutorial-placement";

const viewport = { width: 800, height: 600 };
const size = { width: 112, height: 112 };
const overlaps = (a: TutorialBox, b: TutorialBox) => a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;

describe("tutorial mascot placement", () => {
  it.each([
    { target: { left: 16, top: 20, width: 768, height: 44 }, direction: "up" },
    { target: { left: 16, top: 500, width: 768, height: 44 }, direction: "down" },
    { target: { left: 16, top: 250, width: 80, height: 44 }, direction: "left" },
    { target: { left: 700, top: 250, width: 80, height: 44 }, direction: "right" },
  ])("points $direction toward the target without covering it", ({ target, direction }) => {
    const result = placeTutorialMascot(target, size, viewport);
    expect(result?.direction).toBe(direction);
    expect(overlaps(result!, target)).toBe(false);
    expect(result!.left).toBeGreaterThanOrEqual(12);
    expect(result!.top).toBeGreaterThanOrEqual(12);
    expect(result!.left + result!.width).toBeLessThanOrEqual(788);
    expect(result!.top + result!.height).toBeLessThanOrEqual(588);
  });

  it("tries another pointing pose when the fixed instructions occupy its first choice", () => {
    const target = { left: 400, top: 180, width: 280, height: 44 };
    const panel = { left: 350, top: 235, width: 400, height: 260 };
    const result = placeTutorialMascot(target, size, viewport, panel);
    expect(result?.direction).toBe("down");
    expect(overlaps(result!, panel)).toBe(false);
    expect(overlaps(result!, target)).toBe(false);
  });

  it("keeps the pointing character above mobile equipment and out of the fixed bottom panel", () => {
    const target = { left: 16, top: 216, width: 358, height: 324 };
    const panel = { left: 12, top: 572, width: 366, height: 260 };
    const result = placeTutorialMascot(target, { width: 96, height: 96 }, { width: 390, height: 560 }, panel);
    expect(result?.direction).toBe("down");
    expect(result!.top + result!.height).toBeLessThan(target.top);
  });
});
