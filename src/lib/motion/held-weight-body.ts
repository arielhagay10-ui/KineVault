import { Euler, Group, Matrix4, Quaternion } from "three";
import { correctAuthoredArmPath, createAnatomyRig, plantAnatomyFeet, poseAnatomyRig } from "./anatomy";
import { forearmRotationForScene } from "./equipment-motion";
import { sampleStudioObject, studioPointFromWorld, studioPointToWorld } from "./studio";
import { applyStudioSeating } from "./studio-seat";
import { weightGripPoint } from "./studio-grip";
import { type SceneTransform, type WorkshopScene, sampleWorkshopPose } from "./workshop";

function bodyMatrix(scene: WorkshopScene, timeMs: number) {
  const rig = createAnatomyRig(new Group()), parent = new Group(), body = scene.studio!.body;
  parent.position.set(body.x, body.y, body.z);
  parent.rotation.set(body.rotationX * Math.PI / 180, body.rotationY * Math.PI / 180, body.rotationZ * Math.PI / 180);
  parent.scale.setScalar(body.scale); parent.add(rig.root);
  try {
    const pose = sampleWorkshopPose(scene.keyframes, timeMs);
    poseAnatomyRig(rig, pose, true, forearmRotationForScene(scene));
    plantAnatomyFeet(rig, scene.motionStyle, pose); correctAuthoredArmPath(rig, scene.motionStyle, pose);
    applyStudioSeating(rig, scene.studio, timeMs, pose);
    rig.root.updateWorldMatrix(true, true);
    return rig.root.matrixWorld.clone();
  } finally { rig.dispose(); }
}

function supportContext(scene: WorkshopScene) {
  const studio = scene.studio;
  const bench = studio?.objects.find(item => item.id === studio.seating?.benchId);
  return JSON.stringify([studio?.body, studio?.seating, bench && [bench.x, bench.y, bench.z, bench.rotationX, bench.rotationY, bench.rotationZ, bench.scale, bench.benchAngle, bench.frames]]);
}

/** Carry existing held weights when the body's placement or bench support changes. */
export function carryHeldWeightsWithBody(previous: WorkshopScene, next: WorkshopScene): WorkshopScene {
  if (!previous.studio || !next.studio || supportContext(previous) === supportContext(next)) return next;
  const deltas = new Map<number, Matrix4>();
  const deltaAt = (time: number) => {
    let delta = deltas.get(time);
    if (!delta) { delta = bodyMatrix(next, time).multiply(bodyMatrix(previous, time).invert()); deltas.set(time, delta); }
    return delta;
  };
  return { ...next, studio: { ...next.studio, objects: next.studio.objects.map(item => {
    const old = previous.studio!.objects.find(old => old.id === item.id);
    if (!old || !["dumbbell", "barbell", "kettlebell"].includes(item.slug) || item.attachment === "none" || old.attachment !== item.attachment) return item;
    // Replacement setups and restored drafts already contain their own weight positions.
    const transform = ({ x, y, z, rotationX, rotationY, rotationZ, scale, frames }: typeof item) => [x, y, z, rotationX, rotationY, rotationZ, scale, frames];
    if (JSON.stringify(transform(old)) !== JSON.stringify(transform(item))) return item;
    const move = (time: number): SceneTransform => {
      const sampled = sampleStudioObject(item, time), delta = deltaAt(time);
      const rotation = new Quaternion().setFromRotationMatrix(new Matrix4().extractRotation(delta))
        .multiply(new Quaternion().setFromEuler(new Euler(sampled.rotationX * Math.PI / 180, sampled.rotationY * Math.PI / 180, sampled.rotationZ * Math.PI / 180)));
      const side = sampled.attachment === "right" ? "right" : "left";
      const grip = sampled.attachment === "both" ? weightGripPoint(sampled, "left").add(weightGripPoint(sampled, "right")).multiplyScalar(.5) : weightGripPoint(sampled, side);
      // Keep the contact on the scaled palm without resizing the weight itself.
      const position = studioPointToWorld(grip, sampled).applyMatrix4(delta)
        .sub(grip.multiplyScalar(sampled.scale).applyQuaternion(rotation));
      const angles = new Euler().setFromQuaternion(rotation);
      return { x: position.x, y: position.y, z: position.z, rotationX: angles.x * 180 / Math.PI, rotationY: angles.y * 180 / Math.PI, rotationZ: angles.z * 180 / Math.PI, scale: sampled.scale };
    };
    const supportTimes = (scene: WorkshopScene) => scene.studio?.objects.find(object => object.id === scene.studio?.seating?.benchId)?.frames?.map(frame => frame.timeMs) ?? [];
    const times = [...new Set([...(item.frames?.map(frame => frame.timeMs) ?? []),
      ...previous.keyframes.map(frame => frame.timeMs), ...next.keyframes.map(frame => frame.timeMs),
      ...supportTimes(previous), ...supportTimes(next)])].sort((a, b) => a - b);
    if (times.length > 24) throw new Error("This change needs more than 24 weight moments. Remove unused moments in Timeline first.");
    const frames = times.map(timeMs => ({ ...item.frames?.find(frame => frame.timeMs === timeMs), timeMs, ...move(timeMs) }));
    const elbowLocks = item.elbowLocks && Object.fromEntries(Object.entries(item.elbowLocks).map(([side, point]) => [side,
      studioPointFromWorld(studioPointToWorld(point, previous.studio!.body).applyMatrix4(deltaAt(0)), next.studio!.body),
    ]));
    return { ...item, ...move(0), frames, elbowLocks };
  }) } };
}
