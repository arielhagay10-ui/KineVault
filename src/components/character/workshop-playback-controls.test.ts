import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { blankWorkshopScene } from "@/lib/motion/workshop";
import { WorkshopPlaybackControls } from "./workshop-playback-controls";

function controls(firstPoseRecorded: boolean, scene = blankWorkshopScene) {
  return renderToStaticMarkup(createElement(WorkshopPlaybackControls, {
    scene, timeMs: scene.keyframes[1].timeMs,
    selectedFrame: 1, firstPoseRecorded, playing: false, speed: 1, disabled: false,
    demonstrationCaption: null, poseSaved: false,
    onPlayingChange() {}, onSpeedChange() {}, onTimeChange() {}, onFrameChange() {}, onSavePose() {},
  }));
}

describe("workshop capture guidance", () => {
  it("explains the missing start beside the disabled capture control for touch and keyboard users", () => {
    const html = controls(false);
    expect(html).toMatch(/aria-describedby="([^"]+)"/);
    expect(html).toMatch(/<p[^>]*>Capture the start before the finish\.<\/p>/);
  });

  it("does not report a missing start once it has been captured", () => {
    expect(controls(true)).not.toContain("Capture the start before the finish.");
  });

  it("identifies an intermediate pose by its timestamp", () => {
    const scene = structuredClone(blankWorkshopScene);
    scene.keyframes[1].timeMs = 1070;
    expect(controls(true, scene)).toContain("Pose 2 · 1.07s");
  });
});
