import type { WorkshopScene } from "./workshop";

export type WorkshopHistoryEntry = { scene: WorkshopScene; label: string };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function workshopMomentName(timeMs: number, durationMs: number, index = 0) {
  return timeMs === 0 ? "Start" : timeMs === durationMs ? "Return" : timeMs === durationMs / 2 ? "Finish" : `Pose ${index + 1}`;
}

export function describeWorkshopChange(before: WorkshopScene, after: WorkshopScene): string {
  const previous = before.studio?.objects ?? [], next = after.studio?.objects ?? [];
  const added = next.find(item => !previous.some(old => old.id === item.id));
  if (added) return `Add ${added.name}`;
  const removed = previous.find(item => !next.some(value => value.id === item.id));
  if (removed) return `Remove ${removed.name}`;
  if (before.durationMs !== after.durationMs) return "Change duration";
  if (before.keyframes.length !== after.keyframes.length) return after.keyframes.length > before.keyframes.length ? "Add pose" : "Delete pose";
  const changedFrames = after.keyframes.filter((frame, index) => !same(frame, before.keyframes[index]));
  if (changedFrames.length) return changedFrames.length > 1 ? "Change multiple poses" : `Change ${workshopMomentName(changedFrames[0].timeMs, after.durationMs, after.keyframes.indexOf(changedFrames[0])).toLowerCase()} pose`;
  for (const item of next) {
    const old = previous.find(value => value.id === item.id)!;
    if (same(old, item)) continue;
    if (["attachment", "elbowLocks", "machineUse", "machineGrip", "cableAttachment", "cuffPosition"].some(key => !same(old[key as keyof typeof old], item[key as keyof typeof item]))) return `Change ${item.name} contact`;
    if (!same(old.frames, item.frames) || old.machinePosition !== item.machinePosition || old.machineHandleHeight !== item.machineHandleHeight) return `Change ${item.name} movement`;
    if (old.benchAngle !== item.benchAngle) return `Change ${item.name} pad angle`;
    if (old.name !== item.name) return `Rename ${old.name}`;
    return `Move ${item.name}`;
  }
  if (!same(before.studio?.body, after.studio?.body)) return "Move figure";
  if (!same(before.studio?.seating, after.studio?.seating)) return "Change seating";
  if (!same(before.studio?.presentation, after.studio?.presentation)) return "Change camera or highlights";
  if (!same(before.annotations, after.annotations)) return "Change annotations";
  return "Change scene";
}
