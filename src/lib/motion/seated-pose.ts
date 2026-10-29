import { Euler, Group, Quaternion, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { createHeldWeightPoseSampler } from "./held-weight-pose";
import { machineGripPoint, applyStudioMachine, isStudioMachine } from "./studio-machines";
import { applyStudioSeating } from "./studio-seat";
import { machineMotionAt, sampleStudioObject, setStudioObjectAnimated, studioPointToWorld } from "./studio";
import { studioGripOffset } from "./studio-grip";
import { legPressFootContact } from "./leg-press";
import { shoulderPressElbowPlane, shoulderPressGripRotation } from "./shoulder-press";
import { seatedPadPenetration } from "./seated-pad-clearance";
import { identityTransform, jointLimits, sampleWorkshopPose, type RigPose, type StudioObject, type WorkshopScene } from "./workshop";

export function activeSeat(scene: WorkshopScene): StudioObject | undefined {
  const studio = scene.studio;
  return studio?.objects.find(item => item.machineUse && isStudioMachine(item.slug) && item.slug !== "smith-machine" && item.slug !== "t-bar-row-machine")
    ?? (studio?.seating && !["supine", "prone"].includes(studio.seating.facing)
      ? studio.objects.find(item => item.id === studio.seating!.benchId) : undefined);
}

export function seatFeetAreFree(object: StudioObject) {
  return object.slug !== "leg-press" && (object.seatFootSupport === false || object.slug === "row-machine" && object.rowFootSupport === false);
}

export function releaseSeatedFeet(scene: WorkshopScene): WorkshopScene {
  const seat = activeSeat(scene);
  if (!seat || seat.slug === "leg-press" || seatFeetAreFree(seat)) return scene;
  const sampler = createHeldWeightPoseSampler();
  try {
    const keyframes = scene.keyframes.map(frame => {
      const displayed = sampler.sample(scene, frame.timeMs), poses = { ...frame.poses };
      for (const side of ["left", "right"] as const) for (const part of ["hip", "knee", "ankle"] as const) {
        const joint = `${side}-${part}` as const;
        const angle = displayed[joint];
        if (!angle) continue;
        for (const axis of ["x", "y", "z"] as const) {
          const [min, max] = jointLimits[joint][axis];
          if (angle[axis] < min - .000001 || angle[axis] > max + .000001) {
            throw new Error("This automatic leg pose exceeds joint limits. Use a more upright bench, choose Lie face down for a low pad, or adjust the machine setup before freeing the legs.");
          }
        }
        poses[joint] = Object.fromEntries((["x", "y", "z"] as const).map(axis => [axis,
          Math.max(jointLimits[joint][axis][0], Math.min(jointLimits[joint][axis][1], angle[axis])),
        ])) as typeof angle;
      }
      return { ...frame, poses };
    });
    return { ...scene, keyframes, studio: { ...scene.studio!, objects: scene.studio!.objects.map(item => item.id === seat.id
      ? { ...item, seatFootSupport: false, ...(item.slug === "row-machine" ? { rowFootSupport: false } : {}) } : item) } };
  } finally { sampler.dispose(); }
}

function writeSeatOffsets(scene: WorkshopScene, id: string, timeMs: number, changes: Pick<StudioObject, "seatOffsetX" | "seatOffsetZ">): WorkshopScene {
  const studio = scene.studio;
  if (!studio || activeSeat(scene)?.id !== id) return scene;
  const objects = studio.objects.map(item => {
    if (item.id !== id) return item;
    const object = setStudioObjectAnimated(item, true, timeMs, scene.keyframes.map(frame => frame.timeMs));
    const sampled = sampleStudioObject(object, timeMs), transform = { ...identityTransform };
    for (const key of Object.keys(transform) as (keyof typeof transform)[]) transform[key] = sampled[key];
    const offsets = { seatOffsetX: sampled.seatOffsetX ?? 0, seatOffsetZ: sampled.seatOffsetZ ?? 0, ...changes };
    offsets.seatOffsetX = Math.max(-.1, Math.min(.1, offsets.seatOffsetX));
    offsets.seatOffsetZ = Math.max(-.12, Math.min(.12, offsets.seatOffsetZ));
    return { ...object, frames: [...object.frames!.filter(frame => frame.timeMs !== timeMs),
      { ...transform, ...machineMotionAt(sampled), ...offsets, timeMs }].sort((a, b) => a.timeMs - b.timeMs) };
  });
  return { ...scene, studio: { ...studio, objects } };
}

export function setSeatOffsets(scene: WorkshopScene, id: string, timeMs: number, changes: Pick<StudioObject, "seatOffsetX" | "seatOffsetZ">): WorkshopScene {
  if (Object.values(changes).some(value => !Number.isFinite(value))) return scene;
  return constrainSeatedEdit(scene, writeSeatOffsets(scene, id, timeMs, changes), timeMs);
}

export function resetSeatPose(scene: WorkshopScene, id: string, frameIndex: number): WorkshopScene {
  const frame = scene.keyframes[frameIndex];
  if (!frame || activeSeat(scene)?.id !== id) return scene;
  const next = writeSeatOffsets(scene, id, frame.timeMs, { seatOffsetX: 0, seatOffsetZ: 0 });
  const reset = { ...next, keyframes: next.keyframes.map((item, index) => index === frameIndex
    ? { ...item, poses: { ...item.poses, torso: { x: 0, y: 0, z: 0 } } } : item) };
  if (constrainSeatedEdit(scene, reset, frame.timeMs) !== reset) {
    throw new Error("The automatic seat cannot keep the current contacts clear and within reach. Adjust the grip, travel or setup before resetting.");
  }
  return reset;
}

/** Keep an attached hand within reach while the author adjusts seating or posture. */
export function constrainSeatedEdit(before: WorkshopScene, after: WorkshopScene, timeMs: number): WorkshopScene {
  const seat = activeSeat(after);
  if (!seat || !after.studio || before === after) return after;
  const rig = createAnatomyRig(new Group()), parent = new Group(); parent.add(rig.root);
  const frameTimes = [...new Set([...before.keyframes, ...after.keyframes].map(frame => frame.timeMs))].sort((a, b) => a - b);
  const changed = after.keyframes.filter(frame => JSON.stringify(frame.poses) !== JSON.stringify(before.keyframes.find(item => item.timeMs === frame.timeMs)?.poses)).map(frame => frame.timeMs);
  const first = Math.min(timeMs, ...changed), last = Math.max(timeMs, ...changed);
  const start = frameTimes.filter(time => time < first).at(-1) ?? 0, end = frameTimes.find(time => time > last) ?? after.durationMs;
  const times = [...new Set([timeMs, ...frameTimes.filter(time => time >= start && time <= end), ...Array.from({ length: 17 }, (_, index) => start + (end - start) * index / 16)])];
  const errors = (scene: WorkshopScene, at: number) => {
    const body = scene.studio!.body, pose = sampleWorkshopPose(scene.keyframes, at);
    parent.position.set(body.x, body.y, body.z);
    parent.rotation.set(body.rotationX * Math.PI / 180, body.rotationY * Math.PI / 180, body.rotationZ * Math.PI / 180); parent.scale.setScalar(body.scale);
    poseAnatomyRig(rig, pose, true); applyStudioSeating(rig, scene.studio, at, pose);
    const report = applyStudioMachine(rig, scene, at), object = sampleStudioObject(scene.studio!.objects.find(item => item.id === seat.id)!, at);
    const values: Record<string, number> = {};
    values["torso-pad"] = seatedPadPenetration(rig, object, scene.studio!.seating);
    for (const side of ["left", "right"] as const) {
      if (seatFeetAreFree(object)) values[`${side}-floor`] = Math.max(0, -rig.footBones[side].localToWorld(new Vector3(0, -.14, .065)).y / object.scale);
      if (object.slug === "leg-press") {
        const foot = legPressFootContact(rig, object, side);
        values[`${side}-sled`] = foot.distance / object.scale;
        values[`${side}-sled-alignment`] = Math.max(0, 1 - foot.alignment) * 5;
      }
      if (object.slug === "bench") continue;
      if (object.attachment !== "none" && object.attachment !== "both" && object.attachment !== side) continue;
      if (object.slug === "shoulder-press-machine") {
        const facing = new Quaternion().setFromEuler(new Euler(object.rotationX * Math.PI / 180, object.rotationY * Math.PI / 180, object.rotationZ * Math.PI / 180));
        const palm = shoulderPressGripRotation(object, side, facing);
        values[`${side}-palm-orientation`] = rig.handBones[side].getWorldQuaternion(new Quaternion()).angleTo(palm) * .15;
        const depth = Math.abs(shoulderPressElbowPlane(rig, side, object.pressGrip === "neutral" ? "neutral" : "wide").distanceToPoint(rig.bones[`${side}-elbow`].getWorldPosition(new Vector3())));
        values[`${side}-elbow-plane`] = Math.max(0, depth / object.scale - .025 * rig.root.getWorldScale(new Vector3()).x / object.scale);
      }
      const contact = report?.hands.find(hand => hand.side === side)?.contactError
        ?? rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(studioPointToWorld(machineGripPoint(object, side), object));
      values[`${side}-hand`] = contact / object.scale;
    }
    return values;
  };
  try {
    const baselines = times.map(at => errors(before, at));
    const fits = (scene: WorkshopScene) => times.every((at, index) => Object.entries(errors(scene, at)).every(([constraint, value]) => value <= Math.max(.005, baselines[index][constraint] ?? 0) + .00001));
    if (fits(after)) return after;
    // Interpolate the actual edited values; leave machine placement and unrelated joints alone.
    const blend = (fraction: number): WorkshopScene => {
      const oldObject = before.studio!.objects.find(item => item.id === seat.id)!, nextObject = after.studio!.objects.find(item => item.id === seat.id)!;
      const old = sampleStudioObject(oldObject, timeMs), next = sampleStudioObject(nextObject, timeMs);
      const offsets = { seatOffsetX: (old.seatOffsetX ?? 0) + ((next.seatOffsetX ?? 0) - (old.seatOffsetX ?? 0)) * fraction,
        seatOffsetZ: (old.seatOffsetZ ?? 0) + ((next.seatOffsetZ ?? 0) - (old.seatOffsetZ ?? 0)) * fraction };
      let result = writeSeatOffsets(after, seat.id, timeMs, offsets);
      result = { ...result, studio: { ...result.studio!, objects: result.studio!.objects.map(item => item.id === seat.id ? {
        ...item, frames: item.frames?.map(frame => frame.timeMs === timeMs ? { ...frame, ...Object.fromEntries(
          (["machinePosition", "machinePositionLeft", "machinePositionRight"] as const).flatMap(field => {
            if (field !== "machinePosition" && old[field] === undefined && next[field] === undefined) return [];
            const a = old[field] ?? old.machinePosition, b = next[field] ?? next.machinePosition;
            return a !== undefined && b !== undefined ? [[field, a + (b - a) * fraction]] : [];
          })) } : frame),
      } : item) } };
      const original = sampleWorkshopPose(before.keyframes, timeMs);
      result = { ...result, keyframes: result.keyframes.map(frame => {
        const previous = before.keyframes.find(item => item.timeMs === frame.timeMs)?.poses ?? original;
        const poses: RigPose = { ...frame.poses };
        for (const joint of Object.keys(poses) as (keyof RigPose)[]) {
          const value = poses[joint]!, start = previous[joint] ?? { x: 0, y: 0, z: 0 };
          poses[joint] = { x: start.x + (value.x - start.x) * fraction, y: start.y + (value.y - start.y) * fraction, z: start.z + (value.z - start.z) * fraction };
        }
        return { ...frame, poses };
      }) };
      return result;
    };
    let low = 0, high = 1;
    for (let step = 1; step <= 8; step++) {
      const fraction = step / 8;
      if (!fits(blend(fraction))) { high = fraction; break; }
      low = fraction;
    }
    for (let step = 0; step < 10; step++) {
      const middle = (low + high) / 2;
      if (fits(blend(middle))) low = middle; else high = middle;
    }
    return low > .0001 ? blend(low) : before;
  } finally { rig.dispose(); }
}
