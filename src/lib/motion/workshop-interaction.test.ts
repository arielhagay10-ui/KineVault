import { expect, it } from "vitest";
import type { StudioEditor } from "@/components/character/studio-controls";
import { canBeginStudioDrag, canUseStudioLimbNudge, canUseStudioMachineHandle, workshopEditorForInteraction } from "./workshop-interaction";

it("preserves explicit support interaction locks when the canvas is editable", () => {
  const editor = { interactionEnabled: false, directDragging: true, tool: "select", playing: false,
    supportEdit: { region: "left-hand", picking: true, adjusting: false } } as StudioEditor;
  const effective = workshopEditorForInteraction(editor, true)!;
  expect(effective.interactionEnabled).toBe(false);
  expect(canBeginStudioDrag(effective, { kind: "body" }, 0)).toBe(false);
  expect(canUseStudioMachineHandle(effective)).toBe(false);
  expect(effective.supportEdit).toEqual(editor.supportEdit);
});

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

it("requires explicit free drag when selection controls disable direct dragging", () => {
  const editor = { playing: false, tool: "select", directDragging: false } as StudioEditor;
  expect(canBeginStudioDrag(editor, { kind: "body" }, 0)).toBe(false);
  expect(canBeginStudioDrag({ ...editor, directDragging: true }, { kind: "body" }, 0)).toBe(true);
  expect(canBeginStudioDrag({ ...editor, directDragging: true, tool: "translate" }, { kind: "body" }, 0)).toBe(false);
});

it("permits machine travel only in Free drag, independently of locked machine placement", () => {
  const editor = { interactionEnabled: true, playing: false, tool: "select", directDragging: false, placementLockedIds: ["machine"] } as StudioEditor;
  expect(canUseStudioMachineHandle(editor)).toBe(false);
  expect(canUseStudioMachineHandle({ ...editor, directDragging: true })).toBe(true);
  expect(canUseStudioMachineHandle({ ...editor, directDragging: true, tool: "translate" })).toBe(false);
  expect(canUseStudioMachineHandle({ ...editor, directDragging: true, playing: true })).toBe(false);
  expect(canUseStudioMachineHandle({ ...editor, directDragging: true, interactionEnabled: false })).toBe(false);
  expect(canUseStudioMachineHandle({ ...editor, directDragging: true, gripEdit: { objectId: "machine", side: "left", picking: true } })).toBe(false);
});

it("allows endpoint nudges with arrows or Free drag while preserving limb and interaction locks", () => {
  const unchanged = () => undefined;
  const editor: StudioEditor = {
    interactionEnabled: true, playing: false, limbPosing: true, tool: "translate", selection: { kind: "joint", slug: "left-wrist" }, onLimbPoseChange: unchanged,
    snap: false, sensitivity: 1, dragging: false, posing: true,
    onSelect: unchanged, onBodyChange: unchanged, onObjectChange: unchanged, onJointChange: unchanged, onDragStart: unchanged, onDragEnd: unchanged, onGripReach: unchanged,
  };
  expect(canUseStudioLimbNudge(editor, "left-hand")).toBe(true);
  expect(canUseStudioLimbNudge({ ...editor, tool: "select", directDragging: true }, "left-hand")).toBe(true);
  expect(canUseStudioLimbNudge({ ...editor, tool: "select", directDragging: false }, "left-hand")).toBe(false);
  expect(canUseStudioLimbNudge({ ...editor, blockedLimbs: ["left-hand"] }, "left-hand")).toBe(false);
  expect(canUseStudioLimbNudge(editor, "right-hand")).toBe(false);
  expect(canUseStudioLimbNudge({ ...editor, playing: true }, "left-hand")).toBe(false);
  expect(canUseStudioLimbNudge({ ...editor, interactionEnabled: false }, "left-hand")).toBe(false);
});
