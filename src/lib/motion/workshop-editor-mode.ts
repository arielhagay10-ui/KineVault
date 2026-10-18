export type WorkshopEditorMode =
  | { mode: "camera" | "select" }
  | { mode: "move" | "rotate" | "scale" | "free"; showJoints: boolean }
  | { mode: "limbs"; drag: "arrows" | "free" };

type EditorEvent =
  | { type: "enter"; state: WorkshopEditorMode }
  | { type: "choose"; tool: "camera" | "select" | "move" | "rotate" | "limbs" | "free"; endpoint?: boolean }
  | { type: "select"; target: "endpoint" | "joint" | "body" | "object" | "none" }
  | { type: "panel"; panel: string; joint?: boolean };

export function workshopEditorFlags(state: WorkshopEditorMode): {
  interactionMode: "camera" | "edit"; tool: "select" | "translate" | "rotate" | "scale";
  posing: boolean; limbPosing: boolean; freeDragging: boolean;
} {
  return {
    interactionMode: state.mode === "camera" ? "camera" : "edit",
    tool: state.mode === "rotate" ? "rotate" : state.mode === "scale" ? "scale"
      : state.mode === "move" || state.mode === "limbs" && state.drag === "arrows" ? "translate" : "select",
    posing: state.mode === "select" || "showJoints" in state && state.showJoints,
    limbPosing: state.mode === "limbs",
    freeDragging: state.mode === "free" || state.mode === "limbs" && state.drag === "free",
  };
}

export function workshopEditorMode(state: WorkshopEditorMode, event: EditorEvent): WorkshopEditorMode {
  const flags = workshopEditorFlags(state);
  switch (event.type) {
    case "enter": return event.state;
    case "choose":
      switch (event.tool) {
        case "camera": return { mode: "camera" };
        case "select": return { mode: "select" };
        case "limbs": return state.mode === "limbs" ? { mode: "move", showJoints: false } : { mode: "limbs", drag: "arrows" };
        case "free": return flags.limbPosing ? { mode: "limbs", drag: "free" } : { mode: "free", showJoints: false };
        case "move": return event.endpoint ? { mode: "limbs", drag: "arrows" } : { mode: "move", showJoints: flags.posing };
        case "rotate": return { mode: "rotate", showJoints: flags.posing };
      }
    case "select": {
      if (event.target === "none") return { mode: "camera" };
      if (state.mode === "camera") return state;
      const joint = event.target === "joint" || event.target === "endpoint";
      if (event.target === "endpoint" && state.mode === "limbs") return state;
      if (flags.freeDragging) return { mode: "free", showJoints: joint };
      return joint ? { mode: "rotate", showJoints: true } : { mode: "move", showJoints: false };
    }
    case "panel":
      if (event.panel === "pose") return event.joint ? { mode: "rotate", showJoints: true } : { mode: "select" };
      if (event.panel === "placement" || event.panel === "contact") return { mode: flags.freeDragging ? "free" : "move", showJoints: false };
      return state;
  }
}
