"use client";

import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Box3, Box3Helper, Group, Matrix3, Mesh, Plane, Raycaster, Vector2, Vector3 } from "three";
import type { AnatomyRig } from "@/lib/motion/anatomy";
import { supportHandleContainsPoint, supportPickTargets } from "@/lib/motion/support-picking";
import { pickSelfSupport } from "@/lib/motion/self-support";
import { sampleStudioObject } from "@/lib/motion/studio";
import { clampSupportPoint, supportSurfaceFromWorld, supportSurfaceToWorld } from "@/lib/motion/support-surfaces";
import type { StudioLayout, StudioObject, SupportContact, SupportRegion, WorkshopScene } from "@/lib/motion/workshop";
import type { StudioEditor } from "./studio-controls";
import { useMotionFrame } from "./motion-frame";
import { useWorkshopLanguage } from "./workshop-language";

function benchContact(region: SupportRegion, object: StudioObject, surface: "seat" | "pad"): SupportContact {
  return { region, objectId: object.id, surface, point: { x: 0, y: surface === "seat" ? .235 : .81, z: .054 }, normal: { x: 0, y: 0, z: 1 }, turn: 0 };
}

function BenchSupportGuide({ contact, studio, timeMs }: { contact: SupportContact; studio: StudioLayout; timeMs: number }) {
  const mesh = useRef<Mesh>(null);
  const world = supportSurfaceToWorld(contact, studio, timeMs);
  const scale = studio.objects.find(item => item.id === contact.objectId)?.scale ?? 1;
  if (!world) return null;
  return <mesh ref={mesh} position={world.point} quaternion={world.rotation} raycast={() => {}}>
    <planeGeometry args={[(contact.surface === "seat" ? .46 : .44) * scale, (contact.surface === "seat" ? .47 : 1.62) * scale]} />
    <meshBasicMaterial color="#638ba6" transparent opacity={.25} depthWrite={false} side={2} polygonOffset polygonOffsetFactor={-2} />
  </mesh>;
}

export function WorkshopSupportOverlay({ rig, scene, editor, timeMs }: { rig: AnatomyRig; scene: WorkshopScene; editor?: StudioEditor; timeMs: number }) {
  const { camera, gl, scene: root, invalidate } = useThree();
  const frame = useMotionFrame();
  const { t } = useWorkshopLanguage();
  const marker = useRef<Group>(null);
  const preview = useRef<SupportContact | null>(null);
  const active = editor?.supportEdit;
  const latest = useRef({ scene, editor, timeMs });
  useEffect(() => { latest.current = { scene, editor, timeMs }; });
  const scratch = useMemo(() => ({ ray: new Raycaster(), pointer: new Vector2(), plane: new Plane(), hit: new Vector3() }), []);
  const drag = useRef<{ initial: SupportContact; current: SupportContact; offset: Vector3; pointerOffset: Vector2; moved: boolean; pointerId: number; mesh?: Mesh } | null>(null);
  const studio = scene.studio;
  useFrame(() => {
    const current = frame?.current.scene ?? latest.current.scene;
    const layout = current.studio;
    const contact = drag.current?.current ?? preview.current ?? layout?.supports?.find(item => item.region === latest.current.editor?.supportEdit?.region);
    const world = contact && layout && supportSurfaceToWorld(contact, layout, frame?.current.timeMs ?? latest.current.timeMs, rig);
    if (marker.current) { marker.current.visible = !!world; if (world) { marker.current.position.copy(world.point); marker.current.updateWorldMatrix(true, true); } }
  }, -1);
  useEffect(() => {
    if (!active || editor?.playing || !studio) return;
    // Cache eligible geometry once per editing session, never during playback.
    const targets = supportPickTargets(root, studio);
    const meshes = targets.map(item => item.mesh);
    const bounds = new Map<string, Box3>();
    if (active.picking) for (const { mesh, object } of targets) {
      const box = bounds.get(object.id) ?? new Box3();
      box.union(new Box3().setFromObject(mesh)); bounds.set(object.id, box);
    }
    const helpers = [...bounds.values()].map(box => new Box3Helper(box, 0x638ba6));
    for (const helper of helpers) { helper.raycast = () => {}; root.add(helper); }
    const live = () => ({ layout: (frame?.current.scene ?? latest.current.scene).studio!, time: frame?.current.timeMs ?? latest.current.timeMs, edit: latest.current.editor });
    const rayAt = (event: { clientX: number; clientY: number }) => {
      const bounds = gl.domElement.getBoundingClientRect();
      scratch.pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
      scratch.ray.setFromCamera(scratch.pointer, camera);
    };
    const pick = (region: SupportRegion): { contact: SupportContact; mesh?: Mesh } | undefined => {
      const { layout, time } = live();
      let distance = Infinity, result: { contact: SupportContact; mesh?: Mesh } | undefined;
      const accept = (contact: SupportContact, hit: Vector3, mesh?: Mesh) => { const next = scratch.ray.ray.origin.distanceTo(hit); if (next < distance) { distance = next; result = { contact, mesh }; } };
      const self = pickSelfSupport(rig, scratch.ray, region);
      if (self) accept(self.contact, self.point, self.mesh);
      const floor = scratch.ray.ray.intersectPlane(scratch.plane.set(new Vector3(0, 1, 0), 0), scratch.hit);
      if (floor && Math.abs(floor.x) <= 10 && Math.abs(floor.z) <= 10) accept(supportSurfaceFromWorld(region, null, "floor", floor), floor);
      for (const item of layout.objects) {
        if (item.slug !== "bench") continue;
        const object = sampleStudioObject(item, time);
        for (const surface of ["seat", "pad"] as const) {
          const seed = benchContact(region, object, surface), world = supportSurfaceToWorld(seed, layout, time)!;
          const hit = scratch.ray.ray.intersectPlane(scratch.plane.setFromNormalAndCoplanarPoint(world.normal, world.point), scratch.hit);
          if (!hit) continue;
          const contact = supportSurfaceFromWorld(region, object, surface, hit, world.normal);
          const bounded = clampSupportPoint(contact, contact.point);
          if (Math.abs(bounded.x - contact.point.x) < 1e-5 && Math.abs(bounded.y - contact.point.y) < 1e-5) accept({ ...contact, point: bounded }, hit);
        }
      }
      for (const hit of scratch.ray.intersectObjects(meshes, false)) {
        const target = targets.find(item => item.mesh === hit.object);
        if (!target || !hit.face) continue;
        const normal = hit.face.normal.clone().applyNormalMatrix(new Matrix3().getNormalMatrix(hit.object.matrixWorld));
        accept(supportSurfaceFromWorld(region, sampleStudioObject(layout.objects.find(item => item.id === target.object.id) ?? target.object, time), "body", hit.point, normal), hit.point, target.mesh);
        break;
      }
      return result;
    };
    const finish = (cancelled = false) => {
      const started = drag.current;
      if (!started) return;
      drag.current = null;
      if (gl.domElement.hasPointerCapture(started.pointerId)) gl.domElement.releasePointerCapture(started.pointerId);
      live().edit?.onSupportDragEnd?.(cancelled || !started.moved); invalidate();
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const { edit, layout, time } = live();
      if (!edit?.supportEdit) return;
      rayAt(event);
      if (edit.supportEdit.picking) {
        event.preventDefault(); event.stopImmediatePropagation();
        const picked = pick(edit.supportEdit.region);
        if (picked) { preview.current = null; edit.onSupportPick?.(picked.contact); invalidate(); }
      } else if (edit.supportEdit.adjusting) {
        const contact = layout.supports?.find(item => item.region === edit.supportEdit!.region);
        const world = contact && supportSurfaceToWorld(contact, layout, time, rig);
        const bounds = gl.domElement.getBoundingClientRect();
        if (!contact || !world || !supportHandleContainsPoint(world.point, camera, bounds, event)) return;
        const start = scratch.ray.ray.intersectPlane(scratch.plane.setFromNormalAndCoplanarPoint(world.normal, world.point), scratch.hit);
        if (!start) return;
        event.preventDefault(); event.stopImmediatePropagation();
        const target = targets.find(item => item.object.id === contact.objectId && new Box3().setFromObject(item.mesh).distanceToPoint(world.point) < .02);
        const center = world.point.clone().project(camera);
        const pointerOffset = new Vector2(bounds.left + (center.x + 1) * bounds.width / 2 - event.clientX, bounds.top + (1 - center.y) * bounds.height / 2 - event.clientY);
        drag.current = { initial: contact, current: contact, offset: world.point.clone().sub(start), pointerOffset, moved: false, pointerId: event.pointerId, mesh: target?.mesh };
        edit.onSupportDragStart?.(); gl.domElement.setPointerCapture(event.pointerId);
      }
    };
    const move = (event: PointerEvent) => {
      const { edit, layout, time } = live();
      if (!edit?.supportEdit) return;
      rayAt(event);
      const started = drag.current;
      if (started) {
        event.preventDefault(); event.stopImmediatePropagation();
        const world = supportSurfaceToWorld(started.initial, layout, time, rig);
        if (!world) return;
        if (started.initial.surface.startsWith("self:")) {
          rayAt({ clientX: event.clientX + started.pointerOffset.x, clientY: event.clientY + started.pointerOffset.y });
          const picked = pickSelfSupport(rig, scratch.ray, started.initial.region);
          if (!picked) return;
          const next = { ...picked.contact, turn: started.initial.turn };
          if (edit.onSupportChange?.(next) === false) return;
          started.moved ||= picked.point.distanceTo(world.point) > .001;
          started.current = next; invalidate(); return;
        }
        const meshHit = started.mesh ? scratch.ray.intersectObject(started.mesh, false)[0] : undefined;
        // A box edge must stop the drag, rather than switching to its adjacent face.
        if (meshHit?.face && meshHit.face.normal.clone().applyNormalMatrix(new Matrix3().getNormalMatrix(meshHit.object.matrixWorld)).dot(world.normal) < .98) return;
        const hit = started.mesh ? meshHit?.point : scratch.ray.ray.intersectPlane(scratch.plane.setFromNormalAndCoplanarPoint(world.normal, world.point), scratch.hit);
        if (!hit) return;
        hit.add(started.offset);
        const object = layout.objects.find(item => item.id === started.initial.objectId);
        const next = supportSurfaceFromWorld(started.initial.region, object ? sampleStudioObject(object, time) : null, started.initial.surface, hit, world.normal, started.initial.turn);
        next.point = clampSupportPoint(started.initial, next.point);
        if (edit.onSupportChange?.(next) === false) return;
        started.moved ||= new Vector3(next.point.x, next.point.y, next.point.z).distanceTo(new Vector3(started.initial.point.x, started.initial.point.y, started.initial.point.z)) > .001;
        started.current = next; invalidate();
      } else if (edit.supportEdit.picking) { preview.current = pick(edit.supportEdit.region)?.contact ?? null; invalidate(); }
    };
    const up = () => finish();
    const cancel = () => finish(true);
    const suppressActivation = (event: MouseEvent) => {
      if (live().edit?.supportEdit?.picking || live().edit?.supportEdit?.adjusting) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape" && drag.current) { event.preventDefault(); event.stopImmediatePropagation(); finish(true); } };
    gl.domElement.addEventListener("pointerdown", down, true); gl.domElement.addEventListener("pointermove", move, true);
    gl.domElement.addEventListener("contextmenu", suppressActivation, true); gl.domElement.addEventListener("dblclick", suppressActivation, true);
    window.addEventListener("pointerup", up); window.addEventListener("pointercancel", cancel); window.addEventListener("blur", cancel); window.addEventListener("keydown", key, true);
    return () => {
      finish(true); preview.current = null;
      gl.domElement.removeEventListener("pointerdown", down, true); gl.domElement.removeEventListener("pointermove", move, true);
      gl.domElement.removeEventListener("contextmenu", suppressActivation, true); gl.domElement.removeEventListener("dblclick", suppressActivation, true);
      window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", cancel); window.removeEventListener("blur", cancel); window.removeEventListener("keydown", key, true);
      for (const helper of helpers) { root.remove(helper); helper.geometry.dispose(); for (const material of Array.isArray(helper.material) ? helper.material : [helper.material]) material.dispose(); }
    };
    // Contact previews use refs; restarting a session on each contact change cancels its gesture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.region, active?.picking, active?.adjusting, editor?.playing, camera, gl, root, frame, invalidate, scratch, rig]);
  if (!active || editor?.playing || !studio) return null;
  return <>
    {active.picking && <><mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .002, 0]} raycast={() => {}}><planeGeometry args={[12, 12]} /><meshBasicMaterial color="#638ba6" transparent opacity={.07} depthWrite={false} /></mesh>
      {studio.objects.filter(item => item.slug === "bench").flatMap(object => (["seat", "pad"] as const).map(surface => <BenchSupportGuide key={`${object.id}-${surface}`} contact={benchContact(active.region, object, surface)} studio={studio} timeMs={timeMs} />))}</>}
    <group ref={marker} visible={false}><mesh renderOrder={100} raycast={() => {}}><sphereGeometry args={[.025, 12, 8]} /><meshBasicMaterial color="#638ba6" depthTest={false} /></mesh>
      {!active.picking && <Html center zIndexRange={[20, 10]} style={{ pointerEvents: "none" }}><button type="button" aria-label={t("Adjust support position")} className="h-11 w-11 touch-none rounded-full border-2 border-white bg-primary/20 focus-visible:outline-2 focus-visible:outline-ring" onKeyDown={event => {
        const contact = scene.studio?.supports?.find(item => item.region === active.region);
        if (!contact || !active.adjusting) return;
        const axis = event.key === "ArrowLeft" || event.key === "ArrowRight" ? "x" : event.key === "ArrowUp" || event.key === "ArrowDown" ? contact.surface === "floor" ? "z" : "y" : null;
        if (!axis) return;
        event.preventDefault(); event.stopPropagation();
        const delta = event.key === "ArrowLeft" || event.key === "ArrowDown" ? -.01 : .01;
        editor?.onSupportDragStart?.(); editor?.onSupportChange?.({ ...contact, point: clampSupportPoint(contact, { ...contact.point, [axis]: contact.point[axis] + delta }) }); editor?.onSupportDragEnd?.();
      }} /></Html>}
    </group>
  </>;
}
