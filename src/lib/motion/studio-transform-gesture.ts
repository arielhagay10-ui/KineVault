import type { Object3D, Quaternion } from "three";
import { clampJointControlAngles, type JointSlug } from "./workshop";

export function constrainStudioJointRotation(slug: JointSlug, object: Object3D, initial: Quaternion) {
  const xSign = slug.endsWith("elbow") || slug.endsWith("knee") || slug.endsWith("ankle") ? -1 : 1;
  const zSign = slug === "torso" ? 1 : -1;
  const read = () => ({ x: object.rotation.x * 180 / Math.PI * xSign,
    y: object.rotation.y * 180 / Math.PI, z: object.rotation.z * 180 / Math.PI * zSign });
  const valid = () => {
    const angles = read();
    const limited = clampJointControlAngles(slug, angles);
    return Math.abs(angles.x - limited.x) + Math.abs(angles.y - limited.y) + Math.abs(angles.z - limited.z) < .000001;
  };
  if (valid()) return;
  // Stop along the selected ring's rotation path; clamping Euler components bends that path sideways.
  const candidate = object.quaternion.clone();
  object.quaternion.copy(initial);
  if (!valid()) {
    // Preserve repair-on-edit for older poses outside the manual authoring limits.
    object.quaternion.copy(candidate);
    const angles = clampJointControlAngles(slug, read());
    object.rotation.set(angles.x * Math.PI / 180 * xSign, angles.y * Math.PI / 180, angles.z * Math.PI / 180 * zSign);
    return;
  }
  let lower = 0, upper = 1;
  for (let index = 0; index < 16; index++) {
    const fraction = (lower + upper) / 2;
    object.quaternion.slerpQuaternions(initial, candidate, fraction);
    if (valid()) lower = fraction; else upper = fraction;
  }
  object.quaternion.slerpQuaternions(initial, candidate, lower);
}

export function captureStudioTransform(object: Object3D) {
  return { position: object.position.clone(), rotation: object.quaternion.clone(), scale: object.scale.clone() };
}

export function restoreStudioTransform(object: Object3D, snapshot: ReturnType<typeof captureStudioTransform>) {
  object.position.copy(snapshot.position);
  object.quaternion.copy(snapshot.rotation);
  object.scale.copy(snapshot.scale);
  object.updateWorldMatrix(true, true);
}
