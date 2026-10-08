import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Object3D, PerspectiveCamera } from "three";
import { expect, it, vi } from "vitest";
import type { StudioEditor, StudioSelection } from "./studio-controls";
import { useStudioDrag } from "./studio-drag";

// Supply the Canvas dependency; the real hook determines registered handlers.
vi.mock("@react-three/fiber", () => ({
  useThree: (select: (state: { camera: PerspectiveCamera; invalidate: () => void }) => unknown) =>
    select({ camera: new PerspectiveCamera(), invalidate: () => undefined }),
}));

const noop = () => undefined;
const editor: StudioEditor = {
  selection: { kind: "body" }, tool: "select", snap: false, sensitivity: 1,
  playing: false, dragging: false, posing: false,
  onSelect: noop, onBodyChange: noop, onObjectChange: noop, onJointChange: noop,
  onDragStart: noop, onDragEnd: noop, onGripReach: noop,
};

function registeredHandlers(value?: StudioEditor, selection: StudioSelection = { kind: "body" }) {
  const captured: { events: ReturnType<typeof useStudioDrag> | null } = { events: null };
  function CanvasChild() {
    captured.events = useStudioDrag({ current: new Object3D() }, selection, value, noop);
    return null;
  }
  renderToStaticMarkup(createElement(CanvasChild));
  if (!captured.events) throw new Error("Hook did not render");
  return captured.events;
}

it("does not register mesh raycast handlers for comparison, camera, playback or locked idle items", () => {
  expect(Object.keys(registeredHandlers())).toEqual([]);
  expect(Object.keys(registeredHandlers({ ...editor, interactionEnabled: false }))).toEqual([]);
  expect(Object.keys(registeredHandlers({ ...editor, playing: true }))).toEqual([]);
  expect(Object.keys(registeredHandlers({ ...editor, bodyLocked: true }))).toEqual([]);
  expect(Object.keys(registeredHandlers({ ...editor, tool: "rotate" }))).toEqual([]);
  expect(Object.keys(registeredHandlers({ ...editor, placementLockedIds: ["weight"] }, { kind: "object", id: "weight" }))).toEqual([]);
});

it("keeps active editing and drag completion/cancellation handlers when interaction becomes inactive", () => {
  for (const value of [editor, { ...editor, dragging: true, playing: true, interactionEnabled: false }]) {
    const handlers = registeredHandlers(value);
    expect(handlers.onPointerDown).toBeTypeOf("function");
    expect(handlers.onPointerMove).toBeTypeOf("function");
    expect(handlers.onPointerUp).toBeTypeOf("function");
    expect(handlers.onPointerCancel).toBeTypeOf("function");
  }
});
