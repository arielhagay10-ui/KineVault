"use client";

import { Canvas, createPortal, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { Component, Fragment, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BufferGeometry, Group, PerspectiveCamera, Vector3 } from "three";
import type { OrbitControls as OrbitControlsInstance } from "three-stdlib";
import type { AnatomyRig } from "@/lib/motion/anatomy";
import { anatomyModelUrl, correctAuthoredArmPath, createAnatomyRig, highlightAnatomyRig, plantAnatomyFeet, poseAnatomyRig, type MuscleOption } from "@/lib/motion/anatomy";
import { AnatomyControls } from "./anatomy-controls";
import { AdjustableBench } from "./adjustable-bench";
import type { RigPose, WorkshopScene } from "@/lib/motion/workshop";
import { sampleWorkshopPose } from "@/lib/motion/workshop";
import { cableAttachmentFrame, forearmRotationForScene, isCablePushdown } from "@/lib/motion/equipment-motion";
import { identityTransform } from "@/lib/motion/workshop";
import { maxPulleyHeight } from "@/lib/motion/studio";
import { StudioBody, StudioEquipment, type StudioEditor } from "./studio-controls";
import { applyStudioSeating } from "@/lib/motion/studio-seat";
import { applyStudioMachine, type MachineReachReport } from "@/lib/motion/studio-machines";
import { constrainFrontalPose, resolveStudioObject } from "@/lib/motion/studio-constraints";
import { cameraDistanceForPoints, studioCameraPoints } from "@/lib/motion/studio-camera";
import { fadeWorkshopEquipment, fitWorkshopCamera, oppositeCameraPosition, workshopCameraView, zoomCameraPosition, type WorkshopCameraAction, type WorkshopCameraCommand } from "@/lib/motion/workshop-camera";
import { workshopEditorForInteraction } from "@/lib/motion/workshop-interaction";
import { muscleGroups } from "@/lib/motion/anatomy";
import { WorkshopCameraControls, WorkshopPreviewFallback, type WorkshopInteractionMode } from "./workshop-camera-controls";
import { translateWorkshopTree, useWorkshopLanguage } from "./workshop-language";

const metal = "#778b8b";

function FadedEquipment({ faded, children }: { faded: boolean; children: ReactNode }) {
  const group = useRef<Group>(null);
  useLayoutEffect(() => {
    if (faded && group.current) return fadeWorkshopEquipment(group.current);
  }, [faded]);
  return <group ref={group}>{children}</group>;
}

function Dumbbell() {
  return <group rotation={[0, 0, Math.PI / 2]}>
    <mesh castShadow><cylinderGeometry args={[0.024, 0.024, 0.28, 16]} /><meshStandardMaterial color={metal} metalness={0.6} roughness={0.3} /></mesh>
    {[-0.12, 0.12].map((offset) => <mesh key={offset} position={[0, offset, 0]} castShadow>
      <cylinderGeometry args={[0.095, 0.095, 0.07, 20]} /><meshStandardMaterial color="#263b3b" metalness={0.3} roughness={0.5} />
    </mesh>)}
  </group>;
}

function Equipment({ scene }: { scene: WorkshopScene }) {
  const asset = scene.equipment;
  if (!asset || asset.slug === "dumbbell-pair") return null;
  const transform: [number, number, number] = [asset.x, asset.y, asset.z];
  if (asset.slug === "barbell") return <group position={transform} scale={asset.scale}>
    <mesh position={[0, 0.82, 0]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.035, 0.035, 1.7, 16]} /><meshStandardMaterial color={metal} metalness={0.7} roughness={0.25} /></mesh>
    {[-0.72, 0.72].map((x) => <mesh key={x} position={[x, 0.82, 0]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.18, 0.18, 0.09, 20]} /><meshStandardMaterial color="#263b3b" /></mesh>)}
  </group>;
  return <group position={transform} scale={asset.scale}>
    <mesh position={[1.3, 1.1, -0.3]} castShadow><boxGeometry args={[0.22, 2.25, 0.25]} /><meshStandardMaterial color="#516768" metalness={0.45} /></mesh>
    <mesh position={[1.3, 2.2, -0.3]} castShadow><boxGeometry args={[0.55, 0.2, 0.5]} /><meshStandardMaterial color="#263b3b" /></mesh>
    <mesh position={[0.8, 1.1, -0.3]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.012, 0.012, 1, 8]} /><meshStandardMaterial color="#879994" /></mesh>
    <mesh position={[0.28, 1.1, -0.3]}><boxGeometry args={[0.08, 0.2, 0.08]} /><meshStandardMaterial color="#263b3b" /></mesh>
  </group>;
}

function CableEquipment({ rig, scene }: { rig: AnatomyRig; scene: WorkshopScene }) {
  const cable = useMemo(() => new BufferGeometry(), []);
  const attachment = useRef<Group>(null);
  const asset = scene.equipment!;
  const pushdown = isCablePushdown(scene);
  const bar = useRef<Group>(null);
  useFrame(() => {
    const frame = cableAttachmentFrame(rig, scene);
    cable.setFromPoints([frame.pulley, frame.connection]);
    attachment.current?.position.copy(frame.center);
    attachment.current?.quaternion.copy(frame.rotation);
    if (bar.current) bar.current.scale.x = frame.width;
  });
  useEffect(() => () => cable.dispose(), [cable]);
  return <>
    <group position={[-1.05 + asset.x, 0, 0.3 + asset.z]}>
      <mesh position={[0, 1.35, 0]}><boxGeometry args={[0.18, 2.7, 0.22]} /><meshStandardMaterial color="#516768" metalness={0.45} /></mesh>
      <mesh position={[0, 0.05, 0]}><boxGeometry args={[0.7, 0.1, 0.6]} /><meshStandardMaterial color="#263b3b" /></mesh>
      <mesh position={[0, 0.22 + asset.y, 0.15]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.07, 0.07, 0.06, 20]} /><meshStandardMaterial color="#263b3b" /></mesh>
    </group>
    <lineSegments geometry={cable}><lineBasicMaterial color="#43565a" /></lineSegments>
    <group ref={attachment}>
      {pushdown ? <>
        <group ref={bar}><mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.022, 0.022, 1, 20]} /><meshStandardMaterial color={metal} metalness={0.7} roughness={0.3} />
        </mesh></group>
        <mesh position={[0, 0.035, 0]}><torusGeometry args={[0.03, 0.009, 8, 16]} /><meshStandardMaterial color={metal} metalness={0.7} /></mesh>
      </> : <>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.022, 0.022, 0.2, 16]} /><meshStandardMaterial color="#263b3b" /></mesh>
        {[-0.1, 0.1].map(x => <mesh key={x} position={[x, 0.03, 0]}><cylinderGeometry args={[0.009, 0.009, 0.06, 12]} /><meshStandardMaterial color={metal} metalness={0.7} /></mesh>)}
        <mesh position={[0, 0.06, 0]}><torusGeometry args={[0.1, 0.009, 8, 24, Math.PI]} /><meshStandardMaterial color={metal} metalness={0.7} /></mesh>
      </>}
    </group>
  </>;
}

function Figure({ pose, scene, target, isolate, onLoaded, onHighlight, editor, timeMs, interactive = true, faded = false, onRigReady, onMachineReachChange }: {
  pose: RigPose; scene: WorkshopScene; target: string; isolate: boolean;
  onLoaded: (muscles: MuscleOption[]) => void; onHighlight: (count: number) => void;
  editor?: StudioEditor;
  timeMs: number;
  interactive?: boolean; faded?: boolean; onRigReady?: (rig: AnatomyRig | null) => void;
  onMachineReachChange?: (report: MachineReachReport | undefined) => void;
}) {
  const { scene: source } = useGLTF(anatomyModelUrl);
  const rig = useMemo(() => createAnatomyRig(source), [source]);
  const equipmentGroup = useRef<Group>(null);
  const activeEditor = workshopEditorForInteraction(editor, interactive);
  const lastMachineReport = useRef<string | null>(null);
  const invalidate = useThree(state => state.invalidate);
  const asset = scene.equipment;
  const pushdown = isCablePushdown(scene);
  const attachments = scene.studio?.objects.filter(object => object.cableAttachment !== "cuff").map(object => object.attachment) ?? [];
  const leftGrip = attachments.includes("left") || attachments.includes("both"), rightGrip = attachments.includes("right") || attachments.includes("both");
  const gripping = scene.studio?.objects.some(object => object.machineUse) || leftGrip && rightGrip ? true : leftGrip ? "left" : rightGrip ? "right" : asset?.slug === "single-cable" ? pushdown ? true : "left" : asset?.slug === "dumbbell-pair";
  const forearmRotation = forearmRotationForScene(scene);
  useFrame(() => {
    // Begin each equipment solve from the authored pose, preventing IK drift.
    if (interactive && activeEditor?.dragging && activeEditor.selection?.kind === "joint") return;
    poseAnatomyRig(rig, pose, gripping, forearmRotation);
    plantAnatomyFeet(rig, scene.motionStyle, pose); correctAuthoredArmPath(rig, scene.motionStyle, pose);
    applyStudioSeating(rig, scene.studio, timeMs, pose);
    const report = applyStudioMachine(rig, scene, timeMs);
    if (onMachineReachChange) {
      const signature = JSON.stringify(report) ?? "none";
      if (lastMachineReport.current !== signature) { lastMachineReport.current = signature; onMachineReachChange(report); }
    }
  }, -1);
  useLayoutEffect(() => { poseAnatomyRig(rig, pose, gripping, forearmRotation); plantAnatomyFeet(rig, scene.motionStyle, pose); correctAuthoredArmPath(rig, scene.motionStyle, pose); applyStudioSeating(rig, scene.studio, timeMs, pose); applyStudioMachine(rig, scene, timeMs); invalidate(); }, [rig, pose, gripping, forearmRotation, scene, timeMs, invalidate]);
  useEffect(() => { onLoaded(rig.muscles); return () => rig.dispose(); }, [rig, onLoaded]);
  useEffect(() => { onRigReady?.(rig); return () => onRigReady?.(null); }, [rig, onRigReady]);
  // Camera mode may have no changed mesh props to schedule a demand frame.
  useLayoutEffect(() => { if (editor?.captureElbow) invalidate(); }, [editor?.captureElbow, invalidate]);
  useLayoutEffect(() => {
    if (faded && equipmentGroup.current) return fadeWorkshopEquipment(equipmentGroup.current);
  }, [faded, scene.studio?.objects, scene.equipment, rig]);
  useLayoutEffect(() => {
    onHighlight(highlightAnatomyRig(rig, target, isolate)); invalidate();
  }, [rig, target, isolate, onHighlight, invalidate]);
  return <>
    <StudioBody transform={scene.studio?.body ?? identityTransform} rig={rig} editor={activeEditor}>
      <primitive object={rig.root} dispose={null} />
    </StudioBody>
    <group ref={equipmentGroup}>
    {(!isolate || editor) && scene.studio && <StudioEquipment objects={scene.studio.objects} body={scene.studio.body} rig={rig} pose={pose} timeMs={timeMs} editor={activeEditor} />}
    {scene.motionStyle === "incline-curl" && !isolate && <AdjustableBench />}
    {scene.motionStyle === "seated-curl" && !isolate && <group>
      <mesh position={[0, 0.77, 0.06]} castShadow><boxGeometry args={[0.48, 0.12, 0.5]} /><meshStandardMaterial color="#263b3b" /></mesh>
      {[-0.12, 0.24].map(z => <group key={z} position={[0, 0, z]}>
        <mesh position={[0, 0.36, 0]}><boxGeometry args={[0.1, 0.72, 0.1]} /><meshStandardMaterial color={metal} /></mesh>
        <mesh position={[0, 0.05, 0]}><boxGeometry args={[0.58, 0.1, 0.14]} /><meshStandardMaterial color={metal} /></mesh>
      </group>)}
    </group>}
    {scene.motionStyle === "bench-press" && !isolate && <group>
      <mesh position={[0, 1.16, -0.18]} rotation={[-Math.PI / 4, 0, 0]}><boxGeometry args={[0.48, 1.7, 0.12]} /><meshStandardMaterial color="#263b3b" /></mesh>
      <mesh position={[0, 0.63, 0.4]}><boxGeometry args={[0.48, 0.12, 0.4]} /><meshStandardMaterial color="#263b3b" /></mesh>
      {[-0.65, 0.5].map(z => <group key={z} position={[0, 0, z]}>
        <mesh position={[0, 0.35, 0]}><boxGeometry args={[0.12, 0.7, 0.12]} /><meshStandardMaterial color={metal} /></mesh>
        <mesh position={[0, 0.05, 0]}><boxGeometry args={[0.7, 0.1, 0.16]} /><meshStandardMaterial color={metal} /></mesh>
      </group>)}
    </group>}
    {!isolate && asset?.slug === "dumbbell-pair" && (["left", "right"] as const).map(side => <Fragment key={side}>{createPortal(
      <FadedEquipment faded={faded}><group position={[(side === "left" ? 0.03 : -0.03) + asset.x, -0.15 + asset.y, 0.13 + asset.z]} scale={asset.scale}><Dumbbell /></group></FadedEquipment>, rig.handBones[side],
    )}</Fragment>)}
    {!isolate && asset?.slug === "single-cable" && <CableEquipment rig={rig} scene={scene} />}
    {!isolate && asset?.slug !== "single-cable" && <Equipment scene={scene} />}
    </group>
  </>;
}

class AnatomyBoundary extends Component<{ children: ReactNode; onRetry: () => void; onError?: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError?.(); }
  render() {
    return this.state.failed ? <WorkshopPreviewFallback state="error" onRetry={this.props.onRetry} /> : this.props.children;
  }
}

class PreviewGraphicsGuard extends Component<{ children: ReactNode; onUnsupported: () => void; onRetry: () => void }, { supported: boolean | null }> {
  state: { supported: boolean | null } = { supported: null };
  componentDidMount() {
    let supported = false;
    try {
      const probe = document.createElement("canvas").getContext("webgl2");
      supported = !!probe;
      probe?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch { supported = false; }
    this.setState({ supported });
    if (!supported) this.props.onUnsupported();
  }
  render() {
    return this.state.supported === null ? <WorkshopPreviewFallback state="loading" onRetry={this.props.onRetry} /> : this.state.supported ? this.props.children : <WorkshopPreviewFallback state="unsupported" onRetry={this.props.onRetry} />;
  }
}

function WorkshopCameraDriver({ scene, view, command, getFocus }: { scene: WorkshopScene; view: AnatomyView; command: WorkshopCameraCommand | null; getFocus: () => Vector3 | null }) {
  const camera = useThree(state => state.camera);
  const controls = useThree(state => state.controls) as OrbitControlsInstance | null;
  const { width, height } = useThree(state => state.size);
  const invalidate = useThree(state => state.invalidate);
  const currentScene = useRef(scene), lastCommand = useRef(0);
  useLayoutEffect(() => { currentScene.current = scene; }, [scene]);
  useLayoutEffect(() => {
    if (!controls || !(camera instanceof PerspectiveCamera)) return;
    const fit = fitWorkshopCamera(currentScene.current, view, width / height, camera.fov);
    camera.position.copy(fit.position); controls.target.copy(fit.target); controls.update(); invalidate();
  }, [camera, controls, view, width, height, invalidate]);
  useLayoutEffect(() => {
    if (!controls || !command || lastCommand.current === command.id || !(camera instanceof PerspectiveCamera)) return;
    lastCommand.current = command.id;
    if (command.action === "fit" || command.action === "reset") {
      const fit = fitWorkshopCamera(currentScene.current, command.action === "reset" ? currentScene.current.studio?.presentation?.view ?? currentScene.current.cameraAngle : view, width / height, camera.fov);
      camera.position.copy(fit.position); controls.target.copy(fit.target);
    } else if (command.action === "zoom-in" || command.action === "zoom-out") {
      camera.position.copy(zoomCameraPosition(camera.position, controls.target, command.action === "zoom-in" ? 0.8 : 1.25, controls.minDistance, controls.maxDistance));
    } else if (command.action === "opposite") {
      camera.position.copy(oppositeCameraPosition(camera.position, controls.target));
    } else {
      const focus = getFocus();
      if (focus) {
        const offset = camera.position.clone().sub(controls.target).normalize().multiplyScalar(3);
        controls.target.copy(focus); camera.position.copy(focus).add(offset);
      }
    }
    controls.update(); invalidate();
  }, [camera, command, controls, getFocus, height, invalidate, view, width]);
  return null;
}

type AnatomyView = WorkshopScene["cameraAngle"] | "back";
function CameraView({ view, overhead, bench, contentHeight, scene }: { view: AnatomyView; overhead: boolean; bench: boolean; contentHeight: number; scene: WorkshopScene }) {
  const camera = useThree(state => state.camera);
  const invalidate = useThree(state => state.invalidate);
  const { width, height } = useThree(state => state.size);
  const bounds = useMemo(() => studioCameraPoints(scene.studio?.objects.map(object => resolveStudioObject(scene, object, 0))), [scene]);
  useLayoutEffect(() => {
    const position: [number, number, number] = bench && view === "three_quarter" ? [4, 3.6, 4] : view === "front" ? [0, 1.65, 5.3]
      : view === "back" ? [0, 1.65, -5.3] : view === "side" ? [5.3, 1.65, 0] : [3.2, 1.85, 5.1];
    // Leave room for raised arms on narrow screens as well as the resting body.
    const fit = Math.max(overhead ? 1.23 : 1, 1.05 / (width / height), contentHeight / 2.75);
    const targetHeight = Math.max(1.38, contentHeight / 2);
    const target = new Vector3(0, targetHeight, 0), offset = new Vector3(position[0], position[1] - 1.38, position[2]).multiplyScalar(fit);
    const distance = camera instanceof PerspectiveCamera ? cameraDistanceForPoints(bounds, target, offset, camera.fov, width / height) : offset.length();
    camera.position.copy(target).add(offset.normalize().multiplyScalar(distance));
    camera.lookAt(0, targetHeight, 0); invalidate();
  }, [view, camera, invalidate, width, height, overhead, bench, contentHeight, bounds]);
  return null;
}

export function MotionCanvas({ scene, timeMs, className = "h-[430px]", showMuscleControls = true, editor, simplifiedControls = false, interactionMode, onInteractionModeChange, onMachineReachChange }: {
  scene: WorkshopScene; timeMs: number; className?: string; showMuscleControls?: boolean;
  editor?: StudioEditor;
  simplifiedControls?: boolean; interactionMode?: WorkshopInteractionMode;
  onInteractionModeChange?: (mode: WorkshopInteractionMode) => void;
  onMachineReachChange?: (report: MachineReachReport | undefined) => void;
}) {
  const { language, t } = useWorkshopLanguage();
  const wrapper = useRef<HTMLDivElement>(null), rigRef = useRef<AnatomyRig | null>(null);
  const [localMode, setLocalMode] = useState<WorkshopInteractionMode>("camera");
  const mode = interactionMode ?? (simplifiedControls ? localMode : "edit");
  const [command, setCommand] = useState<WorkshopCameraCommand | null>(null);
  const [faded, setFaded] = useState(false), [fullscreen, setFullscreen] = useState(false);
  const [failure, setFailure] = useState<"error" | "unsupported" | null>(null);
  const [previewMessage, setPreviewMessage] = useState("");
  const onRigReady = useCallback((rig: AnatomyRig | null) => { rigRef.current = rig; }, []);
  const onUnsupported = useCallback(() => setFailure("unsupported"), []);
  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === wrapper.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  const [muscles, setMuscles] = useState<MuscleOption[]>([]);
  const elbowMotion = scene.keyframes.some(frame => (frame.poses["left-elbow"]?.x ?? 0) >= 70)
    && scene.keyframes.every(frame => Math.abs(frame.poses["left-shoulder"]?.z ?? 0) < 30);
  const styleTargets: Record<string, string> = { squat: "group:quadriceps", "split-squat": "group:quadriceps", hinge: "group:hamstrings", row: "group:lats", "bench-press": "group:chest" };
  const initialTarget = styleTargets[scene.motionStyle ?? ""] ?? (elbowMotion ? scene.equipment?.slug === "single-cable" ? "group:triceps" : "group:biceps" : "group:deltoid");
  const [targetChoice, setTarget] = useState<string | null>(null);
  const target = (editor ? null : targetChoice) ?? scene.studio?.presentation?.highlight ?? initialTarget;
  const overhead = scene.equipment?.slug === "single-cable" || scene.studio?.objects.some(object => object.slug === "cable-machine") || scene.keyframes.some(frame => Math.abs(frame.poses["left-shoulder"]?.z ?? 0) > 120
    || (Math.abs(frame.poses["left-shoulder"]?.x ?? 0) >= 60 && Math.abs(frame.poses["left-shoulder"]?.z ?? 0) >= 60));
  const [isolateChoice, setIsolate] = useState<boolean | null>(null);
  const isolate = (editor ? null : isolateChoice) ?? scene.studio?.presentation?.isolate ?? false;
  const [count, setCount] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [viewChoice, setViewChoice] = useState<{ sceneAngle: WorkshopScene["cameraAngle"]; view: AnatomyView } | null>(null);
  const view = workshopCameraView(scene, !!editor, viewChoice);
  const selection = editor?.selection;
  const selectionLabel = selection?.kind === "object" ? scene.studio?.objects.find(object => object.id === selection.id)?.name ?? "equipment" : selection?.kind === "joint" ? selection.slug.replaceAll("-", " ").replace(/^./, letter => letter.toUpperCase()) : selection?.kind === "body" ? "body" : null;
  const getFocus = useCallback(() => {
    if (!selection) return null;
    if (selection.kind === "joint") return rigRef.current?.bones[selection.slug].getWorldPosition(new Vector3()) ?? null;
    if (selection.kind === "object") {
      const object = scene.studio?.objects.find(object => object.id === selection.id);
      if (!object) return null;
      const resolved = resolveStudioObject(scene, object, timeMs);
      return new Vector3(resolved.x, resolved.y + resolved.scale * 0.85, resolved.z);
    }
    const body = scene.studio?.body ?? identityTransform;
    return new Vector3(body.x, body.y + body.scale * 1.4, body.z);
  }, [selection, scene, timeMs]);
  const changeView = (angle: AnatomyView) => {
    setViewChoice({ sceneAngle: scene.cameraAngle, view: angle });
    editor?.onPresentationChange?.({ highlight: target, isolate, view: angle });
  };
  const cameraAction = (action: WorkshopCameraAction) => {
    if (action === "reset") setViewChoice({ sceneAngle: scene.cameraAngle, view: scene.studio?.presentation?.view ?? scene.cameraAngle });
    setCommand(value => ({ id: (value?.id ?? 0) + 1, action }));
    setPreviewMessage(action === "focus" ? `Camera focused on ${selectionLabel}.` : action === "opposite" ? "Camera moved to the opposite side." : action === "fit" ? "Camera fitted to the whole scene." : action === "reset" ? "Camera view reset." : action === "zoom-in" ? "Camera zoomed in." : "Camera zoomed out.");
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === wrapper.current) await document.exitFullscreen();
      else if (wrapper.current?.requestFullscreen) await wrapper.current.requestFullscreen();
      else setPreviewMessage("Full screen is unavailable in this browser. Use browser zoom to enlarge the preview.");
    } catch { setPreviewMessage("Full screen could not open. Use browser zoom to enlarge the preview."); }
  };
  const changeTarget = (highlight: string) => {
    if (!editor) setTarget(highlight);
    editor?.onPresentationChange?.({ highlight, isolate, view });
  };
  const changeIsolate = (value: boolean) => {
    if (!editor) setIsolate(value);
    editor?.onPresentationChange?.({ highlight: target, isolate: value, view });
  };
  // Stable camera props keep playback renders from reapplying initial placement
  // after Opposite side, focus or zoom commands have moved the live camera.
  const camera = useMemo(() => ({ position: scene.cameraAngle === "front" ? [0, 1.65, 5.3] as [number, number, number]
    : scene.cameraAngle === "side" ? [5.3, 1.65, 0] as [number, number, number] : [3.2, 1.85, 5.1] as [number, number, number], fov: 34 }), [scene.cameraAngle]);
  const pose = useMemo(() => constrainFrontalPose(sampleWorkshopPose(scene.keyframes, timeMs), scene.studio?.frontalPlane), [scene.keyframes, timeMs, scene.studio?.frontalPlane]);
  const retryPreview = () => { useGLTF.clear(anatomyModelUrl); setMuscles([]); setFailure(null); setAttempt(value => value + 1); };
  const selectedHighlight = muscleGroups.find(item => `group:${item.id}` === target)?.label ?? muscles.find(item => item.id === target)?.label ?? target;
  const equipmentNames = scene.studio?.objects.map(object => object.name).join(", ") || scene.equipment?.slug.replaceAll("-", " ") || "No equipment";
  return translateWorkshopTree(<div ref={wrapper} className={`min-w-0 ${fullscreen ? "h-full overflow-y-auto bg-background p-4" : ""}`} data-anatomy-state={failure ?? (muscles.length ? "ready" : "loading")} data-highlight-count={count} data-isolated={isolate}>
    <div className={`relative overflow-hidden rounded-2xl bg-muted ${fullscreen ? "h-[60vh] min-h-52" : className}`} aria-label="3D exercise preview" aria-busy={!failure && !muscles.length}>
      <AnatomyBoundary key={attempt} onRetry={retryPreview} onError={() => setFailure("error")}>
        <PreviewGraphicsGuard onUnsupported={onUnsupported} onRetry={retryPreview}>
        <Canvas camera={camera} frameloop="demand" dpr={[1, 1.75]} fallback={<span aria-hidden="true" />}>
          <color attach="background" args={["#f7f8f8"]} />
          <hemisphereLight args={["#ffffff", "#85989b", 0.95]} />
          <directionalLight position={[-3, 5, 6]} color="#fff4e7" intensity={2.4} />
          <directionalLight position={[4, 3, -4]} color="#dce9f8" intensity={1.1} />
          {editor && <gridHelper args={[20, 100, "#adbfc0", "#dce5e5"]} />}
          <Suspense fallback={null}><Figure pose={pose} scene={scene} target={target} isolate={isolate} onLoaded={setMuscles} onHighlight={setCount} editor={editor} timeMs={timeMs} interactive={mode === "edit"} faded={faded} onRigReady={onRigReady} onMachineReachChange={onMachineReachChange} /></Suspense>
          <OrbitControls makeDefault enabled={!editor?.dragging && (!simplifiedControls || mode === "camera")} rotateSpeed={editor?.sensitivity ?? 1} panSpeed={editor?.sensitivity ?? 1} zoomSpeed={editor?.sensitivity ?? 1} target={[0, 1.38, 0]} enablePan={!!editor} minDistance={simplifiedControls ? 1 : 2.5} maxDistance={simplifiedControls ? 100 : editor ? 25 : 12} />
          {simplifiedControls ? <WorkshopCameraDriver scene={scene} view={view} command={command} getFocus={getFocus} /> : <CameraView view={view} overhead={overhead} bench={scene.motionStyle === "bench-press"} scene={scene} contentHeight={Math.max(2.75 * (scene.studio?.body.scale ?? 1) + (scene.studio?.body.y ?? 0), ...(scene.studio?.objects.filter(object => object.slug === "cable-machine").map(object => object.y + (maxPulleyHeight + 0.15) * object.scale) ?? []))} />}
        </Canvas>
        </PreviewGraphicsGuard>
        {(!failure && (editor || simplifiedControls) && !muscles.length) && <div className="absolute inset-0 bg-muted/90"><WorkshopPreviewFallback state="loading" onRetry={retryPreview} /></div>}
      </AnatomyBoundary>
      {showMuscleControls
        ? <div className="absolute bottom-2 right-2 rounded bg-card/90 px-2 py-1 text-[9px] text-muted-foreground">Z-Anatomy · BodyParts3D · CC BY-SA</div>
        : <div className="absolute inset-x-2 bottom-2 rounded bg-card/90 px-2 py-1 text-[8px] leading-tight text-muted-foreground">
          Z-Anatomy — Gauthier Kervyn &amp; contributors · github.com/Z-Anatomy/Models-of-human-anatomy<br />
          BodyParts3D © The Database Center for Life Science · Adapted geometry, materials and posing<br />
          creativecommons.org/licenses/by-sa/4.0/ · creativecommons.org/licenses/by-sa/2.1/jp/
        </div>}
    </div>
    {simplifiedControls && <>
      <WorkshopCameraControls view={view} mode={mode} editable={!!editor} ready={!!muscles.length && !failure} selectionLabel={selectionLabel} faded={faded} fullscreen={fullscreen} onViewChange={changeView} onModeChange={value => { setLocalMode(value); onInteractionModeChange?.(value); }} onAction={cameraAction} onFadeChange={setFaded} onFullscreen={toggleFullscreen} />
      <p role="status" className="mt-2 text-sm">{previewMessage}</p>
      <details className="mt-3 text-base" open={!!failure}><summary className="min-h-11 cursor-pointer py-2">Text scene summary</summary><div className="space-y-2 py-2 text-sm">
        <p><span data-workshop-translate="false">{scene.studio?.objects.length ? equipmentNames : t(equipmentNames)}</span>. {t("{count} poses over {duration} seconds. Current preview time: {time} seconds.", { count: scene.keyframes.length, duration: scene.durationMs / 1000, time: Math.round(timeMs / 100) / 10 })}</p>
        <p>{selectionLabel ? <>{t("Selected:")} <span data-workshop-translate="false">{selection?.kind === "object" ? selectionLabel : t(selectionLabel)}</span>.</> : t("Nothing selected.")} {target === "none" ? t("No muscle highlight.") : <>{t("Muscle highlight:")} {t(selectedHighlight)}.</>} {t(isolate ? "Only selected anatomy is shown." : "Whole body is shown.")}</p>
        <p>{t(scene.studio?.seating ? "Body support is attached to a bench." : "No bench support is attached.")} {scene.studio?.objects.some(object => object.attachment !== "none" || object.machineUse) ? scene.studio.objects.filter(object => object.attachment !== "none" || object.machineUse).map(object => <span key={object.id}><span data-workshop-translate="false">{object.name}</span>: {t(object.machineUse ? "machine contact engaged" : object.attachment === "both" ? "both hands attached" : "{side} hand attachment", { side: object.attachment })}. </span>) : t("No equipment contact is engaged.")}</p>
        <p>Use Opposite side and fading to inspect hands, feet and supports at the start and finish.</p>
      </div></details>
    </>}
    {showMuscleControls && <>
      {!simplifiedControls && <div className="mt-3 flex flex-wrap gap-2" aria-label="Model view">{([
        ["front", "Front"], ["three_quarter", "Three-quarter"], ["side", "Side"], ["back", "Back"],
      ] as const).map(([angle, label]) => <button key={angle} type="button" aria-pressed={view === angle}
        onClick={() => changeView(angle)}
        className={`rounded-lg border px-3 py-1.5 text-xs ${view === angle ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>{label}</button>)}</div>}
      {editor ? <details className={`mt-3 ${simplifiedControls ? "text-base" : "max-h-40 overflow-y-auto text-xs"}`}><summary className={`cursor-pointer text-muted-foreground ${simplifiedControls ? "min-h-11 py-2" : ""}`}>Muscle highlights and credits</summary><AnatomyControls muscles={muscles} target={target} isolate={isolate} count={count} onTargetChange={changeTarget} onIsolateChange={changeIsolate} unavailable={!!failure} />
        <p className="mt-3 text-[10px] text-muted-foreground">Z-Anatomy · BodyParts3D · <a href="/models/z-anatomy/ATTRIBUTION.md" className="underline">Credits and licenses</a></p></details>
        : <><AnatomyControls muscles={muscles} target={target} isolate={isolate} count={count} onTargetChange={changeTarget} onIsolateChange={changeIsolate} unavailable={!!failure} />
      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
        <a href="https://github.com/Z-Anatomy/Models-of-human-anatomy" className="underline">Z-Anatomy</a> by Gauthier Kervyn and contributors · <a href="https://creativecommons.org/licenses/by-sa/4.0/" className="underline">CC BY-SA 4.0</a>. BodyParts3D © The Database Center for Life Science · <a href="https://creativecommons.org/licenses/by-sa/2.1/jp/" className="underline">CC BY-SA 2.1 Japan</a>. Adapted geometry, materials and posing. <a href="/models/z-anatomy/ATTRIBUTION.md" className="underline">Credits</a> · <a href={anatomyModelUrl} download className="underline">Model</a>
      </p></>}
    </>}
  </div>, language);
}
