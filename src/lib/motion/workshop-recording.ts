import { machineMotionAt, machineMotionFields, sampleStudioObject } from "./studio";
import { identityTransform, sampleWorkshopPose, type WorkshopScene } from "./workshop";

/** Only movement affects whether a pose needs recording again. */
export function workshopPoseSignature(scene: WorkshopScene, timeMs: number): string {
  const studio = scene.studio;
  return JSON.stringify([sampleWorkshopPose(scene.keyframes, timeMs), scene.motionStyle, scene.equipment,
    studio?.body, studio?.seating, studio?.frontalPlane, studio?.supports,
    studio?.objects.map(item => {
      const sampled = sampleStudioObject(item, timeMs);
      return { ...sampled, machinePosition: sampled.machinePosition ?? .5, frames: undefined, name: undefined };
    }),
  ], (_key, value) => value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value);
}

/** Once another moment is authored, capturing Start must preserve it. */
export function hasIndependentWorkshopMotion(before: WorkshopScene, next: WorkshopScene): boolean {
  if (before.keyframes.length !== next.keyframes.length) return true;
  if (next.keyframes.some(frame => frame.timeMs !== 0 && JSON.stringify(frame) !==
    JSON.stringify(before.keyframes.find(previous => previous.timeMs === frame.timeMs)))) return true;
  return next.studio?.objects.some(item => {
    const previous = before.studio?.objects.find(object => object.id === item.id);
    if (!previous) return false;
    return item.frames?.some(frame => {
      if (frame.timeMs === 0) return false;
      const sampled = sampleStudioObject(previous, frame.timeMs);
      return (Object.keys(identityTransform) as (keyof typeof identityTransform)[]).some(key => frame[key] !== sampled[key])
        || machineMotionFields.some(key => frame[key] !== sampled[key]);
    });
  }) ?? false;
}

/** Seed a new repetition only before any independent moments have been authored. */
export function captureFirstWorkshopPose(scene: WorkshopScene): WorkshopScene {
  return { ...scene, keyframes: scene.keyframes.map(frame => ({ ...frame, poses: structuredClone(scene.keyframes[0].poses) })),
    studio: scene.studio && { ...scene.studio, objects: scene.studio.objects.map(item => {
      if (!item.frames?.length) return item;
      const start = sampleStudioObject(item, 0);
      return { ...item, frames: item.frames.map(frame => ({ ...frame,
        x: start.x, y: start.y, z: start.z, rotationX: start.rotationX, rotationY: start.rotationY, rotationZ: start.rotationZ, scale: start.scale,
        machinePosition: start.machinePosition, machineHandleHeight: start.machineHandleHeight, machinePositionLeft: start.machinePositionLeft, machinePositionRight: start.machinePositionRight, ...machineMotionAt(start),
      })) };
    }) },
  };
}
