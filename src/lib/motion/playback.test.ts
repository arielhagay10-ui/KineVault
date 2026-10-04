import { expect, it } from "vitest";
import { MotionPlaybackClock } from "./playback";

it("preserves seek/pause, loops and changes speed without jumping", () => {
  const clock = new MotionPlaybackClock(); clock.configure(2400);
  clock.seek(2000); clock.setPlaying(true); clock.tick(100); clock.tick(600);
  expect(clock.timeMs).toBe(100);
  clock.setPlaying(false); clock.tick(1600); expect(clock.timeMs).toBe(100);
  clock.configure(2400, 2); clock.setPlaying(true); clock.tick(2000); clock.tick(2100);
  expect(clock.timeMs).toBe(300);
  clock.seek(2400); expect(clock.timeMs).toBe(2400);
  clock.tick(2200); clock.tick(2250); expect(clock.timeMs).toBe(100);
});

it("notifies demand canvases and unsubscribes cleanly", () => {
  const clock = new MotionPlaybackClock(); let calls = 0;
  const unsubscribe = clock.subscribe(() => calls++);
  clock.seek(0); clock.setPlaying(true); clock.tick(1); expect(calls).toBe(3);
  unsubscribe(); clock.tick(2); expect(calls).toBe(3);
});
