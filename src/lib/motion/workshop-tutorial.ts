export const tutorialStorageKey = (ownerId: string) => `kinevault.workshop.tutorial.v2.${ownerId}`;
export const workshopTutorialSteps = [
  { id: "equipment", title: "Set up your scene", panel: "equipment", target: "equipment", tips: [
    "Add equipment, or select the figure for a bodyweight movement.",
    "Select any item to show its movement controls. Right-drag to look around without moving it.",
  ] },
  { id: "pose", title: "Build the movement", panel: "pose", target: "pose", tips: [
    "Choose a body joint below, or select it directly in the scene. Arrange the first position, then choose Capture start below the preview. Edit finish and choose Capture pose. You can return to either pose anytime.",
    "Moving the figure edits a draft pose. Capture pose records it; Save exercise stores the exercise in your account.",
    "Use rotation rings for joints, or Hands & feet for movement arrows. Choose a direction to constrain dragging; Fine adjustment makes small steps.",
  ] },
  { id: "preview", title: "Check your full repetition", panel: "timeline", target: "playback", tips: [
    "Play the movement and check the start, finish and return.",
    "Watch the hands and feet. Do they stay in contact with their supports?",
  ] },
  { id: "save", title: "Name and save your exercise", panel: "timeline", target: "save", tips: [
    "Name your exercise at the top and choose Save exercise. It stays private.",
    "Add details, share a view link, or publish from My exercises.",
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
