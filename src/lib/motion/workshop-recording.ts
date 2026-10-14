import { sampleStudioObject } from "./studio";
import { sampleWorkshopPose, type WorkshopScene } from "./workshop";

/** Only movement affects whether a pose needs recording again. */
export function workshopPoseSignature(scene: WorkshopScene, timeMs: number): string {
  const studio = scene.studio;
  return JSON.stringify([sampleWorkshopPose(scene.keyframes, timeMs), scene.motionStyle, scene.equipment,
    studio?.body, studio?.seating, studio?.frontalPlane,
    studio?.objects.map(item => {
      const sampled = sampleStudioObject(item, timeMs);
      return { ...sampled, machinePosition: sampled.machinePosition ?? .5, frames: undefined, name: undefined };
    }),
  ], (_key, value) => value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value);
}

/** A new repetition begins with one captured position, then the finish is edited. */
export function captureFirstWorkshopPose(scene: WorkshopScene): WorkshopScene {
  return { ...scene, keyframes: scene.keyframes.map(frame => ({ ...frame, poses: structuredClone(scene.keyframes[0].poses) })),
    studio: scene.studio && { ...scene.studio, objects: scene.studio.objects.map(item => {
      if (!item.frames?.length) return item;
      const start = sampleStudioObject(item, 0);
      return { ...item, frames: item.frames.map(frame => ({ ...frame,
        x: start.x, y: start.y, z: start.z, rotationX: start.rotationX, rotationY: start.rotationY, rotationZ: start.rotationZ, scale: start.scale,
        machinePosition: start.machinePosition, machineHandleHeight: start.machineHandleHeight,
      })) };
    }) },
  };
}
