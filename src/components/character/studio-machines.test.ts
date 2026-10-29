import { Children, isValidElement, type ReactNode } from "react";
import { Group } from "three";
import { expect, it } from "vitest";
import type { AnatomyRig } from "@/lib/motion/anatomy";
import { createQuickScene } from "@/lib/motion/quick-create";
import type { StudioEditor } from "./studio-controls";
import { StudioMachine } from "./studio-machines";
import { StudioMachineDrag } from "./studio-machine-drag";

function handleCount(tree: ReactNode): number {
  return Children.toArray(tree).reduce<number>((count, node) => {
    if (!isValidElement<{ children?: ReactNode }>(node)) return count;
    return count + (node.type === StudioMachineDrag ? 1 : handleCount(node.props.children));
  }, 0);
}

it("mounts both pec deck drag handles only for explicit Free drag", () => {
  const object = createQuickScene("pec-deck").studio!.objects[0];
  const unchanged = () => undefined;
  const editor: StudioEditor = {
    interactionEnabled: true, playing: false, tool: "select", directDragging: false, placementLockedIds: [object.id], onMachineHandleChange: unchanged,
    selection: null, snap: false, sensitivity: 1, dragging: false, posing: false,
    onSelect: unchanged, onBodyChange: unchanged, onObjectChange: unchanged, onJointChange: unchanged, onDragStart: unchanged, onDragEnd: unchanged, onGripReach: unchanged,
  };
  const props = { object, editor, group: { current: new Group() }, rig: {} as AnatomyRig, pose: {} };
  expect(handleCount(StudioMachine(props))).toBe(0);
  expect(handleCount(StudioMachine({ ...props, editor: { ...editor, directDragging: true } }))).toBe(2);
  expect(handleCount(StudioMachine({ ...props, editor: { ...editor, directDragging: true, interactionEnabled: false } }))).toBe(0);
});

it("mounts separate left and right chest press drag controls", () => {
  const object = createQuickScene("chest-press-machine").studio!.objects[0];
  const unchanged = () => undefined;
  const editor: StudioEditor = {
    interactionEnabled: true, playing: false, tool: "select", directDragging: true, placementLockedIds: [object.id], onMachineHandleChange: unchanged,
    selection: null, snap: false, sensitivity: 1, dragging: false, posing: false,
    onSelect: unchanged, onBodyChange: unchanged, onObjectChange: unchanged, onJointChange: unchanged, onDragStart: unchanged, onDragEnd: unchanged, onGripReach: unchanged,
  };
  expect(handleCount(StudioMachine({ object, editor, group: { current: new Group() }, rig: {} as AnatomyRig, pose: {} }))).toBe(2);
});
