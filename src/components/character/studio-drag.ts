"use client";

import { useEffect, useRef } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { Object3D, Plane, Vector3 } from "three";
import type { StudioEditor, StudioSelection } from "./studio-controls";
import { readSceneTransform } from "@/lib/motion/studio";
import { canBeginStudioDrag } from "@/lib/motion/workshop-interaction";
import { studioDragDelta, studioSnapTarget, type StudioDragPlane } from "@/lib/motion/workshop-mouse";

export function useStudioDrag(object: React.RefObject<Object3D>, selection: StudioSelection, editor: StudioEditor | undefined, commit: (object: Object3D) => void) {
  const invalidate = useThree(state => state.invalidate);
  const camera = useThree(state => state.camera);
  const drag = useRef<{ object: Object3D; plane: Plane; hit: Vector3; right: Vector3; up: Vector3; forward: Vector3; position: Vector3; sensitivity: number; mode: StudioDragPlane; moved: boolean; element: HTMLElement; pointerId: number } | null>(null);
  const callbacks = useRef({ editor, commit });
  useEffect(() => { callbacks.current = { editor, commit }; });
  const finish = (cancel = false) => {
    const started = drag.current;
    if (!started) return;
    drag.current = null;
    if (cancel || !started.moved) started.object.position.copy(started.position);
    else if (started.moved) {
      callbacks.current.commit(started.object);
      const value = readSceneTransform(started.object);
      started.object.position.set(value.x, value.y, value.z);
    }
    started.element.releasePointerCapture(started.pointerId);
    callbacks.current.editor?.onDragEnd(cancel || !started.moved); invalidate();
  };
  const end = (event: ThreeEvent<PointerEvent>, cancel = false) => { if (drag.current) { event.stopPropagation(); finish(cancel); } };
  useEffect(() => {
    const cancel = () => finish(true);
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && drag.current) { event.preventDefault(); event.stopPropagation(); cancel(); } };
    window.addEventListener("blur", cancel); window.addEventListener("keydown", escape, true);
    return () => { cancel(); window.removeEventListener("blur", cancel); window.removeEventListener("keydown", escape, true); };
    // Gesture state and callbacks live in refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // R3F intersects registered pointer handlers before their callback guards.
  // Keep completion handlers until an existing drag finishes.
  if (!editor || (!editor.dragging && !canBeginStudioDrag(editor, selection, 0))) return {};
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
      drag.current = { object: object.current, plane, hit, right, up, forward, position, sensitivity: editor.sensitivity, mode: editor.dragPlane ?? "floor", moved: false, element: event.target as HTMLElement, pointerId: event.pointerId };
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
        object.current.position.copy(studioSnapTarget(object.current.position, started.position, started.mode));
      }
      started.moved ||= delta.length() > 0.001;
      if (started.moved) callbacks.current.commit(object.current);
      invalidate();
    },
    onPointerUp: (event: ThreeEvent<PointerEvent>) => end(event),
    onPointerCancel: (event: ThreeEvent<PointerEvent>) => end(event, true),
  };
}
