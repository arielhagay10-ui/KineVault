"use client";

import { TransformControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Mesh, Object3D, Plane, Raycaster, Vector2, Vector3 } from "three";
import type { TransformControls as TransformControlsImpl } from "three-stdlib";
import { readSceneTransform } from "@/lib/motion/studio";
import { captureStudioTransform, constrainStudioJointRotation, restoreStudioTransform } from "@/lib/motion/studio-transform-gesture";
import { studioConstrainDelta, studioRotationAxes, studioSnapTarget, studioTranslationAxes } from "@/lib/motion/workshop-mouse";
import type { StudioEditor } from "./studio-controls";

export function StudioTransformHandles({ object, mode, editor, onCommit, onChange, onStart }: {
  object: React.RefObject<Object3D> | Object3D;
  mode: "translate" | "rotate" | "scale";
  editor: StudioEditor;
  onCommit: (object: Object3D) => void;
  onChange?: (object: Object3D) => void;
  onStart?: () => void;
}) {
  const { camera, gl, invalidate } = useThree();
  const controls = useRef<TransformControlsImpl>(null);
  const pointer = useRef(new Vector2());
  const start = useRef<{ object: Object3D; position: Vector3; rotation: Object3D["quaternion"]; scale: Vector3; world: Vector3; plane: Plane; hit: Vector3 | null; sensitivity: number; moved: boolean } | null>(null);
  const callbacks = useRef({ editor, onCommit, onChange });
  useEffect(() => { callbacks.current = { editor, onCommit, onChange }; });
  const target = () => object instanceof Object3D ? object : object.current;
  const hitAt = (plane: Plane) => {
    const ray = new Raycaster();
    ray.setFromCamera(pointer.current, camera);
    return ray.ray.intersectPlane(plane, new Vector3());
  };
  const finish = (cancel = false) => {
    const initial = start.current;
    if (!initial) return;
    const item = initial.object;
    start.current = null;
    const control = controls.current as unknown as { dragging: boolean; axis: string | null } | null;
    if (control) { control.dragging = false; control.axis = null; }
    const cancelled = cancel || !initial.moved;
    if (cancelled) {
      restoreStudioTransform(item, initial);
    } else {
      callbacks.current.onCommit(item);
      if (callbacks.current.editor.selection?.kind !== "joint") {
        const value = readSceneTransform(item);
        item.position.set(value.x, value.y, value.z);
        item.rotation.set(value.rotationX * Math.PI / 180, value.rotationY * Math.PI / 180, value.rotationZ * Math.PI / 180);
        item.scale.setScalar(value.scale);
      }
    }
    callbacks.current.editor.onDragEnd(cancelled); invalidate();
  };
  useEffect(() => {
    const remember = (event: PointerEvent) => {
      const bounds = gl.domElement.getBoundingClientRect();
      pointer.current.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    };
    const cancel = () => finish(true);
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && start.current) { event.preventDefault(); event.stopPropagation(); cancel(); } };
    gl.domElement.addEventListener("pointerdown", remember, true);
    gl.domElement.addEventListener("pointermove", remember, true);
    window.addEventListener("pointercancel", cancel); window.addEventListener("blur", cancel); window.addEventListener("keydown", escape, true);
    return () => {
      cancel();
      gl.domElement.removeEventListener("pointerdown", remember, true); gl.domElement.removeEventListener("pointermove", remember, true);
      window.removeEventListener("pointercancel", cancel); window.removeEventListener("blur", cancel); window.removeEventListener("keydown", escape, true);
    };
    // Gesture state and current callbacks live in refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);
  useEffect(() => {
    // Keep individual arrows/rings. Three's free rotation and center/plane
    // pickers bypass the explicit axis choice, so disable both drawing and hits.
    const removed: { mesh: Mesh; material: Mesh["material"]; raycast: Mesh["raycast"] }[] = [];
    controls.current?.traverse(node => {
      if (!(node instanceof Mesh) || !["E", "XYZE", "XYZ", "XY", "XZ", "YZ"].includes(node.name)) return;
      removed.push({ mesh: node, material: node.material, raycast: node.raycast });
      node.material = Array.isArray(node.material) ? node.material.map(material => material.clone()) : node.material.clone();
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.visible = false;
      node.raycast = () => undefined;
    });
    return () => { for (const entry of removed) {
      for (const material of Array.isArray(entry.mesh.material) ? entry.mesh.material : [entry.mesh.material]) material.dispose();
      entry.mesh.material = entry.material; entry.mesh.raycast = entry.raycast;
    } };
  }, []);
  const joint = mode === "rotate" && editor.selection?.kind === "joint" ? editor.selection.slug : null;
  const axes = joint ? studioRotationAxes(joint, editor.frontalPlane) : mode === "translate" ? studioTranslationAxes(editor.dragPlane) : { x: true, y: mode !== "scale", z: mode !== "scale" };
  // Keep a horizontal shoulder ring even when the arm is raised or bent.
  const worldShoulder = joint?.endsWith("shoulder") && !editor.frontalPlane;
  return <TransformControls ref={controls} object={object} mode={mode} space={mode === "rotate" && !worldShoulder ? "local" : "world"} size={.85}
    showX={axes.x} showY={axes.y} showZ={axes.z}
    translationSnap={null} rotationSnap={editor.snap ? Math.PI / 12 : null} scaleSnap={editor.snap ? .1 : null}
    onMouseDown={() => {
      const item = target(), world = item.getWorldPosition(new Vector3());
      const plane = new Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new Vector3()), world);
      start.current = { object: item, ...captureStudioTransform(item), world, plane, hit: hitAt(plane), sensitivity: editor.sensitivity, moved: false };
      if (onStart) onStart(); else editor.onDragStart();
    }} onObjectChange={() => {
      const initial = start.current, item = target();
      if (!initial) return;
      if (mode === "translate") {
        const hit = hitAt(initial.plane), axis = (controls.current as unknown as { axis?: string } | null)?.axis?.toLowerCase();
        if (!hit || !initial.hit || !["x", "y", "z"].includes(axis ?? "")) { item.position.copy(initial.position); return; }
        let world = initial.world.clone().add(studioConstrainDelta(studioConstrainDelta(hit.sub(initial.hit), axis as "x" | "y" | "z"), editor.dragPlane ?? "view").multiplyScalar(initial.sensitivity));
        if (editor.snap) world = studioSnapTarget(world, initial.world, axis as "x" | "y" | "z");
        item.position.copy(item.parent ? item.parent.worldToLocal(world) : world);
      }
      if (mode === "rotate") item.quaternion.copy(initial.rotation.clone().slerp(item.quaternion, initial.sensitivity));
      if (mode === "scale") item.scale.sub(initial.scale).multiplyScalar(initial.sensitivity).add(initial.scale).setScalar(item.scale.x);
      if (joint) {
        constrainStudioJointRotation(joint, item, initial.rotation);
        if (editor.frontalPlane && joint.endsWith("shoulder")) { item.rotation.x = 0; item.rotation.y = 0; }
      }
      initial.moved ||= item.position.distanceTo(initial.position) > .0001 || item.quaternion.angleTo(initial.rotation) > .0001 || item.scale.distanceTo(initial.scale) > .0001;
      // The scene owner publishes these previews externally and records once on release.
      if (onChange) onChange(item);
      else if (initial.moved) onCommit(item);
      invalidate();
    }} onMouseUp={() => finish()} />;
}
