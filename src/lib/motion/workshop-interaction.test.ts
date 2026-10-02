import { expect, it } from "vitest";
import type { StudioEditor } from "@/components/character/studio-controls";
import { canBeginStudioDrag, workshopEditorForInteraction } from "./workshop-interaction";

it("finishes elbow capture and reports reach in Camera mode without allowing pointer drag", () => {
  let capturePending = true;
  const elbowLocks: Record<string, { x: number; y: number; z: number }> = {};
  const reach: Record<string, boolean> = {};
  const editor: StudioEditor = {
    selection: { kind: "object", id: "weight" }, tool: "select", snap: false, sensitivity: 1, playing: false, dragging: false, posing: true,
    captureElbow: { objectId: "weight", side: "left" },
    onSelect: () => undefined, onBodyChange: () => undefined, onObjectChange: () => undefined, onJointChange: () => undefined, onDragStart: () => undefined, onDragEnd: () => undefined,
    onGripReach: (id, reachable) => { reach[id] = reachable; },
    onCaptureElbow: (id, side, point) => { elbowLocks[`${id}-${side}`] = point; capturePending = false; },
  };
  const cameraEditor = workshopEditorForInteraction(editor, false)!;
  const capture = cameraEditor.captureElbow!;
  cameraEditor.onCaptureElbow?.(capture.objectId, capture.side, { x: 0.2, y: 1.4, z: 0.1 });
  cameraEditor.onGripReach("weight", false);
  expect(capturePending).toBe(false);
  expect(elbowLocks["weight-left"]).toEqual({ x: 0.2, y: 1.4, z: 0.1 });
  expect(reach.weight).toBe(false);
  expect(canBeginStudioDrag(cameraEditor, cameraEditor.selection, 0)).toBe(false);
  expect(canBeginStudioDrag(workshopEditorForInteraction(editor, true), editor.selection, 0)).toBe(true);
  expect(editor.playing).toBe(false);
});

it("keeps selection/contact inspection but blocks a locked machine drag", () => {
  const selection = { kind: "object" as const, id: "machine" };
  const editor = { interactionEnabled: true, playing: false, tool: "select", placementLockedIds: ["machine"], selection } as StudioEditor;
  expect(canBeginStudioDrag(editor, selection, 0)).toBe(false);
  expect(canBeginStudioDrag(editor, { kind: "object", id: "other" }, 0)).toBe(true);
  expect(canBeginStudioDrag({ ...editor, placementLockedIds: [] }, selection, 0)).toBe(true);
});
