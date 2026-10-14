import { identityTransform, sampleWorkshopPose, type SceneTransform, type WorkshopScene, type StudioObject } from "./workshop";
import { sampleStudioObject, updateStudioObjectTransform } from "./studio";
import { canCarryWithArm, sampleHeldWeightPose } from "./held-weight-pose";

/** Add sampled moments in each half, retaining every authored moment. */
export function addEvenlySpacedWorkshopFrames(scene: WorkshopScene, posesPerHalf: number): WorkshopScene {
  if (!Number.isInteger(posesPerHalf) || posesPerHalf < 2 || posesPerHalf > 12) throw Error("Choose between 2 and 12 poses per movement.");
  const times = new Set(scene.keyframes.map(frame => frame.timeMs));
  for (let index = 0; index <= 2 * (posesPerHalf - 1); index++) times.add(Math.round(scene.durationMs * index / (2 * (posesPerHalf - 1))));
  if (times.size > 24) throw Error("Keep at most 24 poses. Choose fewer evenly spaced poses.");
  return { ...scene, keyframes: [...times].sort((a, b) => a - b).map(timeMs => scene.keyframes.find(frame => frame.timeMs === timeMs)
    ?? { timeMs, poses: sampleWorkshopPose(scene.keyframes, timeMs) }) };
}

export type WorkshopFrameClipboard = { poses: WorkshopScene["keyframes"][number]["poses"]; objects: StudioObject[] };

export function captureWorkshopFrame(scene: WorkshopScene, index: number): WorkshopFrameClipboard {
  const frame = scene.keyframes[index];
  if (!frame) throw Error("Select a frame to copy.");
  const poses = scene.studio?.objects.some(canCarryWithArm) ? sampleHeldWeightPose(scene, frame.timeMs) : frame.poses;
  return structuredClone({ poses, objects: scene.studio?.objects.filter(item => item.frames?.length).map(item => sampleStudioObject(item, frame.timeMs)) ?? [] });
}

export function pasteWorkshopFrame(scene: WorkshopScene, index: number, clipboard: WorkshopFrameClipboard): WorkshopScene {
  const frame = scene.keyframes[index];
  if (!frame) throw Error("Select a frame to paste.");
  return { ...scene, keyframes: scene.keyframes.map((item, position) => position === index ? { ...item, poses: structuredClone(clipboard.poses) } : item),
    ...(scene.studio ? { studio: { ...scene.studio, objects: scene.studio.objects.map(item => {
      const copied = clipboard.objects.find(object => object.id === item.id);
      if (!copied) return item;
      const next = updateStudioObjectTransform(item, copied, frame.timeMs, true);
      if (next.frames && next.frames.length > 24) throw Error("This change needs more than 24 weight moments. Remove unused moments in Timeline first.");
      return { ...next, frames: next.frames?.map(point => point.timeMs === frame.timeMs ? { ...point, machinePosition: copied.machinePosition, machineHandleHeight: copied.machineHandleHeight } : point) };
    }) } } : {}),
  };
}

export function retimeWorkshopFrame(scene: WorkshopScene, index: number, timeMs: number): WorkshopScene {
  const frame = scene.keyframes[index];
  if (!frame || index === 0 || index === scene.keyframes.length - 1) throw Error("Start and end use the scene boundaries. Change Duration to move the end.");
  if (!Number.isSafeInteger(timeMs)) throw Error("Enter a frame time in seconds, with at most three decimal places.");
  if (timeMs === frame.timeMs) return scene;
  // Independent equipment and phase markers must not cross or collide either.
  const times = [...scene.keyframes.map(item => item.timeMs),
    ...(scene.studio?.objects.flatMap(item => item.frames?.map(point => point.timeMs) ?? []) ?? []),
    ...(scene.annotations?.flatMap(item => [item.startMs, item.endMs]) ?? [])];
  const before = Math.max(...times.filter(time => time < frame.timeMs));
  const after = Math.min(...times.filter(time => time > frame.timeMs));
  if (timeMs <= before || timeMs >= after) throw Error(`Choose a time from ${((before + 1) / 1000).toFixed(3)} to ${((after - 1) / 1000).toFixed(3)} seconds to keep the frames in order.`);
  return { ...scene,
    keyframes: scene.keyframes.map((item, position) => position === index ? { ...item, timeMs } : item),
    ...(scene.studio ? { studio: { ...scene.studio, objects: scene.studio.objects.map(item => ({ ...item,
      frames: item.frames?.map(point => point.timeMs === frame.timeMs ? { ...point, timeMs } : point),
    })) } } : {}),
    annotations: scene.annotations?.map(item => ({ ...item,
      startMs: item.startMs === frame.timeMs ? timeMs : item.startMs,
      endMs: item.endMs === frame.timeMs ? timeMs : item.endMs,
    })),
  };
}

export function deleteWorkshopFrame(scene: WorkshopScene, index: number): WorkshopScene {
  if (!scene.keyframes[index]) throw Error("Select a frame to delete.");
  if (scene.keyframes.length <= 2) throw Error("Keep at least two frames for playback.");
  const deletedTime = scene.keyframes[index].timeMs;
  const keyframes = scene.keyframes.filter((_, position) => position !== index);
  const boundary = index === 0 ? 0 : index === scene.keyframes.length - 1 ? scene.durationMs : null;
  const survivor = index === 0 ? 0 : keyframes.length - 1;
  const promotedTime = keyframes[survivor].timeMs;
  if (boundary !== null) keyframes[survivor] = { ...keyframes[survivor], timeMs: boundary };
  return { ...scene, keyframes,
    ...(scene.studio ? { studio: { ...scene.studio, objects: scene.studio.objects.map(item => {
      if (!item.frames) return item;
      const frames = item.frames.filter(point => point.timeMs !== deletedTime).map(point =>
        boundary !== null && point.timeMs === promotedTime ? { ...point, timeMs: boundary } : point).sort((a, b) => a.timeMs - b.timeMs);
      if (boundary !== null && (!frames.length || !frames.some(point => point.timeMs === boundary)
        && item.frames.some(point => point.timeMs === deletedTime))) {
        const sampled = sampleStudioObject(item, promotedTime), transform = { ...identityTransform };
        for (const key of Object.keys(transform) as (keyof SceneTransform)[]) transform[key] = sampled[key];
        if (!frames.length) return { ...item, ...transform, machinePosition: sampled.machinePosition, frames: undefined };
        frames.push({ ...transform, timeMs: boundary, machinePosition: sampled.machinePosition });
        frames.sort((a, b) => a.timeMs - b.timeMs);
      }
      return { ...item, frames: frames.length ? frames : undefined };
    }) } } : {}),
  };
}
