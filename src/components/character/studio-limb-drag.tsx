"use client";

import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Move } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Group, Plane, Raycaster, Vector2, Vector3 } from "three";
import type { AnatomyRig } from "@/lib/motion/anatomy";
import { limbNames, solveLimbPose, type PoseLimb } from "@/lib/motion/limb-pose";
import { studioDragDelta } from "@/lib/motion/workshop-mouse";
import type { RigPose } from "@/lib/motion/workshop";
import type { StudioEditor } from "./studio-controls";
import { useWorkshopLanguage } from "./workshop-language";

export function StudioLimbDrag({ rig, limb, editor }: { rig: AnatomyRig; limb: PoseLimb; editor: StudioEditor }) {
  const { camera, gl, invalidate } = useThree(), { t } = useWorkshopLanguage();
  const anchor = useRef<Group>(null);
  const [offset, setOffset] = useState(0);
  useFrame(() => {
    if (!anchor.current) return;
    const side = limb.startsWith("left") ? "left" : "right", other = side === "left" ? "right" : "left";
    const point = anchor.current.getWorldPosition(new Vector3()).project(camera);
    const peer = rig.bones[`${other}-${limb.endsWith("hand") ? "wrist" : "ankle"}`].getWorldPosition(new Vector3()).project(camera);
    const bounds = gl.domElement.getBoundingClientRect();
    const close = Math.hypot((point.x - peer.x) * bounds.width / 2, (point.y - peer.y) * bounds.height / 2) < 48;
    // Anatomical left can appear on either screen side as the camera rotates.
    const screenLeft = point.x < peer.x || (point.x === peer.x && side === "left");
    const next = close ? screenLeft ? -26 : 26 : 0;
    setOffset(previous => previous === next ? previous : next);
  });
  const drag = useRef<{ plane: Plane; hit: Vector3; point: Vector3; pose: RigPose; sensitivity: number; moved: boolean; element: HTMLButtonElement; pointerId: number; direction: "view" | "floor"; right: Vector3; up: Vector3; forward: Vector3 } | null>(null);
  const hitAt = (x: number, y: number, plane: Plane) => {
    const bounds = gl.domElement.getBoundingClientRect(), ray = new Raycaster();
    ray.setFromCamera(new Vector2((x - bounds.left) / bounds.width * 2 - 1, -(y - bounds.top) / bounds.height * 2 + 1), camera);
    return ray.ray.intersectPlane(plane, new Vector3());
  };
  const end = (cancel = false) => {
    const started = drag.current;
    if (!started) return;
    drag.current = null;
    if (started.element.hasPointerCapture(started.pointerId)) started.element.releasePointerCapture(started.pointerId);
    editor.onDragEnd(cancel || !started.moved);
  };
  useEffect(() => () => {
    if (drag.current) { drag.current = null; editor.onDragEnd(true); }
    // Cancel an unfinished gesture if the controls disappear.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const solve = (target: Vector3, pose: RigPose) => {
    const result = solveLimbPose(rig, limb, pose, target, editor.frontalPlane);
    editor.onLimbPoseChange?.(limb, result.poses, result.error);
    invalidate();
    return { ...pose, ...result.poses };
  };
  const down = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !anchor.current || !editor.onLimbPoseChange || editor.dragging) return;
    event.stopPropagation(); event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
    const point = anchor.current.getWorldPosition(new Vector3()), forward = camera.getWorldDirection(new Vector3());
    const plane = new Plane().setFromNormalAndCoplanarPoint(forward, point), hit = hitAt(event.clientX, event.clientY, plane);
    if (!hit) return;
    drag.current = { plane, hit, point, pose: editor.limbPose ?? {}, sensitivity: editor.sensitivity, moved: false, element: event.currentTarget, pointerId: event.pointerId, direction: editor.dragPlane ?? "view", right: new Vector3(1, 0, 0).applyQuaternion(camera.quaternion), up: new Vector3(0, 1, 0).applyQuaternion(camera.quaternion), forward };
    editor.onLimbDragStart?.();
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  return <group ref={anchor}><Html center zIndexRange={[20, 10]}><div className="relative h-11 w-11">
    {offset !== 0 && <svg aria-hidden="true" width="1" height="1" className="pointer-events-none absolute left-1/2 top-1/2 overflow-visible"><line x1="0" y1="0" x2={offset} y2="0" stroke="#0f766e" strokeWidth="2" /></svg>}
    <button type="button" aria-label={t("Drag {limb}", { limb: t(limbNames[limb]) })} title={t("Drag this hand or foot. Arrow keys also move it; Escape cancels.")}
      style={{ transform: `translateX(${offset}px)` }}
      className="flex h-11 w-11 touch-none cursor-grab items-center justify-center rounded-full border-2 border-white bg-teal-700 text-white shadow-md outline-offset-2 focus-visible:outline-2 focus-visible:outline-teal-600 active:cursor-grabbing"
      onPointerDown={down} onPointerMove={event => {
        const started = drag.current;
        if (!started) return;
        event.stopPropagation(); event.preventDefault();
        const hit = hitAt(event.clientX, event.clientY, started.plane);
        if (!hit) return;
        const delta = studioDragDelta(hit.sub(started.hit), started.right, started.up, started.forward, started.direction, started.sensitivity);
        started.moved ||= delta.length() > .001;
        if (!started.moved) return;
        const target = started.point.clone().add(delta);
        if (editor.snap) target.set(Math.round(target.x * 10) / 10, Math.round(target.y * 10) / 10, Math.round(target.z * 10) / 10);
        started.pose = solve(target, started.pose);
      }} onPointerUp={() => end()} onPointerCancel={() => end(true)} onLostPointerCapture={() => end(true)}
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); end(true); return; }
        if (drag.current || editor.dragging || !anchor.current || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion), up = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion), forward = camera.getWorldDirection(new Vector3());
        const delta = (event.key === "ArrowUp" ? up.clone() : event.key === "ArrowDown" ? up.clone().negate() : event.key === "ArrowRight" ? right.clone() : right.clone().negate()).multiplyScalar(event.shiftKey ? .1 : .025);
        editor.onLimbDragStart?.();
        solve(anchor.current.getWorldPosition(new Vector3()).add(studioDragDelta(delta, right, up, forward, editor.dragPlane ?? "view", 1)), editor.limbPose ?? {});
        editor.onDragEnd();
      }}><Move aria-hidden="true" size={22} /></button>
  </div></Html></group>;
}
