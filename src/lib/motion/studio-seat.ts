import { Euler, Quaternion, Vector3 } from "three";
import type { AnatomyRig } from "./anatomy";
import { sampleStudioObject, studioPointToWorld } from "./studio";
import { jointLimits, type RigPose, type StudioLayout } from "./workshop";

export function applyStudioSeating(rig: AnatomyRig, studio: StudioLayout | undefined, timeMs: number, pose: RigPose) {
  const seating = studio?.seating;
  const item = studio?.objects.find(object => object.id === seating?.benchId && object.slug === "bench");
  if (!studio || !seating || !item) return;
  const bench = sampleStudioObject(item, timeMs);
  const radians = Math.PI / 180;
  const lying = seating.facing === "supine" || seating.facing === "prone";
  const yaw = { front: 0, left: 90, right: -90, back: 180, supine: 0, prone: 180 }[seating.facing];
  const rotation = new Quaternion().setFromEuler(new Euler(bench.rotationX * radians, bench.rotationY * radians, bench.rotationZ * radians));
  const facing = rotation.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw * radians));
  const rootRotation = facing.clone();
  if (seating.facing === "back") rootRotation.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), (90 - (bench.benchAngle ?? 45)) * radians));
  if (lying) rootRotation.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0),
    (seating.facing === "supine" ? (bench.benchAngle ?? 45) - 90 : 90 - (bench.benchAngle ?? 45)) * radians));
  const parentRotation = rig.root.parent?.getWorldQuaternion(new Quaternion()) ?? new Quaternion();
  rig.root.quaternion.copy(parentRotation.clone().invert().multiply(rootRotation));
  const chestSupported = seating.facing === "back";
  const padAngle = (bench.benchAngle ?? 45) * radians;
  // Keep the same chest-to-pad distance as the backrest gets more upright.
  const seatZ = chestSupported && padAngle >= Math.PI / 6
    ? 0.253 + ((0.147 + 0.307) * Math.SQRT1_2 - 0.147 * Math.cos(padAngle)) / Math.sin(padAngle)
    : 0.56;
  const scale = rig.root.getWorldScale(new Vector3()).x;
  const along = new Vector3(0, Math.sin(padAngle), -Math.cos(padAngle));
  const normal = new Vector3(0, Math.cos(padAngle), Math.sin(padAngle));
  // Pelvis offsets include pad thickness and the anatomy's back/chest depth.
  const support = new Vector3(0, .673, .253).addScaledVector(along, .12)
    .addScaledVector(normal, seating.facing === "supine" ? .215 : .32);
  const pelvis = studioPointToWorld(lying ? support : { x: 0, y: 0.82, z: seatZ }, bench);
  const origin = pelvis.clone().sub(rig.bones.pelvis.position.clone().multiplyScalar(scale).applyQuaternion(rootRotation));
  rig.root.position.copy(rig.root.parent ? rig.root.parent.worldToLocal(origin) : origin);
  rig.root.updateWorldMatrix(true, true);
  for (const side of ["left", "right"] as const) {
    const hip = rig.bones[`${side}-hip`], knee = rig.bones[`${side}-knee`], foot = rig.footBones[side];
    const ankle = foot.quaternion.clone();
    const upper = knee.position.length() * scale, lower = foot.position.length() * scale;
    const legFacing = lying ? rotation : facing;
    const target = lying
      ? studioPointToWorld({ x: (side === "left" ? 1 : -1) * .25, y: 0, z: 1.05 }, bench)
      : new Vector3((side === "left" ? 1 : -1) * (chestSupported ? 0.28 : 0.153), 0, 0.6)
        .multiplyScalar(studio.body.scale).applyQuaternion(facing).add(studioPointToWorld({ x: 0, y: 0, z: seatZ }, bench));
    target.y = bench.y + 0.119 * studio.body.scale;
    const hipPosition = hip.getWorldPosition(new Vector3());
    const direction = target.clone().sub(hipPosition);
    const distance = Math.max(Math.abs(upper - lower) + 1e-6, Math.min(direction.length(), upper + lower - 1e-6));
    direction.normalize();
    // Solve the knee's anatomical hinge first; orient the hip to reach the foot.
    // The native thigh has a small lateral offset, so retain its full rest vector.
    const sagittalUpper = Math.hypot(knee.position.y, knee.position.z) * scale;
    const restAngle = Math.atan2(knee.position.z, -knee.position.y);
    const cosine = (distance * distance - upper * upper - lower * lower) / (2 * sagittalUpper * lower);
    knee.rotation.set(Math.acos(Math.max(-1, Math.min(1, cosine))) - restAngle, 0, 0);
    const reach = knee.position.clone().add(foot.position.clone().applyQuaternion(knee.quaternion)).normalize();
    const hipWorld = new Quaternion().setFromUnitVectors(reach, direction);
    const hinge = new Vector3(1, 0, 0).applyQuaternion(hipWorld);
    hinge.addScaledVector(direction, -hinge.dot(direction)).normalize();
    const planeNormal = new Vector3(1, 0, 0).applyQuaternion(legFacing);
    planeNormal.addScaledVector(direction, -planeNormal.dot(direction)).normalize();
    const twist = Math.atan2(direction.dot(hinge.clone().cross(planeNormal)), hinge.dot(planeNormal));
    hipWorld.premultiply(new Quaternion().setFromAxisAngle(direction, twist));
    hip.quaternion.copy(hip.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(hipWorld));
    rig.root.updateWorldMatrix(true, true);
    foot.quaternion.copy(knee.getWorldQuaternion(new Quaternion()).invert()).multiply(legFacing);
    if (pose[`${side}-ankle`]) foot.quaternion.multiply(ankle);
    // Limit the final ankle relative to its shin, including the leg solve.
    // A valid authored angle can exceed the joint range after foot planting.
    const limits = jointLimits[`${side}-ankle`];
    foot.rotation.set(
      Math.max(-limits.x[1] * radians, Math.min(-limits.x[0] * radians, foot.rotation.x)),
      Math.max(limits.y[0] * radians, Math.min(limits.y[1] * radians, foot.rotation.y)),
      Math.max(-limits.z[1] * radians, Math.min(-limits.z[0] * radians, foot.rotation.z)),
    );
  }
  rig.root.updateWorldMatrix(true, true); rig.skeleton.update();
}
