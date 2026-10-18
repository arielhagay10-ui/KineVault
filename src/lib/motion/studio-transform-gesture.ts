import type { Object3D } from "three";

export function captureStudioTransform(object: Object3D) {
  return { position: object.position.clone(), rotation: object.quaternion.clone(), scale: object.scale.clone() };
}

export function restoreStudioTransform(object: Object3D, snapshot: ReturnType<typeof captureStudioTransform>) {
  object.position.copy(snapshot.position);
  object.quaternion.copy(snapshot.rotation);
  object.scale.copy(snapshot.scale);
  object.updateWorldMatrix(true, true);
}
