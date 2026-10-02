import type { StudioEditor, StudioSelection } from "@/components/character/studio-controls";

export function workshopEditorForInteraction(editor: StudioEditor | undefined, enabled: boolean): StudioEditor | undefined {
  return editor ? { ...editor, interactionEnabled: enabled } : undefined;
}

export function canBeginStudioDrag(editor: StudioEditor | undefined, selection: StudioSelection, button: number) {
  return !!editor && editor.interactionEnabled !== false && !editor.playing && editor.tool === "select" && button === 0 && !(selection?.kind === "body" && editor.bodyLocked) && !(selection?.kind === "object" && editor.placementLockedIds?.includes(selection.id));
}
