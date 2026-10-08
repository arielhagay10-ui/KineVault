export const tutorialStorageKey = (ownerId: string) => `kinevault.workshop.tutorial.v2.${ownerId}`;
export const workshopTutorialSteps = [
  { id: "equipment", title: "Choose your equipment", mode: "quick", quickStep: 0, target: "equipment", tips: [
    "Choose equipment, or continue without it for a bodyweight exercise.",
    "You can add more items later.",
  ] },
  { id: "pose", title: "Build the movement", mode: "quick", quickStep: 1, target: "pose", tips: [
    "Edit start, then edit finish. Each change updates that pose.",
    "Use Advanced editing for joint angles, grips and equipment placement.",
  ] },
  { id: "preview", title: "Check your full repetition", mode: "quick", quickStep: 2, target: "playback", tips: [
    "Play the movement and check the start, finish and return.",
    "Watch the hands and feet. Do they stay in contact with their supports?",
  ] },
  { id: "save", title: "Name and save your exercise", mode: "quick", quickStep: 3, target: "save", tips: [
    "Name your exercise and choose Save privately.",
    "Add details, share a view link, or submit for review from My exercises.",
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
