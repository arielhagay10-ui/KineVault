import { Euler, Group, Quaternion, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig, plantAnatomyFeet, correctAuthoredArmPath, type AnatomyRig } from "./anatomy";
import { applyStudioSeating } from "./studio-seat";
import { studioForearmReach, studioGripOffset, weightGripPoint } from "./studio-grip";
import { forearmRotationForScene } from "./equipment-motion";
import { heldEquipmentTransform } from "./studio";
import { solveLimbPose } from "./limb-pose";
import { alignBarbellHand } from "./barbell-grip";
import { solveBarbellContact } from "./barbell-contact";
import { isSharedDumbbell, sharedDumbbellRotation, solveSharedDumbbellGrip, supportDumbbellPalm } from "./shared-dumbbell-grip";
import { sampleWorkshopPose, type RigPose, type SceneTransform, type StudioObject, type WorkshopScene } from "./workshop";

export function weightAtPalm(rig: AnatomyRig, object: StudioObject, side: "left" | "right"): SceneTransform {
  const rotation = rig.handBones[side].getWorldQuaternion(new Quaternion());
  const palm = rig.handBones[side].localToWorld(studioGripOffset(side));
  const position = palm.sub(weightGripPoint(object, side).multiplyScalar(object.scale).applyQuaternion(rotation));
  const angles = new Euler().setFromQuaternion(rotation);
  return { x: position.x, y: position.y, z: position.z, rotationX: angles.x * 180 / Math.PI, rotationY: angles.y * 180 / Math.PI, rotationZ: angles.z * 180 / Math.PI, scale: object.scale };
}

/** Place a shared hold at its driving palm, or balance it between both palms. */
export function armDrivenWeightTransform(rig: AnatomyRig, object: StudioObject): SceneTransform {
  const side = object.attachment === "right" || object.poseDriver === "right-arm" ? "right" : "left";
  if (object.attachment !== "both") return weightAtPalm(rig, object, side);
  if (isSharedDumbbell(object)) {
    const rotation = new Quaternion().setFromEuler(new Euler(object.rotationX * Math.PI / 180, object.rotationY * Math.PI / 180, object.rotationZ * Math.PI / 180));
    const balanced = object.poseDriver === "arm";
    const palm = balanced ? rig.handBones.left.localToWorld(studioGripOffset("left")).add(rig.handBones.right.localToWorld(studioGripOffset("right"))).multiplyScalar(.5)
      : rig.handBones[side].localToWorld(studioGripOffset(side));
    const grip = balanced ? weightGripPoint(object, "left").add(weightGripPoint(object, "right")).multiplyScalar(.5) : weightGripPoint(object, side);
    const position = palm.sub(grip.multiplyScalar(object.scale).applyQuaternion(rotation));
    return { ...object, x: position.x, y: position.y, z: position.z };
  }
  const other = side === "left" ? "right" : "left";
  const palm = rig.handBones[side].localToWorld(studioGripOffset(side));
  const delta = weightGripPoint(object, other).sub(weightGripPoint(object, side)).multiplyScalar(object.scale);
  const direction = rig.handBones[other].localToWorld(studioGripOffset(other)).sub(palm).normalize();
  // Tilt around the driving palm when interpolated angles would put the other
  // grip outside its arm's reach. The edited joint remains authored.
  const towardShoulder = rig.bones[`${other}-shoulder`].getWorldPosition(new Vector3()).sub(palm);
  const distance = towardShoulder.length(), span = delta.length();
  const reach = rig.bones[`${other}-elbow`].position.length() * rig.root.getWorldScale(new Vector3()).x + studioForearmReach(rig, other) - .001;
  if (distance > 1e-8 && span > 1e-8) {
    const axis = towardShoulder.divideScalar(distance);
    const minimumCosine = Math.max(-1, Math.min(1, (distance ** 2 + span ** 2 - reach ** 2) / (2 * distance * span)));
    const cosine = direction.dot(axis);
    if (cosine < minimumCosine) {
      const tangent = direction.clone().addScaledVector(axis, -cosine);
      if (tangent.lengthSq() < 1e-10) tangent.crossVectors(axis, new Vector3(0, 1, 0));
      if (tangent.lengthSq() < 1e-10) tangent.crossVectors(axis, new Vector3(1, 0, 0));
      direction.copy(axis).multiplyScalar(minimumCosine).addScaledVector(tangent.normalize(), Math.sqrt(1 - minimumCosine ** 2));
    }
  }
  const rotation = span > 1e-8 && direction.lengthSq() > 1e-10 ? new Quaternion().setFromUnitVectors(delta.normalize(), direction) : rig.root.getWorldQuaternion(new Quaternion());
  if (object.slug === "barbell") alignBarbellHand(rig, side, new Vector3(1, 0, 0).applyQuaternion(rotation));
  const position = rig.handBones[side].localToWorld(studioGripOffset(side)).sub(weightGripPoint(object, side).multiplyScalar(object.scale).applyQuaternion(rotation));
  const angles = new Euler().setFromQuaternion(rotation);
  return { x: position.x, y: position.y, z: position.z, rotationX: angles.x * 180 / Math.PI, rotationY: angles.y * 180 / Math.PI, rotationZ: angles.z * 180 / Math.PI, scale: object.scale };
}

export function poseArmDrivenWeight(rig: AnatomyRig, object: StudioObject, pose: RigPose, frontalPlane = false) {
  let transform = armDrivenWeightTransform(rig, object);
  if (object.attachment !== "both") return { transform, limited: false };
  if (isSharedDumbbell(object)) {
    const side = object.poseDriver === "right-arm" ? "right" : "left";
    if (object.poseDriver !== "arm") {
      supportDumbbellPalm(rig, object, pose, side);
      transform = armDrivenWeightTransform(rig, object);
    }
    if (object.poseDriver === "arm") {
      for (let attempt = 0; attempt < 8; attempt++) {
        const placed = { ...object, ...transform };
        const solved = solveSharedDumbbellGrip(rig, placed, pose, frontalPlane);
        if (!solved.limited || attempt === 7) return solved;
        const correction = new Vector3();
        for (const hand of ["left", "right"] as const) correction.add(
          rig.handBones[hand].localToWorld(studioGripOffset(hand)).sub(weightGripPoint(placed, hand).multiplyScalar(placed.scale)
            .applyEuler(new Euler(placed.rotationX * Math.PI / 180, placed.rotationY * Math.PI / 180, placed.rotationZ * Math.PI / 180))
            .add(new Vector3(placed.x, placed.y, placed.z))));
        correction.multiplyScalar(.5);
        transform = { ...transform, x: transform.x + correction.x, y: transform.y + correction.y, z: transform.z + correction.z };
      }
    }
    return solveSharedDumbbellGrip(rig, { ...object, ...transform }, pose, frontalPlane, object.poseDriver === "arm" ? undefined : side);
  }
  const side = object.poseDriver === "right-arm" ? "left" : "right";
  const references = [rig.bones[`${side}-shoulder`], rig.bones[`${side}-elbow`], rig.forearmBones[side], rig.handBones[side]].map(bone => ({ bone, rotation: bone.quaternion.clone() }));
  for (let attempt = 0; attempt < 3; attempt++) {
    const target = weightGripPoint(object, side).multiplyScalar(object.scale).applyEuler(new Euler(
      transform.rotationX * Math.PI / 180, transform.rotationY * Math.PI / 180, transform.rotationZ * Math.PI / 180))
      .add(new Vector3(transform.x, transform.y, transform.z));
    const shaft = new Vector3(1, 0, 0).applyEuler(new Euler(transform.rotationX * Math.PI / 180, transform.rotationY * Math.PI / 180, transform.rotationZ * Math.PI / 180));
    if (object.slug === "barbell") for (const { bone, rotation } of references) bone.quaternion.copy(rotation);
    const solved = object.slug === "barbell" ? solveBarbellContact(rig, side, pose, target, shaft, frontalPlane)
      : solveDumbbellGrip(rig, { ...object, attachment: side }, pose, target, frontalPlane, .000001);
    if (!solved?.limited || attempt === 2) return { transform, limited: solved?.limited ?? false };
    // Wrist alignment can shorten the following arm's reach. Refit the bar around
    // the authored palm using that solved wrist before accepting the contact.
    transform = armDrivenWeightTransform(rig, object);
  }
  return { transform, limited: true };
}


export function automaticWeightTransform(body: SceneTransform, object: StudioObject, attachment: StudioObject["attachment"], scene: WorkshopScene, timeMs: number, anchorSide?: "left" | "right"): SceneTransform {
  if (attachment === "none") return heldEquipmentTransform(body, object, attachment);
  const rig = createAnatomyRig(new Group()), parent = new Group();
  parent.position.set(body.x, body.y, body.z);
  parent.rotation.set(body.rotationX * Math.PI / 180, body.rotationY * Math.PI / 180, body.rotationZ * Math.PI / 180);
  parent.scale.setScalar(body.scale); parent.add(rig.root);
  try {
    let pose = sampleWorkshopPose(scene.keyframes, timeMs);
    if (isSharedDumbbell({ ...object, attachment }) && ["left", "right"].every(side =>
      ["shoulder", "elbow"].every(part => Object.values(pose[`${side}-${part}` as keyof RigPose] ?? {}).every(value => Math.abs(value) < .001)))) {
      pose = { ...pose, "left-elbow": { x: 90, y: 0, z: 0 }, "right-elbow": { x: 90, y: 0, z: 0 } };
    }
    poseAnatomyRig(rig, pose, attachment === "both" ? true : attachment, forearmRotationForScene(scene));
    plantAnatomyFeet(rig, scene.motionStyle, pose); correctAuthoredArmPath(rig, scene.motionStyle, pose);
    applyStudioSeating(rig, scene.studio, timeMs, pose);
    if (attachment !== "both") return weightAtPalm(rig, { ...object, attachment }, attachment);
    const left = rig.handBones.left.localToWorld(studioGripOffset("left"));
    const right = rig.handBones.right.localToWorld(studioGripOffset("right"));
    const direction = left.clone().sub(right);
    const rotation = isSharedDumbbell({ ...object, attachment }) ? sharedDumbbellRotation(body.rotationY)
      : direction.lengthSq() > 1e-10 ? new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), direction.normalize()) : rig.root.getWorldQuaternion(new Quaternion());
    const contact = { ...object, attachment };
    const center = (anchorSide ? weightGripPoint(contact, anchorSide)
      : weightGripPoint(contact, "left").add(weightGripPoint(contact, "right")).multiplyScalar(.5)).multiplyScalar(object.scale).applyQuaternion(rotation);
    const position = (anchorSide ? (anchorSide === "left" ? left : right) : left.add(right).multiplyScalar(.5)).sub(center);
    if (isSharedDumbbell(contact)) {
      const angles = new Euler().setFromQuaternion(rotation);
      for (let iteration = 0; iteration < 8; iteration++) {
        poseAnatomyRig(rig, pose, true, forearmRotationForScene(scene));
        plantAnatomyFeet(rig, scene.motionStyle, pose); correctAuthoredArmPath(rig, scene.motionStyle, pose);
        applyStudioSeating(rig, scene.studio, timeMs, pose);
        const placed = { ...contact, x: position.x, y: position.y, z: position.z,
          rotationX: angles.x * 180 / Math.PI, rotationY: angles.y * 180 / Math.PI, rotationZ: angles.z * 180 / Math.PI };
        if (!solveSharedDumbbellGrip(rig, placed, pose, scene.studio?.frontalPlane).limited) break;
        const correction = new Vector3();
        for (const side of ["left", "right"] as const) correction.add(
          rig.handBones[side].localToWorld(studioGripOffset(side)).sub(weightGripPoint(contact, side).multiplyScalar(object.scale).applyQuaternion(rotation).add(position)));
        position.addScaledVector(correction, .5);
      }
    }
    // A kettlebell's narrow shared handle can put its centered grips just
    // outside the straight arms' reach. Fit the center to bounded palm contacts.
    if (object.slug === "kettlebell") for (let iteration = 0; iteration < 6; iteration++) {
      const correction = new Vector3();
      let error = 0;
      for (const side of ["left", "right"] as const) {
        const target = weightGripPoint(contact, side).multiplyScalar(object.scale).applyQuaternion(rotation).add(position);
        solveDumbbellGrip(rig, { ...contact, attachment: side }, pose, target);
        const delta = rig.handBones[side].localToWorld(studioGripOffset(side)).sub(target);
        error = Math.max(error, delta.length()); correction.add(delta);
      }
      if (error < .001) break;
      position.addScaledVector(correction, .5);
    }
    const angles = new Euler().setFromQuaternion(rotation);
    return { x: position.x, y: position.y, z: position.z, rotationX: angles.x * 180 / Math.PI, rotationY: angles.y * 180 / Math.PI, rotationZ: angles.z * 180 / Math.PI, scale: object.scale };
  } finally { rig.dispose(); }
}

// A dumbbell's shaft follows the palm. Its orientation must not spend the
// shoulder's extra degree of freedom or pull the hand away from the handle.
export function solveDumbbellGrip(rig: AnatomyRig, object: StudioObject, pose: RigPose, target: Vector3, frontalPlane = false, tolerance = .001) {
  if (isSharedDumbbell(object)) return solveSharedDumbbellGrip(rig, object, pose, frontalPlane);
  const side = object.attachment;
  if (side !== "left" && side !== "right") return null;
  const solved = solveLimbPose(rig, `${side}-hand`, pose, target, frontalPlane, studioGripOffset(side), tolerance);
  for (const joint of [`${side}-shoulder`, `${side}-elbow`] as const) {
    const angles = solved.poses[joint]!;
    rig.bones[joint].rotation.set(angles.x * Math.PI / 180 * (joint.endsWith("elbow") ? -1 : 1), angles.y * Math.PI / 180, -angles.z * Math.PI / 180);
  }
  rig.shoulderCaps[side].quaternion.identity().slerp(rig.bones[`${side}-shoulder`].quaternion, .82);
  rig.root.updateWorldMatrix(true, true); rig.skeleton.update();
  return { transform: weightAtPalm(rig, object, side), limited: solved.error >= .005 };
}
