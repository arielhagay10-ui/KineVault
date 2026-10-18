import { afterEach, describe, expect, it, vi } from "vitest";
import { blankWorkshopScene, type WorkshopScene } from "./workshop";
import { RecoveryCheckpoint, WorkshopGestureScene } from "./workshop-gesture";

const sceneAt = (durationMs: number): WorkshopScene => ({ ...blankWorkshopScene, durationMs });

describe("workshop gesture transactions", () => {
  it("publishes live previews and returns exactly one completed transaction", () => {
    const gesture = new WorkshopGestureScene();
    const original = sceneAt(2400);
    const events: WorkshopScene[] = [];
    gesture.subscribe(event => events.push(event.scene));
    expect(gesture.begin(original, 1200)).toBe(true);
    expect(gesture.begin(sceneAt(1000), 0)).toBe(false);
    for (let i = 0; i < 100; i++) gesture.update(sceneAt(2500 + i));
    expect(gesture.getScene()?.durationMs).toBe(2599);
    expect(gesture.getTimeMs()).toBe(1200);
    expect(gesture.finish()).toMatchObject({ before: original, scene: { durationMs: 2599 }, changed: true, timeMs: 1200 });
    expect(gesture.finish()).toBeNull();
    expect(gesture.getScene()).toBeNull();
    expect(events).toHaveLength(101);
  });

  it("publishes the original scene on cancellation and leaves no undo transaction", () => {
    const gesture = new WorkshopGestureScene();
    const original = sceneAt(2400);
    let recovered: WorkshopScene | undefined;
    gesture.subscribe(event => { if (event.kind === "finish") recovered = event.scene; });
    gesture.begin(original, 0);
    gesture.update(sceneAt(3000));
    expect(gesture.finish(true)).toMatchObject({ scene: original, changed: false });
    expect(recovered).toBe(original);
    expect(gesture.update(sceneAt(3200))).toBe(false);
  });

  it("suppresses history for a gesture that returns to its original scene", () => {
    const gesture = new WorkshopGestureScene();
    gesture.begin(sceneAt(2400), 0);
    gesture.update(sceneAt(3000));
    gesture.update(sceneAt(2400));
    expect(gesture.finish()?.changed).toBe(false);
  });

  it("does not serialize live moves and releases preview subscribers", () => {
    const gesture = new WorkshopGestureScene();
    gesture.begin(sceneAt(2400), 0);
    let notifications = 0;
    const unsubscribe = gesture.subscribe(() => notifications++);
    const next = sceneAt(3000);
    Object.defineProperty(next, "toJSON", { value: () => { throw new Error("serialized live scene"); } });
    expect(() => gesture.update(next)).not.toThrow();
    expect(notifications).toBe(1);
    unsubscribe();
    gesture.finish(true);
    expect(notifications).toBe(1);
  });
});

describe("gesture recovery checkpoints", () => {
  afterEach(() => vi.useRealTimers());

  it("checkpoints continuous moves without postponing recovery until release", () => {
    vi.useFakeTimers();
    const recovered: number[] = [];
    const checkpoint = new RecoveryCheckpoint<number>(value => recovered.push(value), 500);
    for (let i = 0; i < 20; i++) {
      checkpoint.schedule(i);
      vi.advanceTimersByTime(100);
    }
    expect(recovered).toEqual([4, 9, 14, 19]);
  });

  it("flushes the newest value immediately and cancels the trailing write", () => {
    vi.useFakeTimers();
    const recovered: number[] = [];
    const checkpoint = new RecoveryCheckpoint<number>(value => recovered.push(value));
    checkpoint.schedule(1);
    vi.advanceTimersByTime(100);
    checkpoint.flush(2);
    vi.advanceTimersByTime(1000);
    expect(recovered).toEqual([2]);
    checkpoint.schedule(3);
    checkpoint.flush();
    expect(recovered).toEqual([2, 3]);
  });

  it("discards pending work when its owner leaves", () => {
    vi.useFakeTimers();
    const recovered: number[] = [];
    const checkpoint = new RecoveryCheckpoint<number>(value => recovered.push(value));
    checkpoint.schedule(1);
    checkpoint.cancel();
    vi.advanceTimersByTime(1000);
    checkpoint.flush();
    expect(recovered).toEqual([]);
  });
});
