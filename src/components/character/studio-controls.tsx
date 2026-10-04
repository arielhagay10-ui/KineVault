"use client";

import { useMotionFrame } from "./motion-frame";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { TransformControls } from "@react-three/drei";
import { Fragment, useEffect, useMemo, useRef, type ReactNode } from "react";
import { BoxHelper, Group, Object3D, Quaternion, Vector3 } from "three";
import type { AnatomyRig } from "@/lib/motion/anatomy";
import { readJointAngles, readSceneTransform, studioPointFromWorld, studioPointToWorld } from "@/lib/motion/studio";
import { constrainSupportedWeight, reachStudioGrip, studioForearmReach, weightGripPoint } from "@/lib/motion/studio-grip";
import { sampleStudioObject } from "@/lib/motion/studio";
import { jointLimits, jointSlugs, type JointAngles, type JointSlug, type RigPose, type ScenePoint, type ScenePresentation, type SceneTransform, type StudioObject } from "@/lib/motion/workshop";
import { AdjustableBench } from "./adjustable-bench";
import { useStudioDrag } from "./studio-drag";
import { StudioCable } from "./studio-cable";
import { StudioMachine } from "./studio-machines";
import { isStudioMachine } from "@/lib/motion/studio-machines";
import { equipmentBoundsOverlap, needsPlacementAdvisory, placementBodyBounds } from "@/lib/motion/workshop-placement";
import type { MachineDragValues, StudioDragPlane } from "@/lib/motion/workshop-mouse";
import { poseLimbs, type PoseLimb } from "@/lib/motion/limb-pose";
import { StudioLimbDrag } from "./studio-limb-drag";

export type StudioSelection = { kind: "body" } | { kind: "joint"; slug: JointSlug } | { kind: "object"; id: string } | null;
export type StudioEditor = {
  adjusting?: boolean;
  limbPosing?: boolean;
  limbPose?: RigPose;
  blockedLimbs?: PoseLimb[];
  onLimbDragStart?: () => void;
  onLimbPoseChange?: (limb: PoseLimb, poses: RigPose, error: number) => void;
  interactionEnabled?: boolean;
  dragPlane?: StudioDragPlane;
  onMachineDragStart?: (id: string) => void;
  onMachineHandleChange?: (id: string, values: MachineDragValues) => void;
  bodyLocked?: boolean;
  placementLockedIds?: string[];
  supportObjectIds?: string[];
  onPlacementOverlap?: (id: string, overlap: boolean) => void;
  frontalPlane?: boolean;
  selection: StudioSelection; tool: "select" | "translate" | "rotate" | "scale"; snap: boolean; sensitivity: number; playing: boolean; dragging: boolean; posing: boolean;
  onSelect: (selection: StudioSelection) => void;
  onActivate?: (selection: StudioSelection) => void;
  onBodyChange: (transform: SceneTransform) => void;
  onObjectChange: (id: string, transform: SceneTransform) => void;
  onJointChange: (slug: JointSlug, angles: JointAngles) => void;
  onDragStart: () => void;
  onDragEnd: (cancelled?: boolean) => void;
  onGripReach: (id: string, reachable: boolean) => void;
  captureElbow?: { objectId: string; side: "left" | "right" } | null;
  onCaptureElbow?: (id: string, side: "left" | "right", point: ScenePoint) => void;
  onPresentationChange?: (presentation: ScenePresentation) => void;
  blockedJoints?: JointSlug[];
};

function Handles({ object, mode, editor, onCommit }: {
  object: React.RefObject<Object3D> | Object3D; mode: "translate" | "rotate" | "scale"; editor: StudioEditor; onCommit: (object: Object3D) => void;
}) {
  const invalidate = useThree(state => state.invalidate);
  const start = useRef<{ position: Vector3; rotation: Quaternion; scale: Vector3; sensitivity: number } | null>(null);
  const frontalShoulder = !!editor.frontalPlane && editor.selection?.kind === "joint" && editor.selection.slug.endsWith("shoulder");
  return <TransformControls object={object} mode={mode} space={mode === "rotate" ? "local" : "world"} size={0.85}
    translationSnap={editor.snap ? 0.1 : null} rotationSnap={editor.snap ? Math.PI / 12 : null} scaleSnap={editor.snap ? 0.1 : null}
    showX={!frontalShoulder} showY={!frontalShoulder && mode !== "scale" && !(editor.selection?.kind === "joint" && editor.selection.slug.endsWith("knee"))} showZ={mode !== "scale" && !(editor.selection?.kind === "joint" && editor.selection.slug.endsWith("knee"))}
    onMouseDown={() => {
      const target = object instanceof Object3D ? object : object.current;
      start.current = { position: target.position.clone(), rotation: target.quaternion.clone(), scale: target.scale.clone(), sensitivity: editor.sensitivity };
      editor.onDragStart();
    }} onObjectChange={() => {
      const target = object instanceof Object3D ? object : object.current;
      const initial = start.current;
      if (initial) {
        if (mode === "translate") target.position.sub(initial.position).multiplyScalar(initial.sensitivity).add(initial.position);
        if (mode === "rotate") target.quaternion.copy(initial.rotation.clone().slerp(target.quaternion, initial.sensitivity));
        if (mode === "scale") target.scale.sub(initial.scale).multiplyScalar(initial.sensitivity).add(initial.scale);
      }
      if (mode === "scale") target.scale.setScalar(target.scale.x);
      if (frontalShoulder) target.rotation.set(0, 0, target.rotation.z);
      if (editor.selection?.kind === "joint" && editor.selection.slug.endsWith("knee")) {
        const limits = jointLimits[editor.selection.slug].x;
        target.rotation.set(Math.max(-limits[1] * Math.PI / 180, Math.min(-limits[0] * Math.PI / 180, target.rotation.x)), 0, 0);
      }
      invalidate();
    }} onMouseUp={() => {
      const target = "current" in object ? object.current : object;
      if (target) {
        onCommit(target);
        if (editor.selection?.kind !== "joint") {
          const value = readSceneTransform(target);
          target.position.set(value.x, value.y, value.z);
          target.rotation.set(value.rotationX * Math.PI / 180, value.rotationY * Math.PI / 180, value.rotationZ * Math.PI / 180);
          target.scale.setScalar(value.scale);
        }
      }
      editor.onDragEnd();
      start.current = null;
    }} />;
}

export function StudioBody({ transform, rig, editor, children }: { transform: SceneTransform; rig: AnatomyRig; editor?: StudioEditor; children: ReactNode }) {
  const group = useRef<Group>(null!);
  const dragEvents = useStudioDrag(group, { kind: "body" }, editor, target => editor?.onBodyChange(readSceneTransform(target)));
  return <>
    <group ref={group} {...dragEvents} position={[transform.x, transform.y, transform.z]} rotation={[transform.rotationX, transform.rotationY, transform.rotationZ].map(value => value * Math.PI / 180) as [number, number, number]} scale={transform.scale}
      onClick={editor && editor.interactionEnabled !== false ? event => { event.stopPropagation(); if (event.delta < 3) editor.onSelect({ kind: "body" }); } : undefined}
      onDoubleClick={editor?.onActivate ? event => { event.stopPropagation(); if (event.delta < 3) editor.onActivate?.({ kind: "body" }); } : undefined}>
      {children}
    </group>
    {editor && editor.interactionEnabled !== false && !editor.playing && <>
      {editor.limbPosing && poseLimbs.filter(limb => !editor.blockedLimbs?.includes(limb)).map(limb => {
        const side = limb.startsWith("left") ? "left" : "right";
        return <Fragment key={limb}>{createPortal(<StudioLimbDrag rig={rig} limb={limb} editor={editor} />, rig.bones[`${side}-${limb.endsWith("hand") ? "wrist" : "ankle"}`])}</Fragment>;
      })}
      {editor.selection?.kind === "body" && !editor.bodyLocked && editor.tool !== "select" && <Handles object={group} mode={editor.tool} editor={editor} onCommit={object => editor.onBodyChange(readSceneTransform(object))} />}
      {editor.posing && jointSlugs.map(slug => <Fragment key={slug}>{createPortal(<mesh onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); if (event.delta < 3) editor.onSelect({ kind: "joint", slug }); }} renderOrder={10}>
        <sphereGeometry args={[0.045, 12, 12]} /><meshBasicMaterial depthTest={false} color={editor.selection?.kind === "joint" && editor.selection.slug === slug ? "#f59e0b" : "#2b9891"} transparent opacity={0.85} />
      </mesh>, rig.bones[slug])}</Fragment>)}
      {editor.selection?.kind === "joint" && !editor.selection.slug.endsWith("wrist") && !editor.blockedJoints?.includes(editor.selection.slug) && editor.tool === "rotate" && <Handles object={rig.bones[editor.selection.slug]} mode="rotate" editor={editor}
        onCommit={object => { if (editor.selection?.kind === "joint") editor.onJointChange(editor.selection.slug, readJointAngles(editor.selection.slug, object)); }} />}
    </>}
  </>;
}

function Beam({ from, to, radius = 0.04, color = "#627479" }: { from: [number, number, number]; to: [number, number, number]; radius?: number; color?: string }) {
  const start = new Vector3(...from), end = new Vector3(...to), direction = end.clone().sub(start);
  return <mesh position={start.add(end).multiplyScalar(0.5)} quaternion={new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize())}>
    <cylinderGeometry args={[radius, radius, direction.length(), 12]} /><meshStandardMaterial color={color} metalness={0.5} roughness={0.35} />
  </mesh>;
}

function Kettlebell({ both }: { both: boolean }) {
  const half = both ? 0.22 : 0.16;
  return <>
    <mesh position={[0, -0.08, 0]} scale={[1, 0.9, 1]} castShadow><sphereGeometry args={[0.17, 24, 20]} /><meshStandardMaterial color="#263b3b" metalness={0.5} roughness={0.4} /></mesh>
    <Beam from={[-half, 0.2, 0]} to={[half, 0.2, 0]} radius={0.022} />
    {[-half, half].map(x => <Beam key={x} from={[x, 0.2, 0]} to={[Math.sign(x) * 0.112, -0.02, 0]} radius={0.022} />)}
  </>;
}
function Weights({ barbell }: { barbell: boolean }) {
  const half = barbell ? 0.8 : 0.14;
  return <>
    <Beam from={[-half - 0.08, 0.2, 0]} to={[half + 0.08, 0.2, 0]} radius={0.025} />
    {[-half, half].map(x => <mesh key={x} position={[x, 0.2, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[barbell ? 0.2 : 0.1, barbell ? 0.2 : 0.1, 0.08, 24]} /><meshStandardMaterial color="#263b3b" /></mesh>)}
  </>;
}

export function StudioEquipment({ objects, body, rig, pose, timeMs, editor }: { objects: StudioObject[]; body: SceneTransform; rig: AnatomyRig; pose: RigPose; timeMs: number; editor?: StudioEditor }) {
  const geometry = useRef(new Map<string, Group>());
  const placementSnapshot = JSON.stringify({ objects, body, pose, timeMs, supports: editor?.supportObjectIds });
  return <>{objects.map(object => <StudioAsset key={object.id} object={object} body={body} rig={rig} pose={pose} editor={editor} onGeometry={group => { if (group) geometry.current.set(object.id, group); else geometry.current.delete(object.id); }} />)}<StudioPlacementAdvisory objects={objects} body={body} rig={rig} geometry={geometry} editor={editor} placementSnapshot={placementSnapshot} /></>;
}

/** Registered after the equipment solvers, so bounds use the final held/machine pose. */
function StudioPlacementAdvisory({ objects, body, rig, geometry, editor, placementSnapshot }: { objects: StudioObject[]; body: SceneTransform; rig: AnatomyRig; geometry: React.RefObject<Map<string, Group>>; editor?: StudioEditor; placementSnapshot: string }) {
  const lastPlacement = useRef<string | null>(null);
  useFrame(() => {
    if (!editor?.onPlacementOverlap || editor.playing || editor.dragging || editor.adjusting) return;
    rig.root.updateWorldMatrix(true, true);
    const solvedPose = Object.values(rig.bones).map(bone => bone.matrixWorld.elements);
    const snapshot = JSON.stringify({ placementSnapshot, solvedPose });
    if (snapshot === lastPlacement.current) return;
    lastPlacement.current = snapshot;
    for (const object of objects) {
      const mesh = geometry.current.get(object.id);
      const overlap = !!mesh && needsPlacementAdvisory(object, editor.supportObjectIds) && equipmentBoundsOverlap(mesh, placementBodyBounds(rig.root, JSON.stringify(solvedPose)), .015 * body.scale);
      editor.onPlacementOverlap(object.id, overlap);
    }
  });
  return null;
}

function SelectionOutline({ target }: { target: React.RefObject<Group> }) {
  const outline = useMemo(() => new BoxHelper(new Group(), "#2b9891"), []);
  useEffect(() => () => { outline.geometry.dispose(); outline.material.dispose(); }, [outline]);
  useFrame(() => { if (target.current) outline.setFromObject(target.current); });
  return <primitive object={outline} />;
}

function StudioAsset({ object, body, rig, pose, editor, onGeometry }: { object: StudioObject; body: SceneTransform; rig: AnatomyRig; pose: RigPose; editor?: StudioEditor; onGeometry: (group: Group | null) => void }) {
  const group = useRef<Group>(null!);
  const frameRef = useMotionFrame();
  const currentObject = useRef(object);
  const scratch = useMemo(() => ({ rotation: new Quaternion(), center: new Vector3(), capturedElbow: new Vector3() }), []);
  const selected = editor?.selection?.kind === "object" && editor.selection.id === object.id;
  const lastReach = useRef<boolean | null>(null);
  const captured = useRef<StudioEditor["captureElbow"]>(null);
  const dragEvents = useStudioDrag(group, { kind: "object", id: object.id }, editor, target => editor?.onObjectChange(object.id, readSceneTransform(target)));
  useFrame(() => {
    const liveObject = sampleStudioObject(object, frameRef?.current.timeMs ?? 0);
    currentObject.current = liveObject;
    if (group.current && !editor?.dragging) {
      group.current.position.set(liveObject.x, liveObject.y, liveObject.z);
      group.current.rotation.set(liveObject.rotationX * Math.PI / 180, liveObject.rotationY * Math.PI / 180, liveObject.rotationZ * Math.PI / 180);
      group.current.scale.setScalar(liveObject.scale);
      group.current.updateWorldMatrix(true, true);
    }
    const livePose = frameRef?.current.pose ?? pose;
    if (!group.current || object.attachment === "none" || !["barbell", "dumbbell", "kettlebell"].includes(object.slug)) return;
    group.current.updateWorldMatrix(true, false);
    const sides: ("left" | "right")[] = object.attachment === "both" ? ["left", "right"] : object.attachment === "left" || object.attachment === "right" ? [object.attachment] : [];
    const rotation = group.current.getWorldQuaternion(scratch.rotation);
    const center = group.current.getWorldPosition(scratch.center);
    const supports = sides.flatMap(side => {
      const lock = object.elbowLocks?.[side];
      if (!lock) return [];
      const gripOffset = group.current.localToWorld(weightGripPoint(object, side)).sub(center);
      return [{ center: studioPointToWorld(lock, body).sub(gripOffset), radius: studioForearmReach(rig, side) }];
    });
    if (supports.length) {
      group.current.position.copy(group.current.parent!.worldToLocal(constrainSupportedWeight(center, supports)));
      group.current.updateWorldMatrix(true, false);
    }
    let reachable = true;
    for (const side of sides) {
      const grip = group.current.localToWorld(weightGripPoint(object, side));
      const lock = object.elbowLocks?.[side];
      reachable = reachStudioGrip(rig, side, grip, rotation, livePose[`${side}-wrist`], lock ? studioPointToWorld(lock, body) : undefined) < 0.005 && reachable;
    }
    const request = editor?.captureElbow;
    if (request?.objectId === object.id && request !== captured.current) {
      captured.current = request;
      editor?.onCaptureElbow?.(object.id, request.side, studioPointFromWorld(rig.bones[`${request.side}-elbow`].getWorldPosition(scratch.capturedElbow), body));
    }
    if (lastReach.current !== reachable) { lastReach.current = reachable; editor?.onGripReach(object.id, reachable); }
  }, -1);
  return <>
    <group ref={group} {...dragEvents} position={[object.x, object.y, object.z]} rotation={[object.rotationX, object.rotationY, object.rotationZ].map(value => value * Math.PI / 180) as [number, number, number]} scale={object.scale}
      onClick={editor && editor.interactionEnabled !== false ? event => { event.stopPropagation(); if (event.delta < 3) editor.onSelect({ kind: "object", id: object.id }); } : undefined}
      onDoubleClick={editor?.onActivate ? event => { event.stopPropagation(); if (event.delta < 3) editor.onActivate?.({ kind: "object", id: object.id }); } : undefined}>
      <group ref={onGeometry}>{isStudioMachine(object.slug) ? <StudioMachine object={object} currentObject={currentObject} editor={editor} /> : object.slug === "cable-machine" ? <StudioCable object={object} currentObject={currentObject} rig={rig} group={group} pose={pose} editor={editor} />
        : object.slug === "kettlebell" ? <Kettlebell both={object.attachment === "both"} />
        : object.slug === "bench" ? <AdjustableBench angle={object.benchAngle} />
        : object.slug === "squat-rack" ? <>
          {[-0.65, 0.65].map(x => <group key={x}>
            <Beam from={[x, 0, -0.3]} to={[x, 2.3, -0.3]} /><Beam from={[x, 0.06, -0.8]} to={[x, 0.06, 0.6]} />
            <Beam from={[x, 1.4, -0.3]} to={[x, 1.4, 0.5]} radius={0.025} />
          </group>)}<Beam from={[-0.65, 2.3, -0.3]} to={[0.65, 2.3, -0.3]} />
        </> : <Weights barbell={object.slug === "barbell"} />}</group>
      {selected && <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.45, 0.48, 48]} /><meshBasicMaterial color="#2b9891" /></mesh>}
    </group>
    {selected && <SelectionOutline target={group} />}
    {editor && editor.interactionEnabled !== false && !editor.placementLockedIds?.includes(object.id) && selected && editor.tool !== "select" && !editor.playing && <Handles object={group} mode={editor.tool} editor={editor} onCommit={target => editor.onObjectChange(object.id, readSceneTransform(target))} />}
  </>;
}
