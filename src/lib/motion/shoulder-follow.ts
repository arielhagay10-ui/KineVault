import { Euler, Quaternion } from "three";
import { createHeldWeightPoseSampler, editHeldWeightPose } from "./held-weight-pose";
import { fitMachinePose } from "./machine-pose-fit";
import { rowLeverPosition, rowUsesHand } from "./plate-row";
import { isStudioMachine, setMachinePosition } from "./studio-machines";
import { clamp, sampleStudioObject, setStudioObjectAnimated } from "./studio";
import { jointLimits, type JointAngles, type RigPose, type StudioObject, type WorkshopScene } from "./workshop";

const radians = Math.PI / 180;
const sides = ["left", "right"] as const;
const shoulderRotation = (angles: JointAngles) => new Quaternion().setFromEuler(new Euler(angles.x * radians, angles.y * radians, -angles.z * radians));

function handMachine(scene: WorkshopScene, side: "left" | "right") {
  return scene.studio?.objects.find(object => isStudioMachine(object.slug) && object.slug !== "leg-press"
    && (["row-machine", "t-bar-row-machine"].includes(object.slug) ? rowUsesHand(object, side)
      : object.machineUse || object.slug !== "cable-row-machine" && (object.attachment === side || object.attachment === "both")));
}

/** Fit the existing shoulder controls to the equipment's reachable arm motion. */
export function editShoulderWithElbow(scene: WorkshopScene, frameIndex: number, all: boolean, changes: RigPose, axis?: "x" | "y" | "z", anchorSide?: "left" | "right"): WorkshopScene {
  const times = all ? scene.keyframes.map(frame => frame.timeMs) : [scene.keyframes[frameIndex].timeMs];
  const sampler = createHeldWeightPoseSampler();
  let next = scene;
  try {
    for (const time of times) {
      const editedSides = sides.filter(side => changes[`${side}-shoulder`]);
      const machines = new Map<string, { object: StudioObject; hands: ("left" | "right")[] }>();
      const displayed = sampler.sample(next, time), freeChanges: RigPose = {};
      for (const side of editedSides) {
        const machine = handMachine(next, side);
        if (machine) {
          const key = ["row-machine", "shoulder-press-machine", "chest-press-machine"].includes(machine.slug) ? `${machine.id}:${side}` : machine.id;
          const entry = machines.get(key) ?? { object: machine, hands: [] };
          entry.hands.push(side); machines.set(key, entry);
          continue;
        }
        const shoulder = `${side}-shoulder` as const, elbow = `${side}-elbow` as const;
        const before = displayed[shoulder] ?? { x: 0, y: 0, z: 0 }, after = changes[shoulder]!;
        const bend = displayed[elbow] ?? { x: 0, y: 0, z: 0 };
        // Counter-rotate the elbow so the forearm keeps its direction as the upper arm moves.
        const rotation = shoulderRotation(after).invert().multiply(shoulderRotation(before))
          .multiply(new Quaternion().setFromEuler(new Euler(-bend.x * radians, bend.y * radians, -bend.z * radians)));
        const angles = new Euler().setFromQuaternion(rotation);
        freeChanges[shoulder] = after;
        freeChanges[elbow] = { x: clamp(-angles.x / radians, ...jointLimits[elbow].x), y: clamp(angles.y / radians, ...jointLimits[elbow].y), z: clamp(-angles.z / radians, ...jointLimits[elbow].z) };
      }
      for (const { object, hands } of machines.values()) {
        const currentObject = next.studio!.objects.find(item => item.id === object.id)!;
        const independent = ["row-machine", "shoulder-press-machine", "chest-press-machine"].includes(object.slug), sampled = sampleStudioObject(currentObject, time);
        const shoulderEdits = Object.fromEntries(hands.map(hand => [`${hand}-shoulder`, changes[`${hand}-shoulder`]]));
        const posed = independent ? { ...next, keyframes: next.keyframes.map(frame => frame.timeMs === time ? { ...frame, poses: { ...frame.poses, ...shoulderEdits } } : frame) } : next;
        const current = independent ? rowLeverPosition(sampled, hands[0]) : sampled.machinePosition ?? .5;
        const best = fitMachinePose(current, position => {
          const candidate = setMachinePosition({ ...sampled, frames: undefined }, position, time, independent ? hands[0] : undefined);
          // Score the edited arm without repeatedly solving the other press lever.
          if (["shoulder-press-machine", "chest-press-machine"].includes(object.slug)) candidate.attachment = hands[0];
          const pose = sampler.sample({ ...posed, studio: { ...posed.studio!, objects: posed.studio!.objects.map(item => item.id === object.id ? candidate : item) } }, time);
          let error = 0;
          for (const hand of hands) {
            const actual = pose[`${hand}-shoulder`]!, target = changes[`${hand}-shoulder`]!;
            if (axis) {
              const difference = (actual[axis] - target[axis] + 540) % 360 - 180;
              error += difference ** 2;
            } else error += (shoulderRotation(actual).angleTo(shoulderRotation(target)) / radians) ** 2;
          }
          return error;
        });
        const animated = setStudioObjectAnimated(currentObject, true, time, next.keyframes.map(frame => frame.timeMs));
        const moved = setMachinePosition(animated, best, time, independent ? hands[0] : undefined);
        next = { ...posed, studio: { ...posed.studio!, objects: posed.studio!.objects.map(item => item.id === moved.id ? moved : item) } };
      }
      if (Object.keys(freeChanges).length) next = editHeldWeightPose(next, next.keyframes.findIndex(frame => frame.timeMs === time), "selected", freeChanges, anchorSide);
    }
    return next;
  } finally { sampler.dispose(); }
}
