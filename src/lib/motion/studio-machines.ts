import { Euler, Object3D, Quaternion, Vector3 } from "three";
import type { AnatomyRig } from "./anatomy";
import { reachStudioGrip, studioGripOffset } from "./studio-grip";
import { cableLocalGrip, studioCableFrame } from "./studio-cable";
import { rowCarriagePoint, rowHandleHeight } from "./studio-row";
export { rowHandleHeight, rowPulleyPoint } from "./studio-row";
import { sampleStudioObject, studioAssetNames, studioPointToWorld } from "./studio";
import { identityTransform, sampleWorkshopPose, type StudioObject, type WorkshopScene } from "./workshop";

export const machineSlugs = ["lat-pulldown-machine", "smith-machine", "leg-press", "cable-row-machine", "pec-deck"] as const;
export type MachineSlug = typeof machineSlugs[number];
export const isStudioMachine = (slug: string): slug is MachineSlug => machineSlugs.some(machine => machine === slug);
export type MachineGripChoices = Pick<StudioObject, "machinePalm" | "machineElbowPath">;
export type MachineReachReport = {
  objectId: string; timeMs: number;
  hands: { side: "left" | "right"; contactError: number; wristBendDegrees: number; elbowPathDeviation: number }[];
  warnings: { side: "left" | "right"; kind: "reach" | "wrist" | "elbow-path"; message: string; repair: string }[];
};
export function machineGripChoices(object: StudioObject): Required<MachineGripChoices> {
  return { machinePalm: object.machinePalm ?? (object.machineMode === "reverse" ? "outward" : "inward"), machineElbowPath: object.machineElbowPath ?? (object.slug === "cable-row-machine" ? "beside-body" : "shoulder-height") };
}
export function setMachineGripChoices(scene: WorkshopScene, id: string, choices: MachineGripChoices): WorkshopScene {
  const studio = scene.studio;
  if (!studio?.objects.some(object => object.id === id && ["cable-row-machine", "pec-deck"].includes(object.slug))) return scene;
  return { ...scene, studio: { ...studio, objects: studio.objects.map(object => object.id === id ? { ...object, ...choices } : object) } };
}

export const rowFootplate = { angle: -Math.PI / 4, y: 0.24, z: 1.12, length: 0.5, width: 0.25, thickness: 0.05 };
export const reversePecDeckSeatZ = 0.136;
export function rowFootPoint(side: "left" | "right") {
  // Sole height is 0.14 atlas units below the ankle. Center the sole on the plate.
  return new Vector3(0, 0.14 * 0.85 + rowFootplate.thickness / 2, -0.065)
    .applyAxisAngle(new Vector3(1, 0, 0), rowFootplate.angle)
    .add(new Vector3(side === "left" ? 0.17 : -0.17, rowFootplate.y, rowFootplate.z));
}

// Machine coordinates are independent of the frame placement. Only the carriage moves.
export function machineCarriagePoint(object: StudioObject) {
  const travel = object.machinePosition ?? 0.5;
  if (object.slug === "lat-pulldown-machine") return new Vector3(0, object.machineGrip === "pronated" ? 2.53 - travel * 0.93 : 2.58 - travel * 0.98, 0.22);
  if (object.slug === "smith-machine") return new Vector3(0, 1.53 + travel * 0.65, -0.12);
  if (object.slug === "cable-row-machine") return rowCarriagePoint(object);
  if (object.slug === "pec-deck") return machineHandlePoint(object, "left");
  return new Vector3(0, 1.1 + travel * 0.4, 0.24 + travel * 0.4);
}

export function machineHandlePoint(object: StudioObject, side: "left" | "right"): Vector3 {
  const sign = side === "left" ? 1 : -1;
  if (object.slug === "pec-deck") {
    const reverse = object.machineMode === "reverse";
    const travel = object.machinePosition ?? 0.5;
    const angle = (reverse ? -9 + 89 * travel : 80 - 89 * travel) * Math.PI / 180;
    return new Vector3(sign * (0.289 + 0.955 * Math.sin(angle)), 1.55, 0.955 * Math.cos(angle))
      .applyAxisAngle(new Vector3(0, 1, 0), reverse ? Math.PI : 0).add(new Vector3(0, 0, reverse ? reversePecDeckSeatZ : 0));
  }
  if (object.slug === "leg-press") return new Vector3(sign * 0.36, 0.74, -0.32);
  const point = machineCarriagePoint(object);
  point.x = sign * (object.slug === "cable-row-machine" ? 0.15 : object.slug === "smith-machine" ? 0.56 : 0.48);
  return point;
}

export const machineTravelLabels: Record<MachineSlug, string> = {
  "lat-pulldown-machine": "Pulldown travel", "smith-machine": "Bar height", "leg-press": "Sled extension",
  "cable-row-machine": "Row pull", "pec-deck": "Arm closure",
};
export const machineContactDescriptions: Record<MachineSlug, string> = {
  "lat-pulldown-machine": "The seat supports the figure and both hands follow the pulldown bar.",
  "smith-machine": "Squat with planted feet. The bar stays on its guide rails.",
  "leg-press": "The back stays supported and both feet follow the sled.",
  "cable-row-machine": "Sit with feet on the footplates. Both hands follow the row handle toward the torso.",
  "pec-deck": "The seat and back pad support the figure. Both hands follow the arms as they close in front of the chest.",
};

export function setMachinePosition(object: StudioObject, position: number, timeMs: number): StudioObject {
  const machinePosition = Math.max(0, Math.min(1, position));
  if (!object.frames?.length) return { ...object, machinePosition };
  const sampled = sampleStudioObject(object, timeMs);
  const transform = { ...identityTransform };
  for (const key of Object.keys(transform) as (keyof typeof transform)[]) transform[key] = sampled[key];
  const frames = object.frames.filter(frame => frame.timeMs !== timeMs);
  return { ...object, frames: [...frames, { ...transform, timeMs, machinePosition, ...(sampled.machineHandleHeight !== undefined ? { machineHandleHeight: sampled.machineHandleHeight } : {}) }].sort((a, b) => a.timeMs - b.timeMs) };
}

export function setMachineHandleHeight(object: StudioObject, height: number, timeMs: number): StudioObject {
  if (object.slug !== "cable-row-machine" || !Number.isFinite(height)) return object;
  const machineHandleHeight = Math.max(rowHandleHeight.min, Math.min(rowHandleHeight.max, height));
  if (!object.frames?.length) return { ...object, machineHandleHeight };
  const sampled = sampleStudioObject(object, timeMs), transform = { ...identityTransform };
  for (const key of Object.keys(transform) as (keyof typeof transform)[]) transform[key] = sampled[key];
  return { ...object, frames: [...object.frames.filter(frame => frame.timeMs !== timeMs), { ...transform, timeMs, machinePosition: sampled.machinePosition, machineHandleHeight }].sort((a, b) => a.timeMs - b.timeMs) };
}

export function setPecDeckMode(scene: WorkshopScene, id: string, machineMode: "regular" | "reverse"): WorkshopScene {
  const studio = scene.studio;
  if (!studio?.objects.some(object => object.id === id && object.slug === "pec-deck")) return scene;
  return { ...scene, studio: { ...studio,
    objects: studio.objects.map(object => object.id === id ? { ...object, machineMode } : object),
  } };
}

function plantMachineFoot(rig: AnatomyRig, side: "left" | "right", target: Vector3, facing: Quaternion, footRotation: Quaternion) {
  const hip = rig.bones[`${side}-hip`], knee = rig.bones[`${side}-knee`], foot = rig.footBones[side];
  const scale = rig.root.getWorldScale(new Vector3()).x;
  const upper = knee.position.length() * scale, lower = foot.position.length() * scale;
  const origin = hip.getWorldPosition(new Vector3()), direction = target.clone().sub(origin);
  const distance = Math.max(Math.abs(upper - lower) + 1e-6, Math.min(direction.length(), upper + lower - 1e-6));
  direction.normalize();
  const sagittalUpper = Math.hypot(knee.position.y, knee.position.z) * scale;
  const restAngle = Math.atan2(knee.position.z, -knee.position.y);
  knee.rotation.set(Math.acos(Math.max(-1, Math.min(1, (distance ** 2 - upper ** 2 - lower ** 2) / (2 * sagittalUpper * lower)))) - restAngle, 0, 0);
  const reach = knee.position.clone().add(foot.position.clone().applyQuaternion(knee.quaternion)).normalize();
  const hipWorld = new Quaternion().setFromUnitVectors(reach, direction);
  const hinge = new Vector3(1, 0, 0).applyQuaternion(hipWorld);
  hinge.addScaledVector(direction, -hinge.dot(direction)).normalize();
  const normal = new Vector3(1, 0, 0).applyQuaternion(facing);
  normal.addScaledVector(direction, -normal.dot(direction)).normalize();
  hipWorld.premultiply(new Quaternion().setFromAxisAngle(direction, Math.atan2(direction.dot(hinge.clone().cross(normal)), hinge.dot(normal))));
  hip.quaternion.copy(hip.parent!.getWorldQuaternion(new Quaternion()).invert()).multiply(hipWorld);
  rig.root.updateWorldMatrix(true, true);
  foot.quaternion.copy(knee.getWorldQuaternion(new Quaternion()).invert()).multiply(footRotation);
  rig.root.updateWorldMatrix(true, true);
}

export function applyStudioMachine(rig: AnatomyRig, scene: WorkshopScene, timeMs: number): MachineReachReport | undefined {
  const raw = scene.studio?.objects.find(object => object.machineUse && isStudioMachine(object.slug));
  if (!raw) return;
  // Machine supports determine torso alignment, including old authored poses.
  rig.bones.torso.quaternion.identity();
  const object = sampleStudioObject(raw, timeMs), carriage = machineCarriagePoint(object);
  const radians = Math.PI / 180;
  const facing = new Quaternion().setFromEuler(new Euler(object.rotationX * radians, object.rotationY * radians, object.rotationZ * radians));
  const reverse = object.slug === "pec-deck" && object.machineMode === "reverse";
  const bodyFacing = facing.clone();
  if (reverse) bodyFacing.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI));
  const rootRotation = bodyFacing.clone();
  if (object.slug === "leg-press") rootRotation.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 4));
  const parentRotation = rig.root.parent?.getWorldQuaternion(new Quaternion()) ?? new Quaternion();
  rig.root.quaternion.copy(parentRotation.invert().multiply(rootRotation));
  // Match the machine's scale, keeping support/contact when the user resizes it.
  const parentScale = rig.root.parent?.getWorldScale(new Vector3()).x ?? 1;
  rig.root.scale.setScalar(0.85 * object.scale / parentScale);
  const pelvisPoint = object.slug === "smith-machine" ? { x: 0, y: carriage.y - 0.75, z: 0.05 }
    : object.slug === "leg-press" ? { x: 0, y: 0.72, z: -0.51 } : { x: 0, y: 0.82, z: reverse ? reversePecDeckSeatZ : 0 };
  const pelvis = studioPointToWorld(pelvisPoint, object);
  const scale = rig.root.getWorldScale(new Vector3()).x;
  const origin = pelvis.sub(rig.bones.pelvis.position.clone().multiplyScalar(scale).applyQuaternion(rootRotation));
  rig.root.position.copy(rig.root.parent ? rig.root.parent.worldToLocal(origin) : origin);
  rig.root.updateWorldMatrix(true, true);
  for (const side of ["left", "right"] as const) {
    const sign = side === "left" ? 1 : -1;
    const footPoint = object.slug === "leg-press" ? { x: sign * 0.17, y: carriage.y - 0.085, z: carriage.z - 0.085 }
      : object.slug === "cable-row-machine" ? rowFootPoint(side)
      : { x: sign * (reverse ? -0.24 : 0.17), y: 0.119, z: object.slug === "smith-machine" ? 0.22 : reverse ? reversePecDeckSeatZ - 0.6 : 0.6 };
    const footRotation = bodyFacing.clone();
    if (object.slug === "cable-row-machine") footRotation.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), rowFootplate.angle));
    if (object.slug === "leg-press") footRotation.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -3 * Math.PI / 4));
    plantMachineFoot(rig, side, studioPointToWorld(footPoint, object), bodyFacing, footRotation);
    if (object.slug === "cable-row-machine" && object.cableAttachment) continue;
    const grip = machineHandlePoint(object, side);
    if (object.slug === "lat-pulldown-machine" && object.machineGrip === "pronated") reachFrontalPulldownGrip(rig, side, studioPointToWorld(grip, object), facing);
    else if (object.slug === "smith-machine") reachSmithBar(rig, side, studioPointToWorld(grip, object), facing);
    else if (object.slug === "cable-row-machine" || object.slug === "pec-deck") reachSeatedMachineGrip(rig, side, studioPointToWorld(grip, object), bodyFacing, object);
    else reachStudioGrip(rig, side, studioPointToWorld(grip, object), bodyFacing);
  }
  let cableFrame: ReturnType<typeof studioCableFrame> | undefined;
  if (object.slug === "cable-row-machine" && object.cableAttachment) {
    const tower = new Object3D();
    tower.position.set(object.x, object.y, object.z); tower.quaternion.copy(facing); tower.scale.setScalar(object.scale);
    cableFrame = studioCableFrame(rig, object, tower, sampleWorkshopPose(scene.keyframes, timeMs));
  }
  if (object.slug === "smith-machine" || object.slug === "cable-row-machine" || object.slug === "pec-deck" || (object.slug === "lat-pulldown-machine" && object.machineGrip === "pronated")) {
    const curls: Record<string, number[]> = { second: [90, 75, 95], third: [90, 115, 30], fourth: [85, 115, 45], fifth: [70, 110, 65] };
    for (const segment of rig.fingerSegments) {
      if (segment.thumb) {
        segment.bone.rotation.set((segment.part === "Proximal" ? 30 : -10) * Math.PI / 180, 0,
          segment.part === "Proximal" ? (segment.side === "left" ? -15 : 15) * Math.PI / 180 : 0);
        continue;
      }
      const finger = segment.name.match(/of_(second|third|fourth|fifth)_finger/)?.[1];
      if (!finger) continue;
      const part = segment.part === "Proximal" ? 0 : segment.part === "Middle" ? 1 : 2;
      segment.bone.rotation.x = -curls[finger][part] * Math.PI / 180;
    }
  }
  rig.root.updateWorldMatrix(true, true); rig.skeleton.update();
  if (object.slug !== "cable-row-machine" && object.slug !== "pec-deck") return;
  const report: MachineReachReport = { objectId: object.id, timeMs, hands: [], warnings: [] };
  const inverseFacing = bodyFacing.clone().invert();
  for (const side of ["left", "right"] as const) {
    if (cableFrame && ![side, "both"].includes(object.attachment)) continue;
    if (cableFrame?.kind === "cuff") continue;
    const hand = rig.handBones[side], elbow = rig.bones[`${side}-elbow`], shoulder = rig.bones[`${side}-shoulder`];
    const cableGrip = cableFrame?.kind === "rope" ? cableFrame.ropeGrips.find(grip => grip.side === side)?.point
      : cableFrame ? cableLocalGrip(cableFrame.kind, side).point.multiplyScalar(cableFrame.scale).applyQuaternion(cableFrame.rotation).add(cableFrame.center) : undefined;
    const contactError = cableGrip ? hand.localToWorld(studioGripOffset(side)).distanceTo(cableGrip)
      : hand.localToWorld(new Vector3(side === "left" ? 0.03 : -0.03, -0.11, 0.12)).distanceTo(studioPointToWorld(machineHandlePoint(object, side), object));
    const wristBendDegrees = new Vector3(0, -1, 0).applyQuaternion(hand.getWorldQuaternion(new Quaternion()))
      .angleTo(hand.getWorldPosition(new Vector3()).sub(elbow.getWorldPosition(new Vector3()))) * 180 / Math.PI;
    const relativeElbow = elbow.getWorldPosition(new Vector3()).sub(shoulder.getWorldPosition(new Vector3())).applyQuaternion(inverseFacing);
    const elbowPathDeviation = Math.abs(machineGripChoices(object).machineElbowPath === "beside-body" ? relativeElbow.x : relativeElbow.y);
    report.hands.push({ side, contactError, wristBendDegrees, elbowPathDeviation });
    if (contactError > 0.005 * object.scale) report.warnings.push({ side, kind: "reach", message: `${side === "left" ? "Left" : "Right"} hand cannot reach the handle.`, repair: "Shorten the start or finish range until the hand touches the handle." });
    if (wristBendDegrees > 45) report.warnings.push({ side, kind: "wrist", message: `${side === "left" ? "Left" : "Right"} wrist bends ${Math.round(wristBendDegrees)}° to keep hold.`, repair: "Shorten the range, change the palm choice, or try the other elbow path." });
    if (!cableFrame && elbowPathDeviation > 0.025 * object.scale) report.warnings.push({ side, kind: "elbow-path", message: `${side === "left" ? "Left" : "Right"} elbow leaves the chosen path to reach the handle.`, repair: "Shorten the range or try the other elbow path." });
  }
  return report;
}

// The palm's rotation must not choose the elbow's plane. Rows hinge beside the
// torso; fly elbows travel at shoulder height while the hand follows the arm.
function reachSeatedMachineGrip(rig: AnatomyRig, side: "left" | "right", target: Vector3, facing: Quaternion, object: StudioObject) {
  const sign = side === "left" ? 1 : -1, row = object.slug === "cable-row-machine";
  const reverse = object.machineMode === "reverse", travel = object.machinePosition ?? 0.5;
  const choices = machineGripChoices(object), beside = choices.machineElbowPath === "beside-body";
  const angle = row ? 0 : (reverse ? -9 + 89 * travel : 80 - 89 * travel) * Math.PI / 180;
  const handWorld = facing.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), sign * angle))
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), sign * (reverse ? -1 : 1) * Math.PI / 2))
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2));
  if (choices.machinePalm !== (reverse ? "outward" : "inward")) handWorld.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI));
  const shoulder = rig.bones[`${side}-shoulder`], elbow = rig.bones[`${side}-elbow`], hand = rig.handBones[side];
  const origin = shoulder.getWorldPosition(new Vector3()), scale = rig.root.getWorldScale(new Vector3()).x;
  const wrist = target.clone().sub(new Vector3(sign * 0.03, -0.11, 0.12).multiplyScalar(scale).applyQuaternion(handWorld));
  const local = wrist.clone().sub(origin).applyQuaternion(facing.clone().invert());
  const upper = elbow.position.length() * scale, lower = hand.position.length() * scale;
  const perpendicular = beside ? local.x : local.y;
  const inPlaneLower = Math.sqrt(Math.max(0, lower ** 2 - perpendicular ** 2));
  const direction = beside ? new Vector3(0, local.y, local.z) : new Vector3(local.x, 0, local.z);
  const distance = direction.length(); direction.normalize();
  const along = (upper ** 2 - inPlaneLower ** 2 + distance ** 2) / (2 * distance);
  const pole = beside ? new Vector3(0, -direction.z, direction.y) : new Vector3(sign * direction.z, 0, -sign * direction.x);
  let elbowTarget: Vector3;
  if (distance > 1e-6 && Math.abs(perpendicular) <= lower && Math.abs(along) <= upper) {
    elbowTarget = origin.clone().add(direction.multiplyScalar(along).addScaledVector(pole, Math.sqrt(Math.max(0, upper ** 2 - along ** 2))).applyQuaternion(facing));
  } else {
    // A plane may be unreachable even though the handle is within arm reach.
    // Solve the actual two-bone chain; report any path departure afterward.
    const fullDirection = wrist.clone().sub(origin);
    const reach = Math.max(Math.abs(upper - lower) + 1e-6, Math.min(fullDirection.length(), upper + lower - 1e-6));
    fullDirection.normalize();
    wrist.copy(origin).addScaledVector(fullDirection, reach);
    const forward = (upper ** 2 - lower ** 2 + reach ** 2) / (2 * reach);
    const planeNormal = (beside ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0)).applyQuaternion(facing);
    // The closest point on the elbow's reachable circle meets the planar
    // solution at its tangent. Switching to an arbitrary pole would snap.
    const bend = planeNormal.clone().addScaledVector(fullDirection, -planeNormal.dot(fullDirection));
    if (bend.lengthSq() < 1e-8) bend.copy((beside ? new Vector3(0, -1, 0) : new Vector3(sign, 0, 0)).applyQuaternion(facing));
    else bend.multiplyScalar(planeNormal.dot(fullDirection) * forward > 0 ? -1 : 1);
    bend.normalize();
    elbowTarget = origin.clone().addScaledVector(fullDirection, forward).addScaledVector(bend, Math.sqrt(Math.max(0, upper ** 2 - forward ** 2)));
  }
  poseMachineArm(rig, side, elbowTarget, wrist, handWorld);
}

function reachSmithBar(rig: AnatomyRig, side: "left" | "right", target: Vector3, facing: Quaternion) {
  const shoulder = rig.bones[`${side}-shoulder`], elbow = rig.bones[`${side}-elbow`];
  const hand = rig.handBones[side];
  const scale = rig.root.getWorldScale(new Vector3()).x, origin = shoulder.getWorldPosition(new Vector3());
  const handWorld = facing.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 172 * Math.PI / 180));
  const offset = new Vector3(side === "left" ? 0.03 : -0.03, -0.11, 0.12);
  const wrist = target.clone().sub(offset.multiplyScalar(scale).applyQuaternion(handWorld));
  const upper = elbow.position.length() * scale, lower = hand.position.length() * scale;
  const direction = wrist.clone().sub(origin), distance = direction.length(); direction.normalize();
  const along = (upper ** 2 - lower ** 2 + distance ** 2) / (2 * distance);
  const pole = new Vector3(0, -1, 0).applyQuaternion(facing);
  pole.addScaledVector(direction, -pole.dot(direction)).normalize();
  pole.applyAxisAngle(direction, (side === "left" ? 1 : -1) * 2 * Math.PI / 180);
  const elbowTarget = origin.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, upper ** 2 - along ** 2)));
  poseMachineArm(rig, side, elbowTarget, wrist, handWorld);
}

function poseMachineArm(rig: AnatomyRig, side: "left" | "right", elbowTarget: Vector3, wrist: Vector3, handWorld: Quaternion) {
  const shoulder = rig.bones[`${side}-shoulder`], elbow = rig.bones[`${side}-elbow`];
  const forearm = rig.forearmBones[side], hand = rig.handBones[side];
  const origin = shoulder.getWorldPosition(new Vector3());
  const lowerDirection = wrist.clone().sub(elbowTarget).normalize();
  const rotation = new Quaternion().setFromUnitVectors(hand.position.clone().normalize(), lowerDirection);
  const palm = new Vector3(0, 0, 1).applyQuaternion(rotation), desiredPalm = new Vector3(0, 0, 1).applyQuaternion(handWorld);
  palm.addScaledVector(lowerDirection, -palm.dot(lowerDirection)).normalize();
  desiredPalm.addScaledVector(lowerDirection, -desiredPalm.dot(lowerDirection)).normalize();
  rotation.premultiply(new Quaternion().setFromAxisAngle(lowerDirection, Math.atan2(lowerDirection.dot(palm.clone().cross(desiredPalm)), palm.dot(desiredPalm))));
  shoulder.quaternion.setFromUnitVectors(elbow.position.clone().normalize(), elbowTarget.sub(origin).normalize().applyQuaternion(shoulder.parent!.getWorldQuaternion(new Quaternion()).invert()));
  rig.root.updateWorldMatrix(true, true);
  elbow.quaternion.copy(shoulder.getWorldQuaternion(new Quaternion()).invert()).multiply(rotation).multiply(forearm.quaternion.clone().invert());
  hand.quaternion.copy(rotation.invert().multiply(handWorld));
  rig.shoulderCaps[side].quaternion.identity().slerp(shoulder.quaternion, 0.82);
  rig.root.updateWorldMatrix(true, true);
}

// Keep elbows in the frontal plane and closed hands aligned with the shaft.
function reachFrontalPulldownGrip(rig: AnatomyRig, side: "left" | "right", target: Vector3, facing: Quaternion) {
  const shoulder = rig.bones[`${side}-shoulder`], elbow = rig.bones[`${side}-elbow`];
  const hand = rig.handBones[side];
  const origin = shoulder.getWorldPosition(new Vector3()), scale = rig.root.getWorldScale(new Vector3()).x;
  const handWorld = facing.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI))
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI));
  const offset = new Vector3(side === "left" ? 0.03 : -0.03, -0.11, 0.12);
  const wrist = target.clone().sub(offset.multiplyScalar(scale).applyQuaternion(handWorld));
  const upper = elbow.position.length() * scale, lower = hand.position.length() * scale;
  const local = wrist.clone().sub(origin).applyQuaternion(facing.clone().invert());
  const lowerInPlane = Math.sqrt(Math.max(0, lower ** 2 - local.z ** 2));
  const distance = Math.hypot(local.x, local.y), direction = new Vector3(local.x, local.y, 0).normalize();
  const along = (upper ** 2 - lowerInPlane ** 2 + distance ** 2) / (2 * distance);
  const outward = new Vector3(direction.y, -direction.x, 0).multiplyScalar(side === "left" ? 1 : -1);
  const elbowTarget = origin.clone().add(direction.multiplyScalar(along).addScaledVector(outward, Math.sqrt(Math.max(0, upper ** 2 - along ** 2))).applyQuaternion(facing));
  poseMachineArm(rig, side, elbowTarget, wrist, handWorld);
}

export function machineDemoScene(slug: MachineSlug, id: string, machineGrip: "supinated" | "pronated" = "supinated", machineMode: "regular" | "reverse" = "regular"): WorkshopScene {
  const transform = { ...identityTransform };
  const durationMs = 4800;
  const frames = Array.from({ length: 17 }, (_, index) => {
    const motion = (1 - Math.cos(index / 16 * Math.PI * 2)) / 2;
    return { ...transform, timeMs: index * 300, machinePosition: slug === "smith-machine" ? 1 - motion : motion };
  });
  return { motionStyle: "free", durationMs, cameraAngle: machineGrip === "pronated" && slug === "lat-pulldown-machine" ? "front" : "three_quarter", equipment: null, annotations: [],
    keyframes: frames.map(frame => ({ timeMs: frame.timeMs, poses: { torso: { x: 0, y: 0, z: 0 } } })),
    studio: { body: { ...identityTransform }, frontalPlane: slug === "lat-pulldown-machine" && machineGrip === "pronated" ? true : undefined, objects: [{ ...transform, id, slug, name: studioAssetNames[slug], attachment: "none", pulleyHeight: 2.6, machineUse: true, machineGrip: slug === "lat-pulldown-machine" ? machineGrip : undefined, machineMode: slug === "pec-deck" ? machineMode : undefined, machinePosition: frames[0].machinePosition, frames }],
      presentation: { highlight: slug === "pec-deck" ? machineMode === "reverse" ? "group:reardelts" : "group:chest" : slug === "lat-pulldown-machine" || slug === "cable-row-machine" ? "group:lats" : "group:quadriceps", isolate: false, view: slug === "leg-press" ? "side" : slug === "lat-pulldown-machine" && machineGrip === "pronated" ? "front" : "three_quarter" } } };
}


