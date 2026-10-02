"use client";

import { useRef } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { Object3D, Plane, Vector3 } from "three";
import type { StudioEditor, StudioSelection } from "./studio-controls";
import { readSceneTransform } from "@/lib/motion/studio";
import { canBeginStudioDrag } from "@/lib/motion/workshop-interaction";
import { studioDragDelta, type StudioDragPlane } from "@/lib/motion/workshop-mouse";

export function useStudioDrag(object: React.RefObject<Object3D>, selection: StudioSelection, editor: StudioEditor | undefined, commit: (object: Object3D) => void) {
  const invalidate = useThree(state => state.invalidate);
  const camera = useThree(state => state.camera);
  const drag = useRef<{ plane: Plane; hit: Vector3; right: Vector3; up: Vector3; forward: Vector3; position: Vector3; sensitivity: number; mode: StudioDragPlane; moved: boolean } | null>(null);
  const end = (event: ThreeEvent<PointerEvent>, cancel = false) => {
    const started = drag.current;
    if (!started) return;
    event.stopPropagation();
    if (cancel || !started.moved) object.current.position.copy(started.position);
    else if (started.moved) {
      commit(object.current);
      const value = readSceneTransform(object.current);
      object.current.position.set(value.x, value.y, value.z);
    }
    drag.current = null;
    (event.target as HTMLElement).releasePointerCapture(event.pointerId);
    editor?.onDragEnd(cancel || !started.moved); invalidate();
  };
  return {
    onPointerDown: (event: ThreeEvent<PointerEvent>) => {
      if (!editor || !canBeginStudioDrag(editor, selection, event.button)) return;
      event.stopPropagation();
      const position = object.current.position.clone();
      // A camera-facing plane keeps movement predictable near the horizon.
      const direction = camera.getWorldDirection(new Vector3());
      const plane = new Plane().setFromNormalAndCoplanarPoint(direction, event.point);
      const hit = event.ray.intersectPlane(plane, new Vector3());
      if (!hit) return;
      const rotation = camera.getWorldQuaternion(camera.quaternion.clone());
      const right = new Vector3(1, 0, 0).applyQuaternion(rotation);
      const up = new Vector3(0, 1, 0).applyQuaternion(rotation);
      const forward = direction.clone().setY(0);
      if (forward.lengthSq() < 1e-6) forward.copy(up).setY(0);
      forward.normalize();
      drag.current = { plane, hit, right, up, forward, position, sensitivity: editor.sensitivity, mode: editor.dragPlane ?? "floor", moved: false };
      editor.onSelect(selection); editor.onDragStart();
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: ThreeEvent<PointerEvent>) => {
      const started = drag.current;
      if (!started) return;
      event.stopPropagation();
      const hit = event.ray.intersectPlane(started.plane, new Vector3());
      if (!hit) return;
      const screenDelta = hit.sub(started.hit);
      const delta = studioDragDelta(screenDelta, started.right, started.up, started.forward, started.mode, started.sensitivity);
      object.current.position.copy(started.position).add(delta);
      if (editor?.snap) {
        object.current.position.set(Math.round(object.current.position.x * 10) / 10, started.mode === "floor" ? object.current.position.y : Math.round(object.current.position.y * 10) / 10, Math.round(object.current.position.z * 10) / 10);
      }
      started.moved ||= delta.length() > 0.001;
      invalidate();
    },
    onPointerUp: (event: ThreeEvent<PointerEvent>) => end(event),
    onPointerCancel: (event: ThreeEvent<PointerEvent>) => end(event, true),
  };
}
