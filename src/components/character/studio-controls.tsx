"use client";

import { useMotionFrame } from "./motion-frame";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { Fragment, useMemo, useRef, type ReactNode } from "react";
import { Group, Quaternion, Vector3 } from "three";
import type { AnatomyRig } from "@/lib/motion/anatomy";
import { readSceneTransform, studioPointFromWorld, studioPointToWorld } from "@/lib/motion/studio";
import { constrainSupportedWeight, reachStudioGrip, studioForearmReach, studioGripOffset, weightGripPoint } from "@/lib/motion/studio-grip";
import { sampleStudioObject } from "@/lib/motion/studio";
import { jointSlugs, type JointAngles, type JointSlug, type RigPose, type ScenePoint, type ScenePresentation, type SceneTransform, type StudioObject, type SupportContact, type SupportRegion } from "@/lib/motion/workshop";
import { AdjustableBench } from "./adjustable-bench";
import { useStudioDrag } from "./studio-drag";
import { StudioCable } from "./studio-cable";
import { StudioMachine } from "./studio-machines";
import { isStudioMachine, machineHandlePoint, machineGripPoint, machineLever } from "@/lib/motion/studio-machines";
import { StudioGripMarker } from "./studio-grip-marker";
import type { GripSide } from "@/lib/motion/grip-edit";
import { equipmentBoundsOverlap, needsPlacementAdvisory, placementBodyBounds } from "@/lib/motion/workshop-placement";
import type { MachineDragValues, StudioDragPlane } from "@/lib/motion/workshop-mouse";
import { poseLimbs, type PoseLimb } from "@/lib/motion/limb-pose";
import { StudioLimbDrag } from "./studio-limb-drag";
import { poseArmDrivenWeight, solveDumbbellGrip } from "@/lib/motion/automatic-weight-grip";
import { solveBarbellGrip } from "@/lib/motion/barbell-grip";
import { StudioTransformHandles as Handles } from "./studio-transform-handles";
import { StudioLimbHandles } from "./studio-limb-handles";
import { EquipmentAsset } from "./equipment-asset";
import { supportElbowTarget } from "@/lib/motion/support-contacts";
import { StudioResistanceBand } from "./studio-resistance-band";
import { StudioProp } from "./studio-props";
import { StudioJointRotation } from "./studio-joint-rotation";

export type StudioSelection = { kind: "body" } | { kind: "joint"; slug: JointSlug } | { kind: "object"; id: string } | null;
export type StudioEditor = {
  jointPosePreview?: boolean;
  supportEdit?: { region: SupportRegion; picking: boolean; adjusting: boolean } | null;
  onSupportPick?: (contact: SupportContact) => void;
  onSupportDragStart?: () => void;
  onSupportChange?: (contact: SupportContact) => boolean | void;
  onSupportDragEnd?: (cancelled?: boolean) => void;
  adjusting?: boolean;
  limbPosing?: boolean;
  limbPose?: RigPose;
  limbNudge?: { id: number; limb: PoseLimb; axis: "x" | "y" | "z"; amount: number };
  onLimbNudgeConsumed?: (id: number) => void;
  blockedLimbs?: PoseLimb[];
  onLimbDragStart?: () => void;
  onLimbPoseChange?: (limb: PoseLimb, poses: RigPose, error: number) => void;
  onCableDragStart?: (id: string) => void;
  onCablePoseChange?: (id: string, poses: RigPose, error: number) => void;
  interactionEnabled?: boolean;
  directDragging?: boolean;
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
  onRequestMove?: (selection: StudioSelection) => void;
  onActivate?: (selection: StudioSelection) => void;
  onBodyChange: (transform: SceneTransform) => void;
  onObjectChange: (id: string, transform: SceneTransform) => void;
  onJointChange: (slug: JointSlug, angles: JointAngles) => void;
  onDragStart: () => void;
  onDragEnd: (cancelled?: boolean) => void;
  onGripReach: (id: string, reachable: boolean) => void;
  gripEdit?: { objectId: string; side: GripSide; picking: boolean } | null;
  onGripPoint?: (id: string, side: GripSide, point: ScenePoint) => void;
  captureElbow?: { objectId: string; side: "left" | "right" } | null;
  onCaptureElbow?: (id: string, side: "left" | "right", point: ScenePoint) => void;
  onPresentationChange?: (presentation: ScenePresentation) => void;
  blockedJoints?: JointSlug[];
};

export function StudioBody({ transform, rig, editor, children }: { transform: SceneTransform; rig: AnatomyRig; editor?: StudioEditor; children: ReactNode }) {
  const { camera, gl } = useThree();
  const group = useRef<Group>(null!);
  const frame = useMotionFrame(), previousTransform = useRef<SceneTransform | null>(null);
  useFrame(() => {
    const live = frame?.current.scene?.studio?.body ?? transform;
    if (!group.current || previousTransform.current === live) return;
    previousTransform.current = live;
    group.current.position.set(live.x, live.y, live.z);
    group.current.rotation.set(live.rotationX * Math.PI / 180, live.rotationY * Math.PI / 180, live.rotationZ * Math.PI / 180);
    group.current.scale.setScalar(live.scale);
    group.current.updateWorldMatrix(true, true);
  }, -2.5);
  const dragEvents = useStudioDrag(group, { kind: "body" }, editor, target => editor?.onBodyChange(readSceneTransform(target)));
  return <>
    <group ref={group} {...dragEvents} position={[transform.x, transform.y, transform.z]} rotation={[transform.rotationX, transform.rotationY, transform.rotationZ].map(value => value * Math.PI / 180) as [number, number, number]} scale={transform.scale}
      onClick={editor && editor.interactionEnabled !== false ? event => {
        event.stopPropagation();
        if (event.delta >= 3) return;
        if (!editor.posing) { editor.onSelect({ kind: "body" }); return; }
        const bounds = gl.domElement.getBoundingClientRect();
        let nearest: JointSlug | null = null, distance = 18;
        for (const slug of jointSlugs) {
          const point = rig.bones[slug].getWorldPosition(new Vector3()).project(camera);
          if (point.z < -1 || point.z > 1) continue;
          const offset = Math.hypot(bounds.left + (point.x + 1) * bounds.width / 2 - event.nativeEvent.clientX,
            bounds.top + (1 - point.y) * bounds.height / 2 - event.nativeEvent.clientY);
          if (offset < distance) { nearest = slug; distance = offset; }
        }
        if (nearest) editor.onSelect({ kind: "joint", slug: nearest });
      } : undefined}
      onContextMenu={editor?.onRequestMove ? event => { event.stopPropagation(); event.nativeEvent.preventDefault(); editor.onRequestMove?.({ kind: "body" }); } : undefined}
      onDoubleClick={editor?.onActivate ? event => { event.stopPropagation(); if (event.delta < 3 && !editor.posing) editor.onActivate?.({ kind: "body" }); } : undefined}>
      {children}
    </group>
    {editor && editor.interactionEnabled !== false && !editor.playing && <>
      {editor.limbPosing && poseLimbs.filter(limb => !editor.blockedLimbs?.includes(limb)).map(limb => {
        const side = limb.startsWith("left") ? "left" : "right";
        return <Fragment key={limb}>{createPortal(<StudioLimbDrag rig={rig} limb={limb} editor={editor} />, rig.bones[`${side}-${limb.endsWith("hand") ? "wrist" : "ankle"}`])}</Fragment>;
      })}
      {editor.limbPosing && <StudioLimbHandles rig={rig} editor={editor} />}
      {editor.selection?.kind === "body" && !editor.bodyLocked && editor.tool !== "select" && <Handles object={group} mode={editor.tool} editor={editor} onCommit={object => editor.onBodyChange(readSceneTransform(object))} />}
      {editor.posing && jointSlugs.map(slug => <Fragment key={slug}>{createPortal(<group onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); if (event.delta < 3) editor.onSelect({ kind: "joint", slug }); }}>
        <mesh renderOrder={10}><sphereGeometry args={[0.045, 12, 12]} /><meshBasicMaterial depthTest={false} color={editor.selection?.kind === "joint" && editor.selection.slug === slug ? "#f59e0b" : "#2b9891"} transparent opacity={0.85} /></mesh>
        <mesh><sphereGeometry args={[0.1, 12, 12]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
      </group>, rig.bones[slug])}</Fragment>)}
      {editor.selection?.kind === "joint" && !editor.selection.slug.endsWith("wrist") && !editor.blockedJoints?.includes(editor.selection.slug) && editor.tool === "rotate" && <StudioJointRotation rig={rig} slug={editor.selection.slug} editor={editor} />}
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

export function StudioEquipment({ objects, body, rig, pose, timeMs, editor, frontalPlane }: { objects: StudioObject[]; body: SceneTransform; rig: AnatomyRig; pose: RigPose; timeMs: number; editor?: StudioEditor; frontalPlane?: boolean }) {
  const geometry = useRef(new Map<string, Group>());
  const placementSnapshot = JSON.stringify({ objects, body, pose, timeMs, supports: editor?.supportObjectIds });
  return <>{objects.map(object => <StudioAsset key={object.id} object={object} objects={objects} equipmentRoots={geometry} body={body} rig={rig} pose={pose} editor={editor} frontalPlane={frontalPlane} onGeometry={group => { if (group) geometry.current.set(object.id, group); else geometry.current.delete(object.id); }} />)}<StudioPlacementAdvisory objects={objects} body={body} rig={rig} geometry={geometry} editor={editor} placementSnapshot={placementSnapshot} /></>;
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

function StudioAsset({ object, objects, equipmentRoots, body, rig, pose, editor, frontalPlane, onGeometry }: { object: StudioObject; objects: StudioObject[]; equipmentRoots: React.RefObject<Map<string, Group>>; body: SceneTransform; rig: AnatomyRig; pose: RigPose; editor?: StudioEditor; frontalPlane?: boolean; onGeometry: (group: Group | null) => void }) {
  const group = useRef<Group>(null!);
  const frameRef = useMotionFrame();
  const currentObject = useRef(object);
  const scratch = useMemo(() => ({ rotation: new Quaternion(), center: new Vector3(), capturedElbow: new Vector3() }), []);
  const selected = editor?.selection?.kind === "object" && editor.selection.id === object.id;
  const lastReach = useRef<boolean | null>(null);
  const captured = useRef<StudioEditor["captureElbow"]>(null);
  const lastWeightSolve = useRef<{ frame: unknown; object: StudioObject; pose: RigPose; body: SceneTransform } | null>(null);
  const picking = editor?.gripEdit?.objectId === object.id && editor.gripEdit.picking;
  const dragEditor = picking && editor ? { ...editor, interactionEnabled: false } : editor;
  const dragEvents = useStudioDrag(group, { kind: "object", id: object.id }, dragEditor, target => editor?.onObjectChange(object.id, readSceneTransform(target)));
  const cable = object.slug === "cable-machine" || object.slug === "cable-row-machine" && !!object.cableAttachment;
  const automaticDumbbell = object.slug === "dumbbell" && (object.attachment === "left" || object.attachment === "right") && !object.elbowLocks?.[object.attachment];
  useFrame(() => {
    const frame = frameRef?.current;
    const liveScene = frame?.scene;
    const sourceObject = liveScene?.studio?.objects.find(item => item.id === object.id) ?? object;
    const liveBody = liveScene?.studio?.body ?? body;
    const previous = lastWeightSolve.current;
    // Camera-only frames reuse the solved arm and the clamped equipment pose.
    if (["dumbbell", "barbell"].includes(object.slug) && previous && previous.frame === frame && previous.object === sourceObject && previous.pose === pose && previous.body === liveBody && !editor?.dragging && !editor?.captureElbow) return;
    lastWeightSolve.current = { frame, object: sourceObject, pose, body: liveBody };
    const liveObject = sampleStudioObject(sourceObject, frameRef?.current.timeMs ?? 0);
    currentObject.current = liveObject;
    if (group.current && !editor?.dragging) {
      group.current.position.set(liveObject.x, liveObject.y, liveObject.z);
      group.current.rotation.set(liveObject.rotationX * Math.PI / 180, liveObject.rotationY * Math.PI / 180, liveObject.rotationZ * Math.PI / 180);
      group.current.scale.setScalar(liveObject.scale);
      group.current.updateWorldMatrix(true, true);
    }
    const livePose = frameRef?.current.pose ?? pose;
    if (isStudioMachine(object.slug) && !liveObject.machineUse && liveObject.attachment !== "none" && !cable) {
      const reachable = (["left", "right"] as const).filter(side => liveObject.attachment === side || liveObject.attachment === "both").every(side =>
        rig.handBones[side].localToWorld(studioGripOffset(side)).distanceTo(studioPointToWorld(machineGripPoint(liveObject, side), liveObject)) < .005 * liveObject.scale);
      if (lastReach.current !== reachable) { lastReach.current = reachable; editor?.onGripReach(object.id, reachable); }
    }
    if (!group.current || object.attachment === "none" || !["barbell", "dumbbell", "kettlebell"].includes(object.slug)) return;
    const armDriven = object.poseDriver !== undefined && object.poseDriver !== "weight"
      && !["left", "right"].some(side => (object.attachment === side || object.attachment === "both") && object.elbowLocks?.[side as "left" | "right"])
      && !(editor?.dragging && selected);
    let reachable = true;
    if (armDriven) {
      const solved = poseArmDrivenWeight(rig, liveObject, livePose, frontalPlane);
      const transform = solved.transform;
      reachable = !solved.limited;
      group.current.position.set(transform.x, transform.y, transform.z);
      group.current.rotation.set(transform.rotationX * Math.PI / 180, transform.rotationY * Math.PI / 180, transform.rotationZ * Math.PI / 180);
    }
    group.current.updateWorldMatrix(true, false);
    const sides: ("left" | "right")[] = object.attachment === "both" ? ["left", "right"] : object.attachment === "left" || object.attachment === "right" ? [object.attachment] : [];
    const rotation = group.current.getWorldQuaternion(scratch.rotation);
    const center = group.current.getWorldPosition(scratch.center);
    const elbowTarget = (side: "left" | "right") => supportElbowTarget(rig, liveScene?.studio, side, frameRef?.current.timeMs ?? 0)
      ?? (object.elbowLocks?.[side] ? studioPointToWorld(object.elbowLocks[side]!, liveBody) : undefined);
    const supports = sides.flatMap(side => {
      const lock = elbowTarget(side);
      if (!lock) return [];
      const gripOffset = group.current.localToWorld(weightGripPoint(object, side)).sub(center);
      return [{ center: lock.sub(gripOffset), radius: studioForearmReach(rig, side) }];
    });
    if (supports.length) {
      group.current.position.copy(group.current.parent!.worldToLocal(constrainSupportedWeight(center, supports)));
      group.current.updateWorldMatrix(true, false);
    }
    const sharedDumbbell = object.slug === "dumbbell" && object.attachment === "both" && !supports.length;
    if (!armDriven && sharedDumbbell) reachable = !solveDumbbellGrip(rig, liveObject, livePose, scratch.center, frontalPlane)!.limited;
    for (const side of sides) {
      if (armDriven || sharedDumbbell) break;
      const grip = group.current.localToWorld(weightGripPoint(object, side));
      const lock = elbowTarget(side);
      const automatic = !lock ? object.slug === "barbell"
        ? { ...solveBarbellGrip(rig, side, livePose, grip, new Vector3(1, 0, 0).applyQuaternion(rotation), frontalPlane), transform: liveObject }
        : solveDumbbellGrip(rig, { ...liveObject, attachment: side }, livePose, grip, frontalPlane) : null;
      if (automatic) {
        if (object.slug === "dumbbell" && object.attachment !== "both") {
          const transform = automatic.transform;
          group.current.position.set(transform.x, transform.y, transform.z);
          group.current.rotation.set(transform.rotationX * Math.PI / 180, transform.rotationY * Math.PI / 180, transform.rotationZ * Math.PI / 180);
          group.current.updateWorldMatrix(true, true);
        }
        reachable = !automatic.limited && reachable;
      } else reachable = reachStudioGrip(rig, side, grip, rotation, livePose[`${side}-wrist`], lock) < 0.005 && reachable;
    }
    const request = editor?.captureElbow;
    if (request?.objectId === object.id && request !== captured.current) {
      captured.current = request;
      editor?.onCaptureElbow?.(object.id, request.side, studioPointFromWorld(rig.bones[`${request.side}-elbow`].getWorldPosition(scratch.capturedElbow), body));
    }
    if (lastReach.current !== reachable) { lastReach.current = reachable; editor?.onGripReach(object.id, reachable); }
  }, -1);
  return <>
    <group ref={group} {...dragEvents} userData={{ workshopObjectId: object.id }} position={[object.x, object.y, object.z]} rotation={[object.rotationX, object.rotationY, object.rotationZ].map(value => value * Math.PI / 180) as [number, number, number]} scale={object.scale}
      onClick={editor && editor.interactionEnabled !== false ? event => {
        event.stopPropagation();
        if (event.delta >= 3) return;
        if (picking && !cable && editor.gripEdit) {
          const side = editor.gripEdit.side;
          const automatic = isStudioMachine(object.slug) ? machineHandlePoint(currentObject.current, side) : weightGripPoint({ ...object, gripOffsets: undefined }, side);
          const point = group.current.worldToLocal(event.point.clone()).sub(automatic);
          if (object.slug === "row-machine") point.applyAxisAngle(new Vector3(1, 0, 0), -machineLever(currentObject.current, side).angle);
          editor.onGripPoint?.(object.id, side, { x: point.x, y: point.y, z: point.z });
        } else if (!picking) editor.onSelect({ kind: "object", id: object.id });
      } : undefined}
      onContextMenu={editor?.onRequestMove ? event => { event.stopPropagation(); event.nativeEvent.preventDefault(); editor.onRequestMove?.({ kind: "object", id: object.id }); } : undefined}
      onDoubleClick={editor?.onActivate ? event => { event.stopPropagation(); if (event.delta < 3) editor.onActivate?.({ kind: "object", id: object.id }); } : undefined}>
      <group ref={onGeometry}>{object.slug === "resistance-band" ? <StudioResistanceBand object={object} currentObject={currentObject} studio={{ body, objects }} rig={rig} group={group} equipmentRoots={equipmentRoots} /> : isStudioMachine(object.slug) ? <StudioMachine object={object} currentObject={currentObject} editor={editor} rig={rig} group={group} pose={pose} /> : object.slug === "cable-machine" ? <StudioCable object={object} currentObject={currentObject} rig={rig} group={group} pose={pose} editor={editor} />
        : <EquipmentAsset object={object} currentObject={currentObject} fallback={object.slug === "kettlebell" ? <Kettlebell both={object.attachment === "both"} />
        : object.slug === "bench" ? <AdjustableBench angle={object.benchAngle} />
        : object.slug === "stool" || object.slug === "plyo-box" ? <StudioProp slug={object.slug} />
        : object.slug === "squat-rack" ? <>
          {[-0.65, 0.65].map(x => <group key={x}>
            <Beam from={[x, 0, -0.3]} to={[x, 2.3, -0.3]} /><Beam from={[x, 0.06, -0.8]} to={[x, 0.06, 0.6]} />
            <Beam from={[x, 1.4, -0.3]} to={[x, 1.4, 0.5]} radius={0.025} />
          </group>)}<Beam from={[-0.65, 2.3, -0.3]} to={[0.65, 2.3, -0.3]} />
        </> : <Weights barbell={object.slug === "barbell"} />} />}</group>
      {!cable && editor?.gripEdit?.objectId === object.id && <StudioGripMarker side={editor.gripEdit.side} getPoint={() => isStudioMachine(object.slug) ? machineGripPoint(currentObject.current, editor.gripEdit!.side) : weightGripPoint(object, editor.gripEdit!.side)} />}
    </group>
    {editor && !picking && editor.interactionEnabled !== false && !editor.placementLockedIds?.includes(object.id) && selected && editor.tool !== "select" && !(automaticDumbbell && editor.tool === "rotate") && !editor.playing && <Handles object={group} mode={editor.tool} editor={editor} onCommit={target => editor.onObjectChange(object.id, readSceneTransform(target))} />}
  </>;
}
