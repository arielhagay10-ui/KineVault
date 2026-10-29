import type { StudioEditor, StudioSelection } from "@/components/character/studio-controls";
import type { PoseLimb } from "./limb-pose";

export function workshopEditorForInteraction(editor: StudioEditor | undefined, enabled: boolean): StudioEditor | undefined {
  return editor ? { ...editor, interactionEnabled: enabled && editor.interactionEnabled !== false } : undefined;
}

export function canBeginStudioDrag(editor: StudioEditor | undefined, selection: StudioSelection, button: number) {
  return !!editor && editor.interactionEnabled !== false && editor.directDragging !== false && !editor.playing && editor.tool === "select" && button === 0 && !(selection?.kind === "body" && editor.bodyLocked) && !(selection?.kind === "object" && editor.placementLockedIds?.includes(selection.id));
}

export function canUseStudioMachineHandle(editor: StudioEditor | undefined) {
  return !!editor && editor.interactionEnabled !== false && editor.directDragging !== false && !editor.playing && editor.tool === "select" && !editor.gripEdit?.picking;
}

export function canUseStudioLimbNudge(editor: StudioEditor, limb: PoseLimb) {
  const slug = `${limb.startsWith("left") ? "left" : "right"}-${limb.endsWith("hand") ? "wrist" : "ankle"}`;
  return editor.interactionEnabled !== false && !editor.playing && !!editor.limbPosing && !!editor.onLimbPoseChange
    && editor.selection?.kind === "joint" && editor.selection.slug === slug && !editor.blockedLimbs?.includes(limb)
    && (editor.tool === "translate" || editor.tool === "select" && editor.directDragging !== false);
}
