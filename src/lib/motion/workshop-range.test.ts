import { expect, it } from "vitest";
import { WorkshopRangePreview } from "./workshop-range";
import { WorkshopGestureScene } from "./workshop-gesture";
import { blankWorkshopScene } from "./workshop";

it("holds each local range change until the gesture ends and restores on cancellation", () => {
  const gesture = new WorkshopGestureScene();
  const range = new WorkshopRangePreview(.5);
  const unsubscribe = gesture.subscribe(event => { if (event.kind === "finish") range.reset(); });
  gesture.begin(blankWorkshopScene, 0);
  range.change(.6);
  range.change(.7);
  expect(range.getSnapshot()).toBe(.7);
  range.configure(.5);
  expect(range.getSnapshot()).toBe(.7);
  gesture.finish(true);
  expect(range.getSnapshot()).toBe(.5);
  unsubscribe();
});

it("accepts completed values and starts the next keyboard increment from that value", () => {
  const range = new WorkshopRangePreview(20);
  range.change(21);
  range.reset();
  range.configure(21);
  expect(range.getSnapshot()).toBe(21);
  range.change(range.getSnapshot() + 1);
  expect(range.getSnapshot()).toBe(22);
  range.reset();
  expect(range.getSnapshot()).toBe(21);
});

it("notifies only when the displayed value changes and removes listeners", () => {
  const range = new WorkshopRangePreview(1);
  const values: number[] = [];
  const unsubscribe = range.subscribe(() => values.push(range.getSnapshot()));
  range.change(2); range.change(2); range.configure(1); range.reset();
  expect(values).toEqual([2, 1]);
  unsubscribe(); range.change(3);
  expect(values).toEqual([2, 1]);
});
