import { Euler, Group, Vector3 } from "three";
import { correctAuthoredArmPath, createAnatomyRig, plantAnatomyFeet, poseAnatomyRig } from "./anatomy";
import { automaticWeightTransform, poseArmDrivenWeight, solveDumbbellGrip } from "./automatic-weight-grip";
import { forearmRotationForScene } from "./equipment-motion";
import { barbellWristPose, solveBarbellGrip } from "./barbell-grip";
import { carryHeldWeightsWithBody } from "./held-weight-body";
import { sampleStudioObject, studioPointToWorld, updateStudioObjectTransform } from "./studio";
import { constrainFrontalPose } from "./studio-constraints";
import { weightGripPoint } from "./studio-grip";
import { applyStudioSeating } from "./studio-seat";
import { identityTransform, sampleWorkshopPose, type RigPose, type StudioObject, type WorkshopScene } from "./workshop";

const sides = ["left", "right"] as const;
export const canCarryWithArm = (item: StudioObject) => ["dumbbell", "barbell", "kettlebell"].includes(item.slug)
  && item.attachment !== "none" && (item.attachment !== "both" || item.slug === "barbell")
  && !sides.some(side => (item.attachment === side || item.attachment === "both") && item.elbowLocks?.[side]);

export function sampleHeldWeightPose(scene: WorkshopScene, timeMs: number): RigPose {
  const pose = constrainFrontalPose(sampleWorkshopPose(scene.keyframes, timeMs), scene.studio?.frontalPlane);
  const weights = scene.studio?.objects.filter(item => canCarryWithArm(item) && !(item.poseDriver === "arm" && item.attachment !== "both")) ?? [];
  if (!weights.length) return pose;
  const rig = createAnatomyRig(new Group()), parent = new Group(), body = scene.studio!.body;
  parent.position.set(body.x, body.y, body.z);
  parent.rotation.set(body.rotationX * Math.PI / 180, body.rotationY * Math.PI / 180, body.rotationZ * Math.PI / 180);
  parent.scale.setScalar(body.scale); parent.add(rig.root);
  try {
    poseAnatomyRig(rig, pose, true, forearmRotationForScene(scene));
    plantAnatomyFeet(rig, scene.motionStyle, pose); correctAuthoredArmPath(rig, scene.motionStyle, pose);
    applyStudioSeating(rig, scene.studio, timeMs, pose);
    const result = { ...pose };
    for (const weight of weights) {
      const item = sampleStudioObject(weight, timeMs);
      const armDriven = item.poseDriver !== undefined && item.poseDriver !== "weight";
      if (armDriven) poseArmDrivenWeight(rig, item, pose, scene.studio?.frontalPlane);
      for (const side of sides.filter(side => item.attachment === side || item.attachment === "both")) {
        if (armDriven && item.slug === "barbell") result[`${side}-wrist`] = barbellWristPose(rig, side);
        if (armDriven && (item.attachment !== "both" || side === (item.poseDriver === "right-arm" ? "right" : "left"))) continue;
        const target = studioPointToWorld(weightGripPoint(item, side), item);
        if (!armDriven && item.slug === "barbell") solveBarbellGrip(rig, side, pose, target, new Vector3(1, 0, 0).applyEuler(new Euler(
          item.rotationX * Math.PI / 180, item.rotationY * Math.PI / 180, item.rotationZ * Math.PI / 180)), scene.studio?.frontalPlane);
        else if (!armDriven) solveDumbbellGrip(rig, { ...item, attachment: side }, pose, target, scene.studio?.frontalPlane);
        if (item.slug === "barbell") result[`${side}-wrist`] = barbellWristPose(rig, side);
        for (const part of ["shoulder", "elbow"] as const) {
          const joint = `${side}-${part}` as const, rotation = rig.bones[joint].rotation;
          result[joint] = { x: rotation.x * 180 / Math.PI * (part === "elbow" ? -1 : 1), y: rotation.y * 180 / Math.PI, z: -rotation.z * 180 / Math.PI };
        }
      }
    }
    return result;
  } finally { rig.dispose(); }
}

export function editHeldWeightPose(scene: WorkshopScene, selectedFrame: number, scope: "selected" | "all", changes: RigPose): WorkshopScene {
  const shared = scene.studio?.objects.some(item => canCarryWithArm(item) && item.attachment === "both");
  const controlledSides = sides.filter(side => changes.torso || ["shoulder", "elbow", "wrist"].some(part => changes[`${side}-${part}` as keyof RigPose]));
  // A wrist-only edit must start from the visible weight-driven arm, including
  // untouched moments: changing the driver applies to the whole weight path.
  const wristControlSides = sides.filter(side => changes[`${side}-wrist`] && !changes.torso
    && !changes[`${side}-shoulder`] && !changes[`${side}-elbow`]
    && scene.studio?.objects.some(item => canCarryWithArm(item) && item.attachment === side
      && (item.poseDriver === undefined || item.poseDriver === "weight")));
  const selectedTime = scene.keyframes[selectedFrame].timeMs;
  const weightTimes = scene.studio?.objects.filter(item => canCarryWithArm(item)
    && wristControlSides.some(side => item.attachment === side))
    .flatMap(item => item.frames?.map(frame => frame.timeMs) ?? []) ?? [];
  const times = [...new Set([...scene.keyframes.map(frame => frame.timeMs),
    ...weightTimes.filter(time => time >= 0 && time <= scene.durationMs)])].sort((a, b) => a - b);
  if (times.length > 24) throw new Error("Keeping this weight path needs more than 24 poses. Remove unused moments in Timeline first.");
  const frames = times.map(timeMs => scene.keyframes.find(frame => frame.timeMs === timeMs)
    ?? { timeMs, poses: sampleWorkshopPose(scene.keyframes, timeMs) });
  const driver = controlledSides.length === 1 && controlledSides[0] === "right" ? "right-arm" : "left-arm";
  // Preserve displayed poses at other moments when switching the driving arm.
  // At the edited moment, only the first weight-to-arm change samples solved
  // joints. Reusing follower compensations on later edits makes the pose drift.
  const takingControl = controlledSides.length > 0 && scene.studio?.objects.some(item => canCarryWithArm(item) && item.attachment === "both" && item.poseDriver !== driver);
  const takingWeightControl = controlledSides.length > 0 && scene.studio?.objects.some(item => canCarryWithArm(item) && item.attachment === "both" && (item.poseDriver === undefined || item.poseDriver === "weight"));
  const next = { ...scene, keyframes: frames.map(frame => {
    const edited = frame.timeMs === selectedTime || scope === "all";
    if (!edited && !wristControlSides.length) return frame;
    const poses = { ...(edited && takingWeightControl ? sampleHeldWeightPose(scene, frame.timeMs) : frame.poses) };
    if (wristControlSides.length) {
      const displayed = sampleHeldWeightPose(scene, frame.timeMs);
      for (const side of wristControlSides) for (const part of ["shoulder", "elbow"] as const) poses[`${side}-${part}`] = displayed[`${side}-${part}`];
    }
    return { ...frame, poses: constrainFrontalPose({ ...poses, ...(edited ? changes : {}) }, scene.studio?.frontalPlane) };
  }) };
  let carried = carryHeldWeights(scene, next, controlledSides.length === 1 ? controlledSides[0] : undefined);
  if (!carried.studio) return carried;
  if (shared && takingControl) carried = { ...carried, keyframes: carried.keyframes.map(frame =>
    frame.timeMs === selectedTime || scope === "all" ? frame : { ...frame, poses: sampleHeldWeightPose(scene, frame.timeMs) }) };
  // Choosing an authored joint also takes control when its numeric value is unchanged.
  return { ...carried, studio: { ...carried.studio!, objects: carried.studio!.objects.map(item =>
    canCarryWithArm(item) && controlledSides.some(side => item.attachment === side) && item.poseDriver !== "arm"
      ? { ...item, poseDriver: "arm" } : item,
  ) } };
}

/** Keep authored weight paths at other moments, while carrying edited hands' weights. */
export function carryHeldWeights(previous: WorkshopScene, next: WorkshopScene, anchorSide?: "left" | "right"): WorkshopScene {
  next = carryHeldWeightsWithBody(previous, next);
  if (!next.studio) return next;
  const edits = next.keyframes.flatMap(frame => {
    const oldFrame = previous.keyframes.find(old => old.timeMs === frame.timeMs);
    if (frame === oldFrame) return [];
    const before = oldFrame?.poses ?? sampleWorkshopPose(previous.keyframes, frame.timeMs);
    const moved = sides.filter(side => ["torso", `${side}-shoulder`, `${side}-elbow`, `${side}-wrist`].some(name => {
      const slug = name as keyof RigPose;
      const oldAngles = before[slug] ?? { x: name.endsWith("wrist") ? forearmRotationForScene(previous) - 90 : 0, y: 0, z: 0 };
      const newAngles = frame.poses[slug] ?? { x: name.endsWith("wrist") ? forearmRotationForScene(next) - 90 : 0, y: 0, z: 0 };
      return ["x", "y", "z"].some(axis => Math.abs(oldAngles[axis as keyof typeof oldAngles] - newAngles[axis as keyof typeof newAngles]) > .000001);
    }));
    return moved.length ? [{ timeMs: frame.timeMs, sides: moved }] : [];
  });
  return { ...next, studio: { ...next.studio, objects: next.studio.objects.map(item => {
    if (!canCarryWithArm(item)) return item;
    const moments = edits.filter(edit => edit.sides.some(side => item.attachment === side || item.attachment === "both"));
    if (!moments.length) return item;
    let placed: StudioObject = { ...item, poseDriver: item.attachment === "both" ? (anchorSide === "right" ? "right-arm" : "left-arm") : "arm" };
    // Materialize unchanged keyframes before changing a static weight's first position.
    for (const frame of previous.keyframes) if (!placed.frames?.some(saved => saved.timeMs === frame.timeMs)) placed = updateStudioObjectTransform(placed, sampleStudioObject(item, frame.timeMs), frame.timeMs, true);
    for (const moment of moments) {
      const side = moment.sides.find(side => item.attachment === side || item.attachment === "both")!;
      const sampled = sampleStudioObject(item, moment.timeMs);
      placed = updateStudioObjectTransform(placed, automaticWeightTransform(next.studio!.body ?? identityTransform, sampled, item.attachment === "both" ? "both" : side, next, moment.timeMs, anchorSide), moment.timeMs, true);
    }
    return placed;
  }) } };
}
