"use client";

import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Move } from "@/components/ui/icons";
import { useEffect, useRef, type PointerEvent } from "react";
import { Group, Matrix4, Plane, Raycaster, Vector2, Vector3 } from "three";
import { machineCarriagePoint, machineHandlePoint } from "@/lib/motion/studio-machines";
import { machineDragValues, studioDragDelta, studioSnapTarget, type StudioDragPlane } from "@/lib/motion/workshop-mouse";
import type { StudioObject } from "@/lib/motion/workshop";
import { studioAssetNames } from "@/lib/motion/studio";
import { useWorkshopLanguage } from "./workshop-language";
import type { StudioEditor } from "./studio-controls";
import { canUseStudioMachineHandle } from "@/lib/motion/workshop-interaction";

export function StudioMachineDrag({ object, currentObject, editor, side = "left" }: { object: StudioObject; currentObject?: React.RefObject<StudioObject>; editor: StudioEditor; side?: "left" | "right" }) {
  const { camera, gl } = useThree();
  const { t } = useWorkshopLanguage();
  const anchor = useRef<Group>(null);
  const drag = useRef<{ object: StudioObject; plane: Plane; hit: Vector3; inverse: Matrix4; point: Vector3; world: Vector3; right: Vector3; up: Vector3; forward: Vector3; direction: StudioDragPlane; sensitivity: number; moved: boolean; element: HTMLButtonElement; pointerId: number } | null>(null);
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
  useEffect(() => {
    const cancel = () => end(true);
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && drag.current) { event.preventDefault(); cancel(); } };
    window.addEventListener("blur", cancel); window.addEventListener("keydown", escape);
    return () => { cancel(); window.removeEventListener("blur", cancel); window.removeEventListener("keydown", escape); };
    // Cancel unfinished gestures on removal; all gesture state lives in the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const down = (event: PointerEvent<HTMLButtonElement>) => {
    if (!canUseStudioMachineHandle(editor) || event.button !== 0 || editor.dragging || !anchor.current?.parent || !editor.onMachineHandleChange) return;
    event.stopPropagation(); event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
    anchor.current.updateWorldMatrix(true, false);
    const plane = new Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new Vector3()), anchor.current.getWorldPosition(new Vector3()));
    const hit = pointerHit(event.clientX, event.clientY, plane);
    if (!hit) return;
    const item = liveObject();
    drag.current = { object: item, plane, hit, inverse: anchor.current.parent.matrixWorld.clone().invert(), point: handlePoint(item), world: anchor.current.getWorldPosition(new Vector3()), right: new Vector3(1, 0, 0).applyQuaternion(camera.quaternion), up: new Vector3(0, 1, 0).applyQuaternion(camera.quaternion), forward: camera.getWorldDirection(new Vector3()), direction: editor.dragPlane ?? "view", sensitivity: editor.sensitivity, moved: false, element: event.currentTarget, pointerId: event.pointerId };
    editor.onMachineDragStart?.(object.id);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const started = drag.current;
    if (!started) return;
    event.stopPropagation(); event.preventDefault();
    const hit = pointerHit(event.clientX, event.clientY, started.plane);
    if (!hit) return;
    const delta = studioDragDelta(hit.sub(started.hit), started.right, started.up, started.forward, started.direction, started.sensitivity);
    started.moved ||= delta.length() > .001;
    if (!started.moved) return;
    let target = started.world.clone().add(delta);
    if (editor.snap) target = studioSnapTarget(target, started.world, started.direction);
    editor.onMachineHandleChange?.(object.id, machineDragValues(started.object, target.applyMatrix4(started.inverse), side));
  };
  return <group ref={anchor} position={point}><Html center zIndexRange={[20, 10]}>
    <button type="button" aria-label={t("Drag {equipment} handle", { equipment: studioAssetNames[object.slug] })} title={t("Drag this handle. Arrow keys also move it; Escape cancels a drag.")}
      className="flex h-11 w-11 touch-none items-center justify-center rounded-full border-2 border-white bg-teal-700 text-white shadow-md outline-offset-2 focus-visible:outline-2 focus-visible:outline-teal-600 cursor-grab active:cursor-grabbing"
      onPointerDown={down} onPointerMove={move} onPointerUp={() => end()} onPointerCancel={() => end(true)} onLostPointerCapture={() => end(true)}
      onKeyDown={event => {
        if (event.key === "Escape") {
          if (drag.current) { event.preventDefault(); event.stopPropagation(); end(true); }
          return;
        }
        if (!canUseStudioMachineHandle(editor) || drag.current || editor.dragging || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const item = liveObject(), target = handlePoint(item), amount = event.altKey ? .005 : event.shiftKey ? .1 : .025;
        if (editor.dragPlane && editor.dragPlane !== "view" && anchor.current?.parent) {
          const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion), up = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion), forward = camera.getWorldDirection(new Vector3());
          const delta = (event.key === "ArrowUp" ? up.clone() : event.key === "ArrowDown" ? up.clone().negate() : event.key === "ArrowRight" ? right.clone() : right.clone().negate()).multiplyScalar(amount);
          const world = anchor.current.getWorldPosition(new Vector3()).add(studioDragDelta(delta, right, up, forward, editor.dragPlane, 1));
          editor.onMachineDragStart?.(object.id); editor.onMachineHandleChange?.(object.id, machineDragValues(item, anchor.current.parent.worldToLocal(world), side)); editor.onDragEnd(); return;
        }
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
