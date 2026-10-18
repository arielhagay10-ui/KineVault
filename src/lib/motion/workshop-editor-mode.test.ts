import { describe, expect, it } from "vitest";
import { workshopEditorMode, workshopEditorFlags, type WorkshopEditorMode } from "./workshop-editor-mode";

describe("workshop editor modes", () => {
  it.each<WorkshopEditorMode>([
    { mode: "rotate", showJoints: true },
    { mode: "move", showJoints: false },
    { mode: "free", showJoints: true },
    { mode: "limbs", drag: "arrows" },
  ])("clearing a selection removes manipulation and joint handles", state => {
    const cleared = workshopEditorMode(state, { type: "select", target: "none" });
    expect(workshopEditorFlags(cleared)).toEqual({ interactionMode: "camera", tool: "select", posing: false, limbPosing: false, freeDragging: false });
  });

  it("moves endpoints with limb arrows and retains them when free dragging is chosen", () => {
    const moved = workshopEditorMode({ mode: "select" }, { type: "choose", tool: "move", endpoint: true });
    expect(workshopEditorFlags(moved)).toMatchObject({ tool: "translate", limbPosing: true, posing: false, freeDragging: false });
    const free = workshopEditorMode(moved, { type: "choose", tool: "free" });
    expect(workshopEditorFlags(free)).toMatchObject({ tool: "select", limbPosing: true, posing: false, freeDragging: true });
    expect(workshopEditorMode(free, { type: "select", target: "endpoint" })).toEqual(free);
  });

  it("leaves limb posing when selecting equipment or rotating a joint", () => {
    const limbs: WorkshopEditorMode = { mode: "limbs", drag: "arrows" };
    expect(workshopEditorFlags(workshopEditorMode(limbs, { type: "select", target: "object" }))).toMatchObject({ tool: "translate", limbPosing: false, posing: false });
    expect(workshopEditorFlags(workshopEditorMode(limbs, { type: "choose", tool: "rotate" }))).toMatchObject({ tool: "rotate", limbPosing: false });
    expect(workshopEditorFlags(workshopEditorMode(limbs, { type: "select", target: "joint" }))).toMatchObject({ tool: "rotate", limbPosing: false, posing: true });
  });

  it("camera disables manipulation and select restores joint picking", () => {
    const camera = workshopEditorMode({ mode: "limbs", drag: "free" }, { type: "choose", tool: "camera" });
    expect(workshopEditorFlags(camera)).toEqual({ interactionMode: "camera", tool: "select", posing: false, limbPosing: false, freeDragging: false });
    expect(workshopEditorFlags(workshopEditorMode(camera, { type: "choose", tool: "select" }))).toMatchObject({ interactionMode: "edit", posing: true, limbPosing: false, freeDragging: false });
  });

  it("pose and contact panels leave incompatible limb modes", () => {
    const limbs: WorkshopEditorMode = { mode: "limbs", drag: "free" };
    expect(workshopEditorFlags(workshopEditorMode(limbs, { type: "panel", panel: "pose", joint: true }))).toMatchObject({ tool: "rotate", posing: true, limbPosing: false, freeDragging: false });
    expect(workshopEditorFlags(workshopEditorMode(limbs, { type: "panel", panel: "contact" }))).toMatchObject({ posing: false, limbPosing: false });
    expect(workshopEditorMode(limbs, { type: "panel", panel: "timeline" })).toEqual(limbs);
  });

  it("toggling limb arrows off yields ordinary movement", () => {
    expect(workshopEditorMode({ mode: "limbs", drag: "arrows" }, { type: "choose", tool: "limbs" })).toEqual({ mode: "move", showJoints: false });
  });
});
