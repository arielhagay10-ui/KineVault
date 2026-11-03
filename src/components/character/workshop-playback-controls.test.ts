import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { blankWorkshopScene } from "@/lib/motion/workshop";
import { WorkshopPlaybackControls, type WorkshopPoseState } from "./workshop-playback-controls";

function controls(firstPoseRecorded: boolean, scene = blankWorkshopScene, poseStates: WorkshopPoseState[] = [], timeMs = scene.keyframes[1].timeMs) {
  return renderToStaticMarkup(createElement(WorkshopPlaybackControls, {
    scene, timeMs,
    selectedFrame: 1, firstPoseRecorded, playing: false, speed: 1, disabled: false,
    demonstrationCaption: null, poseStates,
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
    expect(controls(true, scene)).toContain('aria-label="1.07s pose · not captured yet"');
  });

  it("marks each pose on the timeline with its capture state", () => {
    const html = controls(true, blankWorkshopScene, ["captured", "changed", "new"]);
    expect(html).toContain('aria-label="Start pose · captured"');
    expect(html).toContain('aria-label="Finish pose · changed since capture"');
    expect(html).toContain('aria-label="Return pose · not captured yet"');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  });

  it("describes a time between poses without implying lost work", () => {
    const html = controls(true, blankWorkshopScene, ["captured", "captured", "captured"], 500);
    expect(html).toContain("Between poses");
    expect(html).not.toContain("not captured");
  });
});
