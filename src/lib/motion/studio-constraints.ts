import { Euler, Group, Quaternion, Vector3 } from "three";
import { correctAuthoredArmPath, createAnatomyRig, plantAnatomyFeet, poseAnatomyRig, type AnatomyRig } from "./anatomy";
import { forearmRotationForScene } from "./equipment-motion";
import { sampleStudioObject } from "./studio";
import { applyStudioSeating } from "./studio-seat";
import { identityTransform, sampleWorkshopPose, type CableAttachment, type RigPose, type SceneTransform, type StudioObject, type WorkshopScene } from "./workshop";

export function constrainFrontalPose(pose: RigPose, locked: boolean | undefined): RigPose {
  if (!locked) return pose;
  const next = { ...pose };
  for (const side of ["left", "right"] as const) {
    const slug = `${side}-shoulder` as const;
    next[slug] = { x: 0, y: 0, z: pose[slug]?.z ?? 0 };
  }
  return next;
}

export function setFrontalPlane(scene: WorkshopScene, locked: boolean): WorkshopScene {
  return { ...scene, motionStyle: locked ? "free" : scene.motionStyle,
    studio: { ...scene.studio ?? { body: { ...identityTransform }, objects: [] }, frontalPlane: locked },
    keyframes: scene.keyframes.map(frame => ({ ...frame, poses: constrainFrontalPose(frame.poses, locked) })) };
}

export function setCableAttachment(object: StudioObject, cableAttachment: CableAttachment): StudioObject {
  // Keep cuffPosition as the cable's remembered preference while a handle is used.
  return { ...object, cableAttachment, cuffPosition: object.cuffPosition ?? (cableAttachment === "cuff" ? "wrist" : undefined),
    attachment: ["d-handle", "cuff"].includes(cableAttachment) && object.attachment === "both" ? "left" : object.attachment };
}

export function alignedCableTransform(rig: AnatomyRig, object: StudioObject): SceneTransform {
  const side = object.shoulderAlignment;
  if (!side) return object;
  const shoulder = rig.bones[`${side}-shoulder`];
  const facing = shoulder.parent!.getWorldQuaternion(new Quaternion());
  const lateral = new Vector3(1, 0, 0).applyQuaternion(facing).setY(0).normalize();
  const yaw = Math.atan2(-lateral.z, lateral.x);
  const position = shoulder.getWorldPosition(new Vector3()).addScaledVector(lateral, side === "left" ? 1 : -1);
  // The pulley sits 0.2m in front of the tower. Align the pulley, not the base.
  position.sub(new Vector3(0, 0, 0.2 * object.scale).applyAxisAngle(new Vector3(0, 1, 0), yaw));
  return { x: position.x, y: object.y, z: position.z, rotationX: 0, rotationY: yaw * 180 / Math.PI, rotationZ: 0, scale: object.scale };
}

export function resolveStudioObject(scene: WorkshopScene, object: StudioObject, timeMs: number): StudioObject {
  const sampled = sampleStudioObject(object, timeMs);
  if (sampled.slug !== "cable-machine" || !sampled.shoulderAlignment) return sampled;
  // A mesh-free rig gives numeric controls the same position as the live figure.
  const rig = createAnatomyRig(new Group());
  try {
    const transform = scene.studio?.body ?? identityTransform;
    const body = new Group(); body.position.set(transform.x, transform.y, transform.z);
    body.rotation.copy(new Euler(transform.rotationX * Math.PI / 180, transform.rotationY * Math.PI / 180, transform.rotationZ * Math.PI / 180));
    body.scale.setScalar(transform.scale); body.add(rig.root); body.updateMatrixWorld(true);
    const pose = constrainFrontalPose(sampleWorkshopPose(scene.keyframes, timeMs), scene.studio?.frontalPlane);
    poseAnatomyRig(rig, pose, false, forearmRotationForScene(scene));
    plantAnatomyFeet(rig, scene.motionStyle, pose); correctAuthoredArmPath(rig, scene.motionStyle, pose);
    applyStudioSeating(rig, scene.studio, timeMs, pose);
    return { ...sampled, ...alignedCableTransform(rig, sampled) };
  } finally { rig.dispose(); }
}
