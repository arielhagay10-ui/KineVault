import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { blankWorkshopScene, type WorkshopScene } from "@/lib/motion/workshop";
import { MotionCanvas } from "./motion-canvas";
import type { StudioEditor } from "./studio-controls";
import { createQuickScene } from "@/lib/motion/quick-create";

const noop = () => undefined;
const editor: StudioEditor = {
  selection: { kind: "body" }, tool: "select", snap: false, sensitivity: 1,
  playing: false, dragging: false, posing: false,
  onSelect: noop, onBodyChange: noop, onObjectChange: noop, onJointChange: noop,
  onDragStart: noop, onDragEnd: noop, onGripReach: noop,
};

it.each([blankWorkshopScene, { ...blankWorkshopScene, studio: undefined }])("leaves unspecified editor muscle highlights off", scene => {
  const markup = renderToStaticMarkup(createElement(MotionCanvas, { scene, editor, timeMs: 0 }));
  expect(markup).toContain('value="none" selected=""');
  expect(markup).not.toContain('value="group:deltoid" selected=""');
});

it.each(["none", "group:chest", "mesh:creator-chosen-muscle"])("preserves the saved editor highlight %s", highlight => {
  const scene: WorkshopScene = { ...blankWorkshopScene, studio: { ...blankWorkshopScene.studio!, presentation: { highlight, isolate: false, view: "front" } } };
  const markup = renderToStaticMarkup(createElement(MotionCanvas, { scene, editor, timeMs: 0 }));
  expect(markup).toContain(`value="${highlight}" selected=""`);
});

it("preserves inferred highlights in the exercise viewer", () => {
  const markup = renderToStaticMarkup(createElement(MotionCanvas, { scene: blankWorkshopScene, timeMs: 0 }));
  expect(markup).toContain('value="group:deltoid" selected=""');
});

it("does not wait for hidden machine assets in an isolated anatomy viewer", () => {
  const scene = createQuickScene("lat-pulldown-machine");
  scene.studio!.presentation = { highlight: "group:lats", isolate: true, view: "front" };
  const viewer = renderToStaticMarkup(createElement(MotionCanvas, { scene, timeMs: 0 }));
  expect(viewer).toContain('data-equipment-state="ready"');
  const editing = renderToStaticMarkup(createElement(MotionCanvas, { scene, editor, timeMs: 0 }));
  expect(editing).toContain('data-equipment-state="loading"');
});
