import { clamp, createStudioObject, studioAttachmentSlots, studioPointToWorld } from "./studio";
import { isStudioMachine } from "./studio-machines";
import { identityTransform, sampleWorkshopPose, type StudioObject, type WorkshopScene } from "./workshop";

export function editWorkshopMoment(scene: WorkshopScene, timeMs: number) {
  if (!Number.isInteger(timeMs) || timeMs < 0 || timeMs > scene.durationMs) throw new Error("Choose a moment within the movement.");
  const existing = scene.keyframes.findIndex(frame => frame.timeMs === timeMs);
  if (existing >= 0) return { scene, index: existing };
  if (scene.keyframes.length >= 24) throw new Error("The movement has 24 poses. Remove a pose in Timeline before adding another.");
  const keyframes = [...scene.keyframes, { timeMs, poses: sampleWorkshopPose(scene.keyframes, timeMs) }].sort((a, b) => a.timeMs - b.timeMs);
  return { scene: { ...scene, keyframes }, index: keyframes.findIndex(frame => frame.timeMs === timeMs) };
}

export function addWorkshopEquipment(scene: WorkshopScene, slug: StudioObject["slug"], id: string): WorkshopScene {
  const studio = scene.studio ?? { body: identityTransform, objects: [] };
  if (studio.objects.length >= 20) throw new Error("The scene has 20 items. Remove an item before adding another.");
  const next = createStudioObject(slug, id, studio.objects.length);
  const engage = isStudioMachine(slug) && slug !== "cable-row-machine";
  const activeMachine = studio.objects.find(item => item.machineUse);
  if (slug === "bench" && activeMachine) next.rotationY = activeMachine.rotationY;
  return { ...scene, equipment: engage ? null : scene.equipment, studio: { ...studio,
    seating: engage ? undefined : studio.seating,
    objects: [...studio.objects.map(item => engage ? { ...item, machineUse: item.machineUse === undefined ? undefined : false, attachment: "none" as const, elbowLocks: undefined } : item),
      { ...next, machineUse: isStudioMachine(slug) ? engage : undefined }],
  } };
}

/** Keep authored poses; replace only the row's forced contacts and travel. */
export function createFreeCableSetup(scene: WorkshopScene, id: string): WorkshopScene {
  const studio = scene.studio ?? { body: identityTransform, objects: [] };
  const row = studio.objects.find(item => item.id === id && item.slug === "cable-row-machine");
  if (!row && studio.objects.length >= 20) throw new Error("The scene has 20 items. Remove an item before adding another.");
  const cable = createStudioObject("cable-machine", id, studio.objects.length);
  if (row) {
    const position = studioPointToWorld({ x: .95, y: 0, z: 1.2 }, row);
    Object.assign(cable, { x: clamp(position.x, -10, 10), y: clamp(position.y, -3, 10), z: clamp(position.z, -10, 10), rotationX: row.rotationX, rotationY: row.rotationY, rotationZ: row.rotationZ, scale: row.scale });
  }
  Object.assign(cable, { pulleyHeight: .3, attachment: "both", cableAttachment: "straight-bar" });
  const objects = studio.objects.map(item => item === row ? cable : {
    ...item, machineUse: item.machineUse === undefined ? undefined : false,
    ...(studioAttachmentSlots(item).some(slot => slot.endsWith("hand") || slot.endsWith("wrist") || slot.endsWith("upper-arm")) ? { attachment: "none" as const, elbowLocks: undefined } : {}),
  });
  return { ...scene, equipment: null, motionStyle: "free", studio: { ...studio, seating: undefined, objects: row ? objects : [...objects, cable] } };
}
