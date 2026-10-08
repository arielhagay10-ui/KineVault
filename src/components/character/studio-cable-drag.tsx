"use client";

import { Html } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { Move } from "@/components/ui/icons";
import { useEffect, useRef } from "react";
import { Plane, Raycaster, Vector2, Vector3 } from "three";
import type { AnatomyRig } from "@/lib/motion/anatomy";
import { solveCablePose } from "@/lib/motion/cable-pose";
import { studioDragDelta } from "@/lib/motion/workshop-mouse";
import type { RigPose, StudioObject } from "@/lib/motion/workshop";
import type { StudioEditor } from "./studio-controls";
import { useWorkshopLanguage } from "./workshop-language";

type Wrists = Partial<Record<"left" | "right", Vector3>>;
export function useCableDrag(rig: AnatomyRig, object: StudioObject, editor?: StudioEditor) {
  const { camera, gl, invalidate } = useThree();
  const enabled = !!editor && editor.interactionEnabled !== false && !editor.playing && !editor.limbPosing && editor.tool === "select" && !object.machineUse && object.attachment !== "none";
  const drag = useRef<{ plane: Plane; hit: Vector3; wrists: Wrists; pose: RigPose; right: Vector3; up: Vector3; forward: Vector3; element: HTMLElement; pointerId: number; moved: boolean; sensitivity: number; direction: "view" | "floor" } | null>(null);
  const getWrists = () => {
    const wrists: Wrists = {};
    for (const side of ["left", "right"] as const) if ([side, "both"].includes(object.attachment)) wrists[side] = rig.handBones[side].getWorldPosition(new Vector3());
    return wrists;
  };
  const hitAt = (x: number, y: number, plane: Plane) => {
    const bounds = gl.domElement.getBoundingClientRect(), ray = new Raycaster();
    ray.setFromCamera(new Vector2((x - bounds.left) / bounds.width * 2 - 1, -(y - bounds.top) / bounds.height * 2 + 1), camera);
    return ray.ray.intersectPlane(plane, new Vector3());
  };
  const finish = (cancel = false) => {
    const started = drag.current;
    if (!started) return;
    drag.current = null;
    if (started.element.hasPointerCapture(started.pointerId)) started.element.releasePointerCapture(started.pointerId);
    editor?.onDragEnd(cancel || !started.moved);
  };
  useEffect(() => () => {
    if (drag.current) { drag.current = null; editor?.onDragEnd(true); }
    // Cancel unfinished gestures when the attachment disappears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const up = () => finish(), cancel = () => finish(true);
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && drag.current) { event.preventDefault(); finish(true); } };
    window.addEventListener("pointerup", up); window.addEventListener("pointercancel", cancel); window.addEventListener("keydown", escape); window.addEventListener("blur", cancel);
    return () => { window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", cancel); window.removeEventListener("keydown", escape); window.removeEventListener("blur", cancel); };
    // onDragEnd is stable; all gesture state lives in the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor?.onDragEnd]);
  const solve = (wrists: Wrists, delta: Vector3, pose: RigPose) => {
    const targets: Wrists = {};
    for (const side of ["left", "right"] as const) if (wrists[side]) {
      const target = wrists[side]!.clone().add(delta);
      if (editor?.snap) target.set(Math.round(target.x * 10) / 10, Math.round(target.y * 10) / 10, Math.round(target.z * 10) / 10);
      targets[side] = target;
    }
    const result = solveCablePose(rig, pose, targets, editor?.frontalPlane);
    editor?.onCablePoseChange?.(object.id, result.poses, result.error); invalidate();
    return { ...pose, ...result.poses };
  };
  const down = (event: PointerEvent) => {
    if (!enabled || !editor?.onCablePoseChange || editor.dragging || event.button !== 0) return;
    event.preventDefault();
    const wrists = getWrists(), points = Object.values(wrists);
    const center = points.reduce((sum, point) => sum.add(point), new Vector3()).divideScalar(points.length);
    const forward = camera.getWorldDirection(new Vector3()), plane = new Plane().setFromNormalAndCoplanarPoint(forward, center), hit = hitAt(event.clientX, event.clientY, plane);
    if (!hit) return;
    const element = event.target instanceof Element ? event.target.closest("button") ?? gl.domElement : gl.domElement;
    element.focus({ preventScroll: true });
    drag.current = { plane, hit, wrists, pose: editor.limbPose ?? {}, right: new Vector3(1, 0, 0).applyQuaternion(camera.quaternion), up: new Vector3(0, 1, 0).applyQuaternion(camera.quaternion), forward, element, pointerId: event.pointerId, moved: false, sensitivity: editor.sensitivity, direction: editor.dragPlane ?? "view" };
    editor.onCableDragStart?.(object.id); element.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    const started = drag.current;
    if (!started) return;
    event.preventDefault();
    const hit = hitAt(event.clientX, event.clientY, started.plane);
    if (!hit) return;
    const delta = studioDragDelta(hit.sub(started.hit), started.right, started.up, started.forward, started.direction, started.sensitivity);
    started.moved ||= delta.length() > .001;
    if (started.moved) started.pose = solve(started.wrists, delta, started.pose);
  };
  const meshEvents = enabled ? {
    onPointerDown: (event: ThreeEvent<PointerEvent>) => { if (event.button === 0) { event.stopPropagation(); down(event.nativeEvent); (event.target as HTMLElement).setPointerCapture(event.pointerId); } },
    onPointerMove: (event: ThreeEvent<PointerEvent>) => { if (drag.current) { event.stopPropagation(); move(event.nativeEvent); } },
    onPointerUp: (event: ThreeEvent<PointerEvent>) => { if (drag.current) { event.stopPropagation(); finish(); (event.target as HTMLElement).releasePointerCapture(event.pointerId); } },
    onPointerCancel: () => finish(true), onLostPointerCapture: () => finish(true),
  } : {};
  const keyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") { if (drag.current) { event.preventDefault(); event.stopPropagation(); finish(true); } return; }
    if (!enabled || !editor || editor.dragging || drag.current || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion), up = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion), forward = camera.getWorldDirection(new Vector3());
    const delta = (event.key === "ArrowUp" ? up.clone() : event.key === "ArrowDown" ? up.clone().negate() : event.key === "ArrowRight" ? right.clone() : right.clone().negate()).multiplyScalar(event.shiftKey ? .1 : .025);
    editor.onCableDragStart?.(object.id);
    solve(getWrists(), studioDragDelta(delta, right, up, forward, editor.dragPlane ?? "view", 1), editor.limbPose ?? {}); editor.onDragEnd();
  };
  return { enabled, meshEvents, down, move, finish, keyDown };
}

export function StudioCableGrab({ drag }: { drag: ReturnType<typeof useCableDrag> }) {
  const { t } = useWorkshopLanguage();
  if (!drag.enabled) return null;
  return <Html center zIndexRange={[20, 10]}><button type="button" aria-label={t("Drag cable handle")} title={t("Move the handle and held hands. Arrow keys move it; Escape cancels.")}
    className="flex h-11 w-11 touch-none cursor-grab items-center justify-center rounded-full border-2 border-white bg-teal-700 text-white shadow-md outline-offset-2 focus-visible:outline-2 focus-visible:outline-teal-600 active:cursor-grabbing"
    onPointerDown={event => { event.stopPropagation(); drag.down(event.nativeEvent); }} onPointerMove={event => { event.stopPropagation(); drag.move(event.nativeEvent); }}
    onPointerUp={() => drag.finish()} onPointerCancel={() => drag.finish(true)} onLostPointerCapture={() => drag.finish(true)} onKeyDown={drag.keyDown}><Move size={22} aria-hidden="true" /></button></Html>;
}
