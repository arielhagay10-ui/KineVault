import { Group, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { createHeldWeightPoseSampler, sampleHeldWeightPose } from "./held-weight-pose";
import { fitMachinePose } from "./machine-pose-fit";
import { plateRowPositionAtPoint, rowLeverPosition, rowUsesHand } from "./plate-row";
import { chestPressPositionAtPoint } from "./chest-press";
import { shoulderPressPositionAtPoint } from "./shoulder-press";
import { applyStudioMachine, setMachinePosition } from "./studio-machines";
import { sampleStudioObject, setStudioObjectAnimated, studioPointFromWorld } from "./studio";
import { studioGripOffset } from "./studio-grip";
import type { RigPose, WorkshopScene } from "./workshop";

export function releasePlateRowFeet(scene: WorkshopScene): WorkshopScene {
  const row = scene.studio?.objects.find(item => item.slug === "row-machine" && item.machineUse);
  if (!row || row.rowFootSupport === false) return scene;
  return { ...scene, keyframes: scene.keyframes.map(frame => {
    const displayed = sampleHeldWeightPose(scene, frame.timeMs), poses = { ...frame.poses };
    for (const side of ["left", "right"] as const) for (const part of ["hip", "knee", "ankle"] as const) poses[`${side}-${part}`] = displayed[`${side}-${part}`];
    return { ...frame, poses };
  }), studio: { ...scene.studio!, objects: scene.studio!.objects.map(item => item.id === row.id ? { ...item, rowFootSupport: false } : item) } };
}

/** Project authored hand motion onto each lever, keeping the seat and other arm. */
export function editLeverMachinePose(scene: WorkshopScene, frameIndex: number, all: boolean, changes: RigPose): WorkshopScene {
  if (Object.keys(changes).some(joint => /-(hip|knee|ankle)$/.test(joint))) scene = releasePlateRowFeet(scene);
  const row = scene.studio?.objects.find(item => ["row-machine", "shoulder-press-machine", "chest-press-machine"].includes(item.slug) && (item.machineUse || item.attachment !== "none"));
  if (!row || !scene.studio) return scene;
  const rig = createAnatomyRig(new Group()), parent = new Group(), body = scene.studio.body;
  const sampler = createHeldWeightPoseSampler();
  parent.position.set(body.x, body.y, body.z); parent.rotation.set(body.rotationX * Math.PI / 180, body.rotationY * Math.PI / 180, body.rotationZ * Math.PI / 180);
  parent.scale.setScalar(body.scale); parent.add(rig.root);
  let object = setStudioObjectAnimated(row, true, scene.keyframes[frameIndex].timeMs, scene.keyframes.map(frame => frame.timeMs));
  try {
    const keyframes = scene.keyframes.map((frame, index) => {
      if (index !== frameIndex && !all) return frame;
      const displayed = sampleHeldWeightPose(scene, frame.timeMs), pose = { ...displayed, ...changes };
      poseAnatomyRig(rig, displayed, true); applyStudioMachine(rig, scene, frame.timeMs);
      const position = rig.root.position.clone();
      const rootRotation = rig.root.quaternion.clone(), scale = rig.root.scale.clone();
      poseAnatomyRig(rig, pose, true);
      rig.root.position.copy(position); rig.root.quaternion.copy(rootRotation); rig.root.scale.copy(scale); rig.root.updateWorldMatrix(true, true);
      const sampled = sampleStudioObject(row, frame.timeMs), authored: RigPose = { ...frame.poses, ...changes };
      for (const side of ["left", "right"] as const) {
        const editsArm = !!(changes[`${side}-shoulder`] || changes[`${side}-elbow`] || changes.torso);
        if (!rowUsesHand(sampled, side) || !editsArm) continue;
        const elbow = changes[`${side}-elbow`];
        if (elbow && !changes[`${side}-shoulder`] && !changes.torso) {
          // Fit the displayed bend; projecting the hand can reverse elbow motion.
          const position = fitMachinePose(rowLeverPosition(sampled, side), value => {
            const candidate = setMachinePosition({ ...sampled, frames: undefined }, value, frame.timeMs, side);
            const next = { ...scene, keyframes: scene.keyframes.map(point => point.timeMs === frame.timeMs ? { ...point, poses: authored } : point),
              studio: { ...scene.studio!, objects: scene.studio!.objects.map(item => item.id === row.id ? candidate : item) } };
            return (sampler.sample(next, frame.timeMs)[`${side}-elbow`]!.x - elbow.x) ** 2;
          });
          object = setMachinePosition(object, position, frame.timeMs, side);
          continue;
        }
        const target = studioPointFromWorld(rig.handBones[side].localToWorld(studioGripOffset(side)), sampled);
        const project = sampled.slug === "chest-press-machine" ? chestPressPositionAtPoint : sampled.slug === "shoulder-press-machine" ? shoulderPressPositionAtPoint : plateRowPositionAtPoint;
        object = setMachinePosition(object, project(sampled, side, new Vector3(target.x, target.y, target.z)), frame.timeMs, side);
        for (const part of ["shoulder", "elbow"] as const) authored[`${side}-${part}`] = pose[`${side}-${part}`];
      }
      return { ...frame, poses: authored };
    });
    return { ...scene, keyframes, studio: { ...scene.studio, objects: scene.studio.objects.map(item => item.id === row.id ? object : item) } };
  } finally { rig.dispose(); sampler.dispose(); }
}

export const editPlateRowPose = editLeverMachinePose;
