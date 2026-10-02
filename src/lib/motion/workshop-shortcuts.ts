type ShortcutKey = Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "repeat" | "isComposing" | "defaultPrevented">;
type ShortcutContext = { typing: boolean; interactive: boolean; blocked: boolean };
export type WorkshopShortcut = "undo" | "redo" | "save" | "duplicate" | "remove" | "play" | "previous" | "next" | "edit" | "camera" | "help" | "escape";

export function workshopShortcut(event: ShortcutKey, context: ShortcutContext): WorkshopShortcut | null {
  if (context.blocked || event.defaultPrevented || event.repeat || event.isComposing || event.altKey || event.ctrlKey && event.metaKey) return null;
  const key = event.key.toLowerCase();
  const letter = event.code.startsWith("Key") ? event.code.slice(3).toLowerCase() : key;
  if (event.ctrlKey || event.metaKey) {
    if (letter === "s" && !event.shiftKey) return "save";
    if (context.typing) return null;
    if (letter === "z") return event.shiftKey ? "redo" : "undo";
    if (event.shiftKey) return null;
    if (letter === "y") return "redo";
    if (letter === "d") return "duplicate";
    return null;
  }
  if (context.typing) return null;
  if (key === "escape") return "escape";
  if (context.interactive) return null;
  if (key === "?") return "help";
  if (event.shiftKey) return null;
  if (key === "delete") return "remove";
  if (key === " " || event.code === "Space") return "play";
  if (key === "[" || event.code === "BracketLeft") return "previous";
  if (key === "]" || event.code === "BracketRight") return "next";
  if (letter === "e") return "edit";
  if (letter === "c") return "camera";
  return null;
}
