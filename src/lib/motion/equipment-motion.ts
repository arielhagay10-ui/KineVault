import { Matrix4, Quaternion, Vector3 } from "three";
import type { AnatomyRig } from "./anatomy";
import type { WorkshopScene } from "./workshop";

export function isCablePushdown(scene: WorkshopScene) {
  return scene.equipment?.slug === "single-cable" && scene.equipment.y > 1;
}

export function forearmRotationForScene(scene: WorkshopScene) {
  // Custom free poses keep a neutral palm until the creator chooses a wrist pose.
  // Inferring a curl from one elbow otherwise turns both palms during hand dragging.
  const manualArms = scene.motionStyle === "free" && !!scene.studio && !scene.equipment;
  const isCurl = !manualArms && (!scene.motionStyle || ["free", "seated-curl", "incline-curl"].includes(scene.motionStyle))
    && scene.equipment?.slug !== "single-cable" && scene.keyframes.some(frame => (frame.poses["left-elbow"]?.x ?? 0) >= 70)
    && scene.keyframes.every(frame => Math.abs(frame.poses["left-shoulder"]?.z ?? 0) < 30);
  return isCablePushdown(scene) ? 180 : isCurl ? 0 : 90;
}

export function automaticWristAngles(scene: WorkshopScene, side: "left" | "right") {
  const heldWeight = scene.studio?.objects.some(object => ["barbell", "dumbbell", "kettlebell"].includes(object.slug)
    && (object.attachment === side || object.attachment === "both"));
  return { x: heldWeight ? -90 : forearmRotationForScene(scene) - 90, y: 0, z: 0 };
}

// Adapt the original atlas demos without altering their frozen source scenes.
export function correctEquipmentMotion(scene: WorkshopScene): WorkshopScene {
  // Studio scenes contain deliberate manual poses and placements.
  if (scene.studio) return scene;
  if (isCablePushdown(scene)) {
    return { ...scene, equipment: { ...scene.equipment!, x: 1.05, z: 1.05 }, keyframes: scene.keyframes.map(frame => ({
      ...frame, poses: { ...frame.poses,
        "left-shoulder": { x: -8, y: 0, z: 0 }, "right-shoulder": { x: -8, y: 0, z: 0 },
        "right-elbow": frame.poses["right-elbow"] ?? frame.poses["left-elbow"] ?? { x: 0, y: 0, z: 0 },
      },
    })) };
  }
  const legacyPress = scene.equipment?.slug === "dumbbell-pair"
    && scene.keyframes.some(frame => Math.abs(frame.poses["left-shoulder"]?.z ?? 0) > 120)
    && scene.keyframes.some(frame => (frame.poses["left-shoulder"]?.x ?? 0) < -60)
    && scene.keyframes.some(frame => Math.abs(frame.poses["left-shoulder"]?.z ?? 0) < 85);
  if (!legacyPress) return scene;
  return { ...scene, keyframes: scene.keyframes.map(frame => {
    const poses = { ...frame.poses };
    for (const side of ["left", "right"] as const) {
      const abduction = Math.abs(poses[`${side}-shoulder`]?.z ?? 0);
      poses[`${side}-shoulder`] = { x: -90, y: (side === "left" ? 1 : -1) * (90 - abduction), z: side === "left" ? -90 : 90 };
    }
    return { ...frame, poses };
  }) };
}

export function cableGripPoint(rig: AnatomyRig, side: "left" | "right") {
  return rig.handBones[side].localToWorld(new Vector3(side === "left" ? 0.03 : -0.03, -0.12, 0.075));
}

export function cableAttachmentFrame(rig: AnatomyRig, scene: WorkshopScene) {
  const asset = scene.equipment!;
  const pushdown = isCablePushdown(scene);
  const left = cableGripPoint(rig, "left");
  const right = cableGripPoint(rig, "right");
  const center = pushdown ? left.clone().add(right).multiplyScalar(0.5) : left;
  const pulley = new Vector3(-1.05 + asset.x, 0.22 + asset.y, 0.45 + asset.z);
  const x = pushdown ? left.clone().sub(right).normalize()
    : new Vector3(1, 0, 0).transformDirection(rig.handBones.left.matrixWorld);
  const y = pulley.clone().sub(center).addScaledVector(x, -pulley.clone().sub(center).dot(x)).normalize();
  const z = x.clone().cross(y).normalize();
  const rotation = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
  const connection = center.clone().addScaledVector(y, pushdown ? 0.065 : 0.16);
  return { center, rotation, connection, pulley, width: pushdown ? left.distanceTo(right) + 0.16 : 0.2 };
}
