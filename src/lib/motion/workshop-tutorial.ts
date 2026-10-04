export const tutorialStorageKey = (ownerId: string) => `kinevault.workshop.tutorial.v1.${ownerId}`;
export const workshopTutorialSteps = [
  { id: "equipment", title: "Choose your equipment", mode: "quick", quickStep: 0, target: "quick", tips: [
    "Add equipment to build any movement you want. A machine does not define the exercise.",
    "Search the equipment pictures, favorite items, or start from an exercise example. Examples replace the scene; Undo brings it back.",
  ] },
  { id: "placement", title: "Place the figure and equipment", mode: "advanced", target: "inspector", tips: [
    "Select the figure or an item in your scene. Move it with the mouse, rotate it, or enter exact coordinates and scale.",
    "Use Front and Side views to check placement. Lower movement sensitivity for small adjustments.",
  ] },
  { id: "contacts", title: "Set grips and supports", mode: "advanced", target: "inspector", tips: [
    "Contact controls let you hold weights, attach cable handles or cuffs, sit or lie on a bench, and link machine handles.",
    "Leave machine or Release restores free posing. Set bench angle, palm direction, and elbow locks when your movement needs them.",
  ] },
  { id: "pose", title: "Pose the body", mode: "advanced", target: "preview", tips: [
    "Use Pose hands and feet to drag limbs, or Pose body to choose a joint and adjust its angles.",
    "Held equipment drives its arm. Release it for free posing. Edit this pose changes one moment; Apply to all poses changes every moment.",
  ] },
  { id: "timeline", title: "Build the movement", mode: "advanced", target: "timeline", tips: [
    "Choose a starting pose, add a finish pose, and return to the start. Select each timeline moment before editing it.",
    "Animate selected item lets equipment move between poses. Copy poses, mirror sides, adjust duration, or match the loop end to the start.",
  ] },
  { id: "preview", title: "Check your full repetition", mode: "quick", quickStep: 2, target: "preview", tips: [
    "Play the movement, slow the preview, and scrub the timeline. View start and View finish inspect exact moments.",
    "Compare start and finish shows both poses together. Check grips, supports, feet, and the return from different views. Reach warnings help find missed contacts.",
  ] },
  { id: "muscles", title: "Choose what the preview shows", mode: "advanced", target: "preview", tips: [
    "Use the preview controls to choose muscle highlights, isolate anatomy, change views, pan, and zoom.",
    "Highlights are optional. Focus mode gives you more room while keeping playback and saving available.",
  ] },
  { id: "history", title: "Reuse setups and undo edits", mode: "advanced", target: "history", tips: [
    "Undo and Redo restore complete edits. Edit history lists recent changes; Recovery and shortcuts includes saved-scene recovery and keyboard controls.",
    "Personal equipment setups reuse placements and contacts. Save a setup in Advanced editing, then apply it to another exercise.",
  ] },
  { id: "save", title: "Name and save your exercise", mode: "quick", quickStep: 3, target: "quick", tips: [
    "Give the exercise a name and Save privately. Named edits also save automatically; check the save status and retry if a save fails.",
    "Add optional details opens muscles, classifications, and instructions. Your exercise stays private. Reopen this walkthrough with Tutorial whenever you need it.",
  ] },
] as const;

export type WorkshopTutorialState = { open: boolean; step: number };
export function readWorkshopTutorial(raw: string | null, eligible: boolean): WorkshopTutorialState {
  try {
    const value = raw ? JSON.parse(raw) : null;
    if (value && typeof value.open === "boolean" && Number.isInteger(value.step) && value.step >= 0 && value.step < workshopTutorialSteps.length) {
      return { open: eligible && value.open, step: value.step };
    }
  } catch { /* Invalid progress starts the first tutorial again. */ }
  return { open: eligible, step: 0 };
}
