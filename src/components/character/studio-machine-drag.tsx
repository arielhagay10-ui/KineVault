"use client";

import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Move } from "lucide-react";
import { useRef, type PointerEvent } from "react";
import { Group, Matrix4, Plane, Raycaster, Vector2, Vector3 } from "three";
import { machineCarriagePoint, machineHandlePoint } from "@/lib/motion/studio-machines";
import { machineDragValues } from "@/lib/motion/workshop-mouse";
import type { StudioObject } from "@/lib/motion/workshop";
import { studioAssetNames } from "@/lib/motion/studio";
import { useWorkshopLanguage } from "./workshop-language";
import type { StudioEditor } from "./studio-controls";

export function StudioMachineDrag({ object, currentObject, editor, side = "left" }: { object: StudioObject; currentObject?: React.RefObject<StudioObject>; editor: StudioEditor; side?: "left" | "right" }) {
  const { camera, gl } = useThree();
  const { t } = useWorkshopLanguage();
  const anchor = useRef<Group>(null);
  const drag = useRef<{ object: StudioObject; plane: Plane; hit: Vector3; inverse: Matrix4; point: Vector3; sensitivity: number; moved: boolean; element: HTMLButtonElement; pointerId: number } | null>(null);
  const liveObject = () => currentObject?.current ?? object;
  const handlePoint = (item: StudioObject) => item.slug === "pec-deck" ? machineHandlePoint(item, side) : machineCarriagePoint(item);
  const point = handlePoint(liveObject());
  useFrame(() => { anchor.current?.position.copy(handlePoint(liveObject())); });
  const pointerHit = (x: number, y: number, plane: Plane) => {
    const bounds = gl.domElement.getBoundingClientRect();
    const ray = new Raycaster();
    ray.setFromCamera(new Vector2((x - bounds.left) / bounds.width * 2 - 1, -(y - bounds.top) / bounds.height * 2 + 1), camera);
    return ray.ray.intersectPlane(plane, new Vector3());
  };
  const end = (cancelled = false) => {
    const started = drag.current;
    if (!started) return;
    drag.current = null;
    if (started.element.hasPointerCapture(started.pointerId)) started.element.releasePointerCapture(started.pointerId);
    editor.onDragEnd(cancelled || !started.moved);
  };
  const down = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !anchor.current?.parent || !editor.onMachineHandleChange) return;
    event.stopPropagation(); event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
    anchor.current.updateWorldMatrix(true, false);
    const plane = new Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new Vector3()), anchor.current.getWorldPosition(new Vector3()));
    const hit = pointerHit(event.clientX, event.clientY, plane);
    if (!hit) return;
    const item = liveObject();
    drag.current = { object: item, plane, hit, inverse: anchor.current.parent.matrixWorld.clone().invert(), point: handlePoint(item), sensitivity: editor.sensitivity, moved: false, element: event.currentTarget, pointerId: event.pointerId };
    editor.onMachineDragStart?.(object.id);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const started = drag.current;
    if (!started) return;
    event.stopPropagation(); event.preventDefault();
    const hit = pointerHit(event.clientX, event.clientY, started.plane);
    if (!hit) return;
    const delta = hit.applyMatrix4(started.inverse).sub(started.hit.clone().applyMatrix4(started.inverse)).multiplyScalar(started.sensitivity);
    started.moved ||= delta.length() > .001;
    const target = started.point.clone().add(delta);
    if (editor.snap) target.set(Math.round(target.x * 10) / 10, Math.round(target.y * 10) / 10, Math.round(target.z * 10) / 10);
    editor.onMachineHandleChange?.(object.id, machineDragValues(started.object, target, side));
  };
  return <group ref={anchor} position={point}><Html center zIndexRange={[20, 10]}>
    <button type="button" aria-label={t("Drag {equipment} handle", { equipment: studioAssetNames[object.slug] })} title={t("Drag this handle. Arrow keys also move it; Escape cancels a drag.")}
      className="flex h-11 w-11 touch-none items-center justify-center rounded-full border-2 border-white bg-teal-700 text-white shadow-md outline-offset-2 focus-visible:outline-2 focus-visible:outline-teal-600 cursor-grab active:cursor-grabbing"
      onPointerDown={down} onPointerMove={move} onPointerUp={() => end()} onPointerCancel={() => end(true)} onLostPointerCapture={() => end(true)}
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); end(true); return; }
        if (drag.current || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const item = liveObject(), target = handlePoint(item), amount = event.shiftKey ? .1 : .025;
        if (item.slug === "pec-deck") {
          const values = { machinePosition: Math.max(0, Math.min(1, (item.machinePosition ?? .5) + (["ArrowUp", "ArrowRight"].includes(event.key) ? amount : -amount))) };
          editor.onMachineDragStart?.(object.id); editor.onMachineHandleChange?.(object.id, values); editor.onDragEnd(); return;
        }
        if (event.key === "ArrowUp") target.y += amount;
        if (event.key === "ArrowDown") target.y -= amount;
        if (event.key === "ArrowLeft") target.z -= amount;
        if (event.key === "ArrowRight") target.z += amount;
        editor.onMachineDragStart?.(object.id); editor.onMachineHandleChange?.(object.id, machineDragValues(item, target, side)); editor.onDragEnd();
      }}><Move aria-hidden="true" size={22} /></button>
  </Html></group>;
}
