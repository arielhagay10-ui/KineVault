import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MotionMetrics } from "./motion-metrics";

const canvas = vi.hoisted(() => ({
  frame: undefined as (() => void) | undefined,
  effects: [] as (() => void)[],
}));

vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useEffect: (effect: () => void) => canvas.effects.push(effect),
}));
vi.mock("@react-three/fiber", () => ({
  useFrame: (frame: () => void) => { canvas.frame = frame; },
  useThree: (select: (state: unknown) => unknown) => select({
    gl: { getPixelRatio: () => 1, info: { render: { calls: 1 }, memory: { geometries: 1, textures: 1 } } },
    camera: { position: { toArray: () => [0, 0, 5] } },
  }),
}));

let now: number;
let pending: FrameRequestCallback[];
beforeEach(() => {
  now = 1000;
  pending = [];
  canvas.effects = [];
  canvas.frame = undefined;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("window", { location: { search: "" } });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => pending.push(callback));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function mount(onMetrics?: () => void, solveStartedRef?: { current: number | null }) {
  const dataset: Record<string, string> = {};
  const target = {
    dataset,
    setAttribute(name: string, value: string) {
      const key = name.replace(/^data-/, "").replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
      dataset[key] = value;
    },
  } as unknown as HTMLDivElement;
  const solves = { current: 0 };
  renderToStaticMarkup(createElement(MotionMetrics, { wrapper: { current: target }, solvesRef: solves, solveStartedRef, onMetrics }));
  canvas.effects.forEach(effect => effect());
  return { target, solves };
}

function renderFrame() {
  if (!canvas.frame) throw new Error("Metrics did not register a frame callback");
  canvas.frame();
}
function finishFrame() {
  const callbacks = pending.splice(0);
  callbacks.forEach(callback => callback(now));
}

it("publishes the final demand-frame solve inside the metrics throttle interval", () => {
  const onMetrics = vi.fn();
  const { target, solves } = mount(onMetrics);
  renderFrame(); finishFrame();
  expect(target.dataset.poseSolves).toBe("0");

  // Pause renders once shortly after a metrics sample, then demand rendering stops.
  now += 100;
  solves.current = 1;
  renderFrame(); finishFrame();
  expect(target.dataset.poseSolves).toBe("1");
  expect(onMetrics).toHaveBeenCalledTimes(1);

  // A later camera frame must not expose that old solve as new camera work.
  const baseline = Number(target.dataset.poseSolves);
  now += 600;
  renderFrame(); finishFrame();
  expect(Number(target.dataset.poseSolves) - baseline).toBe(0);
  expect(onMetrics).toHaveBeenCalledTimes(2);
});

it("keeps per-frame counters disabled outside opt-in profiling", () => {
  const { target, solves } = mount();
  solves.current = 1;
  renderFrame(); finishFrame();
  expect(target.dataset.poseSolves).toBeUndefined();
  expect(pending).toHaveLength(0);
});

it("counts completed solve time once and counts camera frames separately", () => {
  const started = { current: 994 as number | null };
  const { target } = mount(vi.fn(), started);
  renderFrame(); finishFrame();
  expect(Number(target.dataset.poseSolveMs)).toBe(6);
  expect(started.current).toBeNull();
  now += 16;
  renderFrame(); finishFrame();
  expect(Number(target.dataset.poseSolveMs)).toBe(6);
  expect(Number(target.dataset.renderFrames)).toBe(2);
  started.current = now - 4;
  renderFrame(); finishFrame();
  expect(Number(target.dataset.poseSolveMs)).toBe(10);
});
