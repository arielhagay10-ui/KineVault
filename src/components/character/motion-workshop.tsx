"use client";
import Link from "next/link";
import { createWorkshopLanguage } from "@/lib/motion/workshop-language";
import { WorkshopCommitMetrics } from "./workshop-commit-metrics";
import { WorkshopPlaybackControls } from "./workshop-playback-controls";
import { useWorkshopHistory } from "./use-workshop-history";
import { useMotionPlayback } from "./use-motion-playback";
import { WorkshopFullscreenButton } from "./workshop-fullscreen-button";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Box, Check, ChevronDown, Hand, Move3D, Plus, Redo2, Rotate3D, Save, Trash2, Undo2, UserRound } from "@/components/ui/icons";
import { identityTransform, jointControlRange, jointControlValue, jointSlugs, sampleWorkshopPose, type BenchFacing, type JointAngles, type JointSlug, type SceneTransform, type StudioObject, type WorkshopScene } from "@/lib/motion/workshop";
import { clamp, heldEquipmentTransform, makeLegacyBarbellEditable, maxPulleyHeight, setStudioObjectAnimated, studioAttachmentSlots, updateStudioObjectTransform } from "@/lib/motion/studio";
import { addWorkshopEquipment, cableTowerPlacement, createFreeCableSetup, editWorkshopMoment, freeWorkshopBody } from "@/lib/motion/workshop-freedom";
import { resetWorkshopJoints } from "@/lib/motion/workshop-pose";
import { isStudioMachine, machineContactDescriptions, machineTravelLabels, rowHandleHeight, setMachineHandleHeight, setMachinePosition, setPecDeckMode, type MachineReachReport } from "@/lib/motion/studio-machines";
import { deleteWorkshopFrame, retimeWorkshopFrame } from "@/lib/motion/timeline";
import { automaticWristAngles } from "@/lib/motion/equipment-motion";
import { constrainFrontalPose, resolveStudioObject, setCableAttachment, setFrontalPlane } from "@/lib/motion/studio-constraints";
import { MotionCanvas } from "./motion-canvas";
import { moveMachineWithMouse, type StudioDragPlane } from "@/lib/motion/workshop-mouse";
import { AnnotationFields } from "./annotation-fields";
import type { StudioEditor, StudioSelection } from "./studio-controls";
import { WorkshopEquipmentPicker } from "./workshop-equipment-picker";
import { WorkshopNumberField } from "./workshop-number-field";
import { WorkshopQuickCreate } from "./workshop-quick-create";
import { useWorkshopDraft } from "./use-workshop-draft";
import { WorkshopJointPicker } from "./workshop-joint-picker";
import { WorkshopGripControls } from "./workshop-grip-controls";
import { WorkshopLanguageProvider, useWorkshopLanguage } from "./workshop-language";
import { copyWorkshopPose, createQuickScene, mirrorWorkshopPose, matchWorkshopLoop, workshopDemonstrationCaption } from "@/lib/motion/quick-create";
import { isWorkshopPlacementLocked } from "@/lib/motion/workshop-placement";
import { limbPoseBlock, poseLimbs } from "@/lib/motion/limb-pose";
import { workshopShortcut } from "@/lib/motion/workshop-shortcuts";
import { WorkshopShortcutGuide } from "./workshop-shortcut-guide";
import { describeWorkshopChange, workshopMomentName } from "@/lib/motion/workshop-history";
import { WorkshopSetups } from "./workshop-setups";
import { WorkshopComparison } from "./workshop-comparison";
import { WorkshopGuidance, WorkshopGuidanceProvider } from "./workshop-guidance";
import { WorkshopTutorial } from "./workshop-tutorial";
import { useWorkshopTutorial } from "./use-workshop-tutorial";
import { workshopTutorialSteps } from "@/lib/motion/workshop-tutorial";
import { WorkshopBenchControls } from "./workshop-bench-controls";
import { WorkshopToolNavigation, WorkshopToolPanel, type WorkshopTool } from "./workshop-tool-navigation";
import { WorkshopCableControls } from "./workshop-cable-controls";
import { WorkshopDisclosure } from "./workshop-disclosure";
import { WorkshopPoseFeedback, type WorkshopPoseFeedbackKind } from "./workshop-pose-feedback";

const jointNames: Record<JointSlug, string> = {
  torso: "Torso", "left-shoulder": "Left shoulder", "right-shoulder": "Right shoulder",
  "left-elbow": "Left elbow", "right-elbow": "Right elbow", "left-hip": "Left hip",
  "right-hip": "Right hip", "left-knee": "Left knee", "right-knee": "Right knee",
  "left-wrist": "Left wrist", "right-wrist": "Right wrist",
  "left-ankle": "Left ankle", "right-ankle": "Right ankle",
};
const label = (milliseconds: number) => `${(milliseconds / 1000).toFixed(2)}s`;
const inputClass = "mt-1 min-h-11 w-full min-w-0 rounded-lg border border-border bg-background p-2 text-base font-normal";
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-base font-semibold disabled:opacity-40";

function TransformFields({ value, onChange, positionOnly = false, disabled = false }: { value: SceneTransform; onChange: (value: SceneTransform) => void; positionOnly?: boolean; disabled?: boolean }) {
  const { t } = useWorkshopLanguage();
  return <div className="space-y-4">
    {(positionOnly ? ["Position"] as const : ["Rotation"] as const).map(kind => <fieldset key={kind}>
      <legend className="text-xs font-semibold text-muted-foreground">{t(kind)}{kind === "Rotation" ? t(" · degrees") : t(" · meters")}</legend>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">{(["x", "y", "z"] as const).map(axis => {
        const field = kind === "Position" ? axis : `rotation${axis.toUpperCase()}` as "rotationX" | "rotationY" | "rotationZ";
        const min = kind === "Rotation" ? -180 : axis === "y" ? -3 : -10, max = kind === "Rotation" ? 180 : 10;
        return <WorkshopNumberField key={axis} label={t(`${kind} ${axis.toUpperCase()} ${kind === "Position" ? "meters" : "degrees"}`)} value={kind === "Position" ? Number(value[field].toFixed(3)) : value[field]} min={min} max={max} step={kind === "Position" ? 0.1 : 1} disabled={disabled} onChange={next => onChange({ ...value, [field]: next })} />;
      })}</div>
    </fieldset>)}
    {!positionOnly && <WorkshopNumberField label={t("Scale")} min={0.5} max={2} step={0.1} value={value.scale} disabled={disabled} onChange={scale => onChange({ ...value, scale })} />}
  </div>;
}

function InspectorSection({ title, children, visible }: { title: string; children: ReactNode; visible: boolean }) {
  const { t } = useWorkshopLanguage();
  return <section hidden={!visible} className="space-y-3"><h3 className="font-semibold">{t(title)}</h3>{children}</section>;
}

export function MotionWorkshop({ privateId, initialScene, equipmentOptions, jointActions, ownerId = "local", initialName = "", tutorialEligible = false }: {
  privateId: string | null; initialScene: WorkshopScene;
  ownerId?: string; initialName?: string;
  tutorialEligible?: boolean;
  equipmentOptions: { slug: string; label: string; active: boolean }[];
  jointActions: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const tutorial = useWorkshopTutorial(ownerId, tutorialEligible);
  const tutorialButton = useRef<HTMLButtonElement>(null);
  const workshopRoot = useRef<HTMLDivElement>(null);
  const [startingScene] = useState(() => makeLegacyBarbellEditable(initialScene, crypto.randomUUID()));
  const [scene, setScene] = useState(startingScene);
  const [name, setName] = useState(initialName);
  const [mode, setMode] = useState<"quick" | "advanced">("quick");
  const [panel, setPanel] = useState<WorkshopTool>("equipment");
  const [viewControlsTarget, setViewControlsTarget] = useState<HTMLDivElement | null>(null);
  const [step, setStep] = useState(privateId ? 1 : 0);
  const [exampleMachineId, setExampleMachineId] = useState<string | null>(null);
  const [language, setLanguage] = useState<"en" | "he">("en");
  const { t } = useMemo(() => createWorkshopLanguage(language), [language]);
  const [interactionMode, setInteractionMode] = useState<"camera" | "edit">("camera");
  const [previewOpen, setPreviewOpen] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [comparison, setComparison] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);
  const [speed, setSpeed] = useState(1);
  const [poseScope, setPoseScope] = useState<"selected" | "all">("selected");
  const [copyTarget, setCopyTarget] = useState(0);
  const addButton = useRef<HTMLButtonElement>(null);
  const shortcutHelp = useRef<HTMLDetailsElement>(null);
  const historyHelp = useRef<HTMLDetailsElement>(null);
  const moreHelp = useRef<HTMLDetailsElement>(null);
  const closeMenus = () => {
    if (historyHelp.current) historyHelp.current.open = false;
    if (shortcutHelp.current) shortcutHelp.current.open = false;
    if (moreHelp.current) moreHelp.current.open = false;
  };
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      for (const menu of [historyHelp.current, moreHelp.current]) {
        if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
      }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  const [selectedFrame, setSelectedFrame] = useState(0);
  const [selection, setSelection] = useState<StudioSelection>({ kind: "body" });
  const [tool, setTool] = useState<StudioEditor["tool"]>("select");
  const [adding, setAdding] = useState(false);
  const [equipmentPickerView, setEquipmentPickerView] = useState<"popular" | "all">("popular");
  const [posing, setPosing] = useState(false);
  const [limbPosing, setLimbPosing] = useState(false);
  const [limbWarning, setLimbWarning] = useState<WorkshopPoseFeedbackKind | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [gripReach, setGripReach] = useState<Record<string, boolean>>({});
  const [machineReach, setMachineReach] = useState<MachineReachReport>();
  const onMachineReach = useCallback((report: MachineReachReport | undefined) => setMachineReach(report), []);
  const [captureElbow, setCaptureElbow] = useState<StudioEditor["captureElbow"]>(null);
  const [snap, setSnap] = useState(false);
  const [sensitivity, setSensitivity] = useState(0.35);
  const { clock: playback, timeMs, playing, setTimeMs, setPlaying } = useMotionPlayback(scene.durationMs, speed);
  const [dragging, setDragging] = useState(false);
  const [dragPlane, setDragPlane] = useState<StudioDragPlane>("view");
  const dragSession = useRef<{ scene: WorkshopScene; latest: WorkshopScene; timeMs: number } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [frameError, setFrameError] = useState<string | null>(null);
  const history = useWorkshopHistory();
  const { past, future, record } = history;
  const draft = useWorkshopDraft({ ownerId, privateId, initialScene: startingScene, initialName, scene, name, paused: dragging || adjusting || !!captureElbow });
  const savedId = draft.savedId;
  const pending = draft.saving;
  const studio = scene.studio ?? { body: identityTransform, objects: [] };
  const current = scene.keyframes[Math.min(selectedFrame, scene.keyframes.length - 1)];
  const rawObject = selection?.kind === "object" ? studio.objects.find(item => item.id === selection.id) : undefined;
  const object = useMemo(() => rawObject ? resolveStudioObject(scene, rawObject, current.timeMs) : undefined, [scene, rawObject, current.timeMs]);
  const selectedJoint = selection?.kind === "joint" ? selection.slug : null;
  const activeMachine = studio.objects.find(item => item.machineUse);
  const placementLockedIds = studio.objects.filter(isWorkshopPlacementLocked).map(item => item.id);
  const placementLocked = !!object && placementLockedIds.includes(object.id);
  const [placementOverlaps, setPlacementOverlaps] = useState<Record<string, boolean>>({});
  const onPlacementOverlap = useCallback((id: string, overlap: boolean) => setPlacementOverlaps(previous => previous[id] === overlap ? previous : { ...previous, [id]: overlap }), []);
  const bodyLocked = !object && !selectedJoint && !!activeMachine;
  const weightForJoint = (slug: JointSlug) => studio.objects.find(item => item.machineUse && !(item.slug === "cable-row-machine" && item.cableAttachment && slug.endsWith("wrist")) || ["barbell", "dumbbell", "kettlebell"].includes(item.slug)
    && (slug.endsWith("shoulder") || slug.endsWith("elbow")) && (item.attachment === (slug.startsWith("left") ? "left" : "right") || item.attachment === "both"));
  const controllingWeight = selectedJoint ? weightForJoint(selectedJoint) : undefined;
  const blockedJoints = jointSlugs.filter(slug => Boolean(weightForJoint(slug)));
  const blockedLimbs = poseLimbs.filter(limb => limbPoseBlock(scene, limb));
  const limbBlockReasons = [...new Set(blockedLimbs.map(limb => limbPoseBlock(scene, limb)))];
  const isWrist = selectedJoint?.endsWith("wrist") ?? false;
  const isKnee = selectedJoint?.endsWith("knee") ?? false;
  const isAnkle = selectedJoint?.endsWith("ankle") ?? false;
  const frontalShoulder = !!studio.frontalPlane && !!selectedJoint?.endsWith("shoulder");
  const jointAngles = selectedJoint ? constrainFrontalPose(current.poses, studio.frontalPlane)[selectedJoint] ?? (isWrist ? automaticWristAngles(scene, selectedJoint.startsWith("left") ? "left" : "right") : { x: 0, y: 0, z: 0 }) : { x: 0, y: 0, z: 0 };

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const stored = localStorage.getItem("kinevault.workshop.sensitivity");
        const value = Number(stored);
        if (stored && Number.isFinite(value)) setSensitivity(clamp(value, 0.1, 1));
      } catch { /* Storage can be unavailable in a private browser. */ }
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const changeSensitivity = (value: number) => {
    setSensitivity(value);
    try { localStorage.setItem("kinevault.workshop.sensitivity", String(value)); } catch { /* The slider still works. */ }
  };

  const update = (next: WorkshopScene, historyLabel?: string) => {
    if (JSON.stringify(next) === JSON.stringify(scene)) return;
    if (dragSession.current) dragSession.current.latest = next;
    else record({ scene, label: historyLabel ?? describeWorkshopChange(scene, next) });
    setScene(next); setStatus("Unsaved changes");
  };
  const beginDrag = (blocking = true) => {
    if (dragSession.current) return;
    dragSession.current = { scene, latest: scene, timeMs: Math.round(timeMs) };
    if (blocking) setDragging(true);
    else setAdjusting(true);
  };
  const endDrag = useCallback((cancelled = false) => {
    const session = dragSession.current;
    if (session) {
      if (cancelled) { setScene(session.scene); setLimbWarning(null); }
      else if (JSON.stringify(session.latest) !== JSON.stringify(session.scene)) {
        record({ scene: session.scene, label: describeWorkshopChange(session.scene, session.latest) });
      }
    }
    dragSession.current = null; setDragging(false); setAdjusting(false);
  }, [record]);
  useEffect(() => {
    if (!adjusting) return;
    const finish = () => endDrag();
    const cancel = () => endDrag(true);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", finish);
    return () => { window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", cancel); window.removeEventListener("blur", finish); };
  }, [adjusting, endDrag]);
  const enableMouseMovement = (at?: number) => {
    setPlaying(false); setInteractionMode("edit"); setTool("select"); setPosing(false); setLimbPosing(false);
    if (at !== undefined) {
      const index = scene.keyframes.findIndex(frame => frame.timeMs === at);
      if (index >= 0) setSelectedFrame(index);
      setTimeMs(at);
    }
    if (activeMachine) {
      setSelection({ kind: "object", id: activeMachine.id });
      if (mode === "quick") setTimeMs(at ?? (timeMs > scene.durationMs / 4 && timeMs < scene.durationMs * 3 / 4 ? scene.durationMs / 2 : 0));
    }
  };
  const enableLimbPosing = () => {
    setPlaying(false); setInteractionMode("edit"); setTool("select"); setPosing(false);
    setSelection({ kind: "body" }); setLimbPosing(!limbPosing); setLimbWarning(null);
    const index = scene.keyframes.findIndex(frame => frame.timeMs === Math.round(timeMs));
    if (index >= 0) setSelectedFrame(index);
  };
  const restore = (next: WorkshopScene) => {
    const frameIndex = Math.min(selectedFrame, next.keyframes.length - 1);
    setScene(next); setSelectedFrame(frameIndex); setTimeMs(next.keyframes[frameIndex].timeMs); setPlaying(false); setFrameError(null); setStatus("Unsaved changes");
  };
  const undo = () => { if (!past.length || dragging || adjusting) return; const entry = history.undo(scene)!; restore(entry.scene); setStatus(`Undid ${entry.label}`); };
  const redo = () => { if (!future.length || dragging || adjusting) return; const entry = history.redo(scene)!; restore(entry.scene); setStatus(`Redid ${entry.label}`); };
  const selectFrame = (index: number) => { setPlaying(false); setSelectedFrame(index); setTimeMs(scene.keyframes[index].timeMs); setFrameError(null); };
  const previewTime = (time: number) => {
    setPlaying(false); setTimeMs(time);
    const index = scene.keyframes.findIndex(frame => frame.timeMs === Math.round(time));
    if (index >= 0) setSelectedFrame(index);
  };
  const poseMoment = (time: number) => {
    try {
      const moment = editWorkshopMoment(scene, Math.round(time));
      update(moment.scene); setSelectedFrame(moment.index); setPlaying(false); setTimeMs(Math.round(time));
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to edit this moment."); return; }
    setPoseScope("selected"); setInteractionMode("edit"); setTool("select"); setPosing(false);
    setSelection({ kind: "body" }); setLimbPosing(true); setLimbWarning(null);
  };
  const selectObject = (next: StudioSelection) => {
    setLimbPosing(false);
    setSelection(next); setPlaying(false); setTimeMs(current.timeMs);
    setTool(next?.kind === "joint" ? "rotate" : "select");
    if (next?.kind === "joint") { setPosing(true); setPanel("pose"); }
    else if (next?.kind === "object" && ["equipment", "pose"].includes(panel)) {
      const item = studio.objects.find(item => item.id === next.id);
      setPanel(item && ["bench", "barbell", "dumbbell", "kettlebell", "cable-machine"].includes(item.slug) || item && isStudioMachine(item.slug) ? "contact" : "placement");
    }
  };
  const activateObject = (next: StudioSelection) => {
    if (dragging || captureElbow) return;
    selectObject(next);
    setMode("advanced");
    const item = next?.kind === "object" ? studio.objects.find(item => item.id === next.id) : undefined;
    setPanel(item && (["bench", "barbell", "dumbbell", "kettlebell", "cable-machine"].includes(item.slug) || isStudioMachine(item.slug)) ? "contact" : "placement");
    workshopRoot.current?.focus({ preventScroll: true });
  };
  const setPose = (slug: JointSlug, angles: JointAngles) => {
    if (weightForJoint(slug)) return;
    setPlaying(false); setTimeMs(current.timeMs);
    const wristDefault = slug.endsWith("wrist") ? automaticWristAngles(scene, slug.startsWith("left") ? "left" : "right") : undefined;
    update({ ...scene, motionStyle: "free", studio, keyframes: scene.keyframes.map((frame, index) => {
      if (index === selectedFrame || poseScope === "all") return { ...frame, poses: constrainFrontalPose({ ...frame.poses, [slug]: angles }, studio.frontalPlane) };
      return wristDefault && !frame.poses[slug] ? { ...frame, poses: { ...frame.poses, [slug]: wristDefault } } : frame;
    }) });
  };
  const updateObject = (id: string, changes: Partial<StudioObject>) => update({ ...scene, studio: { ...studio, objects: studio.objects.map(item => item.id === id ? { ...item, ...changes } : item) } });
  const resetJoints = () => {
    setPlaying(false); setTimeMs(current.timeMs); setLimbWarning(null);
    update(resetWorkshopJoints(scene, selectedFrame, poseScope, blockedJoints), "Reset all joints");
  };
  const leaveEquipment = () => {
    if (activeMachine?.slug === "cable-row-machine") {
      freeBody(); selectObject({ kind: "body" }); setPosing(false); setCaptureElbow(null); return;
    }
    update({ ...scene, motionStyle: "free", studio: { ...studio, seating: undefined,
      objects: studio.objects.map(item => item.machineUse ? { ...item, machineUse: false } : item) } });
    selectObject({ kind: "body" }); setPosing(false); setCaptureElbow(null);
  };
  const transformObject = (id: string, transform: SceneTransform) => {
    if (placementLockedIds.includes(id)) return;
    update({ ...scene, studio: { ...studio, objects: studio.objects.map(item => item.id === id ? { ...updateStudioObjectTransform(item, transform, current.timeMs, Boolean(item.frames?.length)), shoulderAlignment: undefined } : item) } });
  };
  const holdObject = (attachment: StudioObject["attachment"]) => {
    if (!object) return;
    const hands = studioAttachmentSlots({ ...object, attachment });
    update({ ...scene, equipment: attachment === "none" ? scene.equipment : null, studio: { ...studio, objects: studio.objects.map(item => {
      if (item.id === object.id) {
        const placed = ["cable-machine", "cable-row-machine"].includes(item.slug) || attachment === "none" ? item : updateStudioObjectTransform(item, heldEquipmentTransform(studio.body, object, attachment), current.timeMs, Boolean(item.frames?.length));
        return { ...placed, cableAttachment: item.slug === "cable-row-machine" ? item.cableAttachment ?? "straight-bar" : item.cableAttachment, attachment, elbowLocks: undefined };
      }
      if (attachment !== "none" && item.machineUse) return { ...item, machineUse: false };
      return studioAttachmentSlots(item).some(hand => hands.includes(hand)) && attachment !== "none" ? { ...item, attachment: "none", elbowLocks: undefined } : item;
    }) } });
    setPlaying(false); setTimeMs(current.timeMs);
  };
  const updateCableContact = (changes: StudioObject) => {
    const slots = studioAttachmentSlots(changes);
    update({ ...scene, studio: { ...studio, objects: studio.objects.map(item => item.id === changes.id ? changes
      : studioAttachmentSlots(item).some(slot => slots.includes(slot)) ? { ...item, attachment: "none", elbowLocks: undefined } : item) } });
    setPlaying(false); setTimeMs(current.timeMs);
  };
  const cableControls = object && ["cable-machine", "cable-row-machine"].includes(object.slug) && <WorkshopCableControls object={object}
    onAttachment={attachment => updateCableContact(setCableAttachment(rawObject!.slug === "cable-row-machine" && !rawObject!.cableAttachment ? { ...rawObject!, attachment: ["d-handle", "cuff"].includes(attachment) ? "left" : "both" } : rawObject!, attachment))}
    onHold={holdObject} onCuffPosition={cuffPosition => updateCableContact({ ...rawObject!, cuffPosition })}
    palmTurns={{ left: current.poses["left-wrist"]?.x ?? automaticWristAngles(scene, "left").x,
      right: current.poses["right-wrist"]?.x ?? automaticWristAngles(scene, "right").x }}
    onPalmTurn={(side, x) => setPose(`${side}-wrist`, { ...(current.poses[`${side}-wrist`] ?? automaticWristAngles(scene, side)), x })}
    onJoint={slug => { selectObject({ kind: "joint", slug }); setMode("advanced"); }} reachable={gripReach[object.id] !== false} />;
  const addObject = (slug: StudioObject["slug"]) => {
    if (studio.objects.length >= 20) { setStatus("The scene has 20 items. Remove an item before adding another."); return; }
    setExampleMachineId(null);
    const id = crypto.randomUUID();
    const machine = isStudioMachine(slug);
    update(addWorkshopEquipment(scene, slug, id));
    if (mode === "quick" && slug === "cable-row-machine") setStep(1);
    setSelection({ kind: "object", id }); setTool("select"); setAdding(false); setPosing(false); setPlaying(false); setTimeMs(current.timeMs);
    setPanel(["bench", "barbell", "dumbbell", "kettlebell", "cable-machine"].includes(slug) || machine ? "contact" : "placement");
  };
  const freeCable = () => {
    const row = object?.slug === "cable-row-machine" ? object : studio.objects.find(item => item.slug === "cable-row-machine" && item.machineUse) ?? studio.objects.find(item => item.slug === "cable-row-machine");
    const id = row?.id ?? crypto.randomUUID();
    try { update(createFreeCableSetup(scene, id), "Use free cable"); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Unable to add cable."); return; }
    setExampleMachineId(null); setSelection({ kind: "object", id }); setPlaying(false);
    setSelectedFrame(0); setTimeMs(0); setLimbPosing(false); setMode("quick"); setStep(1); setPanel("contact");
    setInteractionMode("edit"); setTool("select");
  };
  const freeBody = () => {
    const row = object?.slug === "cable-row-machine" ? rawObject : activeMachine?.slug === "cable-row-machine" ? activeMachine : undefined;
    update(freeWorkshopBody(scene, row?.id), "Free body");
    setPlaying(false); setTimeMs(current.timeMs); setLimbPosing(false); setInteractionMode("edit"); setTool("select"); setLimbWarning(null);
    if (row) setSelection({ kind: "object", id: row.id });
  };
  const duplicate = () => {
    if (!object || studio.objects.length >= 20) return;
    const copy = { ...object, machineUse: object.machineUse === undefined ? undefined : false, shoulderAlignment: undefined, frames: undefined, elbowLocks: undefined, attachment: "none" as const, id: crypto.randomUUID(), name: `${object.name.slice(0, 55)} copy`, x: clamp(object.x + 0.5, -10, 10) };
    update({ ...scene, studio: { ...studio, objects: [...studio.objects, copy] } }); setSelection({ kind: "object", id: copy.id });
  };
  const removeObject = () => { if (!object) return; update({ ...scene, studio: { ...studio, seating: studio.seating?.benchId === object.id ? undefined : studio.seating, objects: studio.objects.filter(item => item.id !== object.id) } }); setSelection({ kind: "body" }); setStatus(`Removed ${object.name} — Undo restores it.`); };
  const addFrame = () => {
    if (scene.keyframes.length >= 24) return;
    const next = scene.keyframes.findIndex(frame => frame.timeMs > timeMs);
    const insertAt = next <= 0 ? 1 : next;
    const before = scene.keyframes[insertAt - 1].timeMs, after = scene.keyframes[insertAt].timeMs;
    if (after - before < 2) return;
    const at = clamp(Math.round(timeMs), before + 1, after - 1);
    update({ ...scene, keyframes: [...scene.keyframes.slice(0, insertAt), { timeMs: at, poses: sampleWorkshopPose(scene.keyframes, at) }, ...scene.keyframes.slice(insertAt)] });
    setSelectedFrame(insertAt); setTimeMs(at); setPlaying(false);
  };
  const removeFrame = () => {
    if (scene.keyframes.length <= 2 || dragging) return;
    const next = deleteWorkshopFrame(scene, selectedFrame), index = Math.max(0, selectedFrame - 1);
    update(next); setSelectedFrame(index); setTimeMs(next.keyframes[index].timeMs); setPlaying(false); setFrameError(null);
  };
  const editFrame = () => {
    setPlaying(false); setTimeMs(current.timeMs); setTimelineOpen(true); setFrameError(null);
    if (activeMachine) { selectObject({ kind: "object", id: activeMachine.id }); setPosing(false); }
    else if (object) { setPosing(false); }
    else { selectObject({ kind: "joint", slug: selectedJoint ?? "torso" }); setPosing(true); }
  };
  const changeFrameTime = (value: string) => {
    try {
      const next = retimeWorkshopFrame(scene, selectedFrame, value.trim() ? Math.round(Number(value) * 1000) : NaN);
      if (next !== scene) update(next);
      setTimeMs(next.keyframes[selectedFrame].timeMs); setPlaying(false); setFrameError(null);
    } catch (error) { setFrameError(error instanceof Error ? error.message : "Check the frame time."); }
  };
  const changeDuration = (durationMs: number) => {
    const ratio = durationMs / scene.durationMs;
    const keyframes = scene.keyframes.map((frame, index) => ({ ...frame, timeMs: index === scene.keyframes.length - 1 ? durationMs : Math.round(frame.timeMs * ratio) }));
    update({ ...scene, durationMs, keyframes, studio: { ...studio, objects: studio.objects.map(item => ({ ...item, frames: item.frames?.map(frame => ({ ...frame, timeMs: Math.round(frame.timeMs * ratio) })) })) }, annotations: scene.annotations?.map(item => ({ ...item, startMs: Math.round(item.startMs * ratio), endMs: Math.round(item.endMs * ratio) })) });
    setTimeMs(keyframes[selectedFrame].timeMs); setPlaying(false);
  };
  const save = (continueToDetails = false) => {
    if (captureElbow || dragging) return;
    setPlaying(false);
    const active = document.activeElement;
    if (active instanceof HTMLElement && workshopRoot.current?.contains(active)) active.blur();
    requestAnimationFrame(() => {
      void draft.saveNow().then(result => { if (continueToDetails && result?.privateId && !result.error && result.current) router.push(`/my-exercises/${result.privateId}/edit?sceneSaved=1`); });
    });
  };
  const editor: StudioEditor = {
    limbPosing: limbPosing && Math.round(timeMs) === current.timeMs,
    limbPose: current.poses,
    blockedLimbs,
    onLimbDragStart: () => { beginDrag(); setLimbWarning(null); },
    onLimbPoseChange: (limb, poses, error) => {
      const session = dragSession.current;
      if (!session || limbPoseBlock(session.scene, limb) || session.timeMs !== current.timeMs) return;
      update({ ...session.scene, keyframes: session.scene.keyframes.map((frame, index) => index === selectedFrame || poseScope === "all"
        ? { ...frame, poses: constrainFrontalPose({ ...frame.poses, ...poses }, session.scene.studio?.frontalPlane) } : frame) });
      setLimbWarning(error > .025 ? "limit" : limb.endsWith("foot") ? "contact" : null);
    },
    onCableDragStart: id => { beginDrag(); setSelection({ kind: "object", id }); setLimbWarning(null); },
    onCablePoseChange: (id, poses, error) => {
      const session = dragSession.current, cable = session?.scene.studio?.objects.find(item => item.id === id);
      if (!session || !cable || cable.machineUse || session.timeMs !== current.timeMs) return;
      update({ ...session.scene, keyframes: session.scene.keyframes.map((frame, index) => index === selectedFrame || poseScope === "all"
        ? { ...frame, poses: constrainFrontalPose({ ...frame.poses, ...poses }, session.scene.studio?.frontalPlane) } : frame) });
      setLimbWarning(error > .025 ? "limit" : null);
    },
    dragPlane,
    onMachineDragStart: id => { beginDrag(); setSelection({ kind: "object", id }); },
    onMachineHandleChange: (id, values) => {
      const session = dragSession.current;
      if (!session) return;
      try { update(moveMachineWithMouse(session.scene, id, session.timeMs, values, mode)); }
      catch (error) { setStatus(error instanceof Error ? error.message : "Could not move this handle. Try an existing moment."); }
    },
    bodyLocked: !!activeMachine || limbPosing,
    placementLockedIds, supportObjectIds: studio.seating ? [studio.seating.benchId] : [], onPlacementOverlap,
    selection, tool, snap, sensitivity, playing, dragging, adjusting, posing, onSelect: selectObject, onActivate: activateObject,
    onBodyChange: body => update({ ...scene, studio: { ...studio, body } }),
    onObjectChange: transformObject, onJointChange: setPose,
    onDragStart: beginDrag, onDragEnd: endDrag,
    onGripReach: (id, reachable) => setGripReach(previous => ({ ...previous, [id]: reachable })),
    captureElbow, blockedJoints, frontalPlane: studio.frontalPlane,
    onCaptureElbow: (id, side, point) => {
      const item = studio.objects.find(item => item.id === id);
      if (item) updateObject(id, { elbowLocks: { ...item.elbowLocks, [side]: point } });
      setCaptureElbow(null);
    },
    onPresentationChange: presentation => update({ ...scene, studio: { ...studio, presentation } }),
  };

  const changeTransform = (value: SceneTransform) => {
    setPlaying(false); setTimeMs(current.timeMs);
    if (object) transformObject(object.id, value);
    else if (!activeMachine) update({ ...scene, studio: { ...studio, body: value } });
  };
  const chooseTool = (value: StudioEditor["tool"]) => { setTool(value); setPlaying(false); setTimeMs(current.timeMs); };
  const selectedTransform = object ?? studio.body;
  const canHold = object && ["barbell", "dumbbell", "kettlebell", "cable-machine"].includes(object.slug);
  const canHoldBoth = object && (["barbell", "kettlebell"].includes(object.slug) || object.slug === "cable-machine" && !["d-handle", "cuff"].includes(object.cableAttachment ?? "d-handle"));
  const held = object && object.attachment !== "none";
  const nudgeHeight = (amount: number) => changeTransform({ ...selectedTransform, y: Math.round(clamp(selectedTransform.y + amount, -3, 10) * 100) / 100 });
  const supportBench = object?.slug === "bench" ? object : studio.objects.find(item => item.id === studio.seating?.benchId && item.slug === "bench");
  const benchControls = supportBench && <WorkshopBenchControls bench={supportBench} facing={studio.seating?.benchId === supportBench.id ? studio.seating.facing : undefined} onAngle={benchAngle => updateObject(supportBench.id, { benchAngle })} onPosition={(facing?: BenchFacing) => {
    update({ ...scene, motionStyle: "free", studio: { ...studio,
      objects: studio.objects.map(item => facing && item.machineUse ? { ...item, machineUse: false } : item),
      seating: facing ? { benchId: supportBench.id, facing } : undefined } });
    setPlaying(false);
  }} />;

  const closePicker = () => setAdding(false);
  const chooseExample = (example: WorkshopScene) => {
    setExampleMachineId(example.studio!.objects[0].id);
    const presentation = studio.presentation;
    update({ ...example, studio: { ...example.studio!, presentation: presentation ? { ...example.studio!.presentation!, highlight: presentation.highlight, isolate: presentation.isolate } : example.studio!.presentation } });
    setSelectedFrame(0); setTimeMs(0); setPlaying(false); setSelection({ kind: "object", id: example.studio!.objects[0].id });
  };
  const changeStep = (next: number) => { setStep(next); setPlaying(false); if (tutorial.open) tutorial.update({ open: true, step: next }); setStatus(`Step ${next + 1}: ${["Choose equipment", "Start and finish", "Preview", "Name and save"][next]}`); };
  const resetExample = () => {
    const recipe = createQuickScene(activeMachine && isStudioMachine(activeMachine.slug) ? activeMachine.slug : "cable-row-machine");
    chooseExample(activeMachine?.machineMode === "reverse" ? setPecDeckMode(recipe, recipe.studio!.objects[0].id, "reverse") : recipe);
  };
  const showExampleInstructions = !!activeMachine && activeMachine.id === exampleMachineId;
  const demonstrationCaption = showExampleInstructions ? workshopDemonstrationCaption(activeMachine!, timeMs, scene.durationMs) : null;
  const overlappingObjects = playing ? [] : studio.objects.filter(item => placementOverlaps[item.id]);
  const onShortcut = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || !(event.target instanceof HTMLElement)) return;
    const target = event.target;
    const command = workshopShortcut(event.nativeEvent, {
      typing: target.isContentEditable || !!target.closest('textarea,select,input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"])'),
      interactive: !!target.closest('button,a[href],summary,input,select,textarea,[role="slider"],[role="button"],[role="spinbutton"]'),
      blocked: dragging || !!captureElbow || adding || !!draft.recovery || !!target.closest('dialog,[role="dialog"],[aria-modal="true"]'),
    });
    if (!command) return;
    event.preventDefault();
    const camera = () => { setInteractionMode("camera"); setPosing(false); setLimbPosing(false); setTool("select"); };
    switch (command) {
      case "undo": undo(); break;
      case "redo": redo(); break;
      case "save":
        save();
        break;
      case "duplicate": duplicate(); break;
      case "remove": removeObject(); break;
      case "play": setPlaying(!playing); break;
      case "previous": if (selectedFrame > 0) selectFrame(selectedFrame - 1); break;
      case "next": if (selectedFrame < scene.keyframes.length - 1) selectFrame(selectedFrame + 1); break;
      case "edit": enableMouseMovement(); break;
      case "camera": camera(); break;
      case "help":
        if (moreHelp.current) moreHelp.current.open = true;
        if (shortcutHelp.current) { shortcutHelp.current.open = true; shortcutHelp.current.querySelector("summary")?.focus(); }
        break;
      case "escape":
        if (shortcutHelp.current?.open) { shortcutHelp.current.open = false; if (moreHelp.current) moreHelp.current.open = false; event.currentTarget.focus(); }
        else if (moreHelp.current?.open) moreHelp.current.open = false;
        else if (focusMode) setFocusMode(false);
        else { camera(); setPlaying(false); }
        break;
    }
  };
  const playbackControls = <WorkshopPlaybackControls scene={scene} timeMs={timeMs} playing={playing} speed={speed} selectedFrame={selectedFrame} disabled={dragging} demonstrationCaption={demonstrationCaption} onPlayingChange={setPlaying} onSpeedChange={setSpeed} onTimeChange={previewTime} onFrameChange={selectFrame} />;
  const openTool = (next: WorkshopTool) => {
    setPanel(next); setMode("advanced");
    if (moreHelp.current) moreHelp.current.open = false;
    if (historyHelp.current) historyHelp.current.open = false;
    if (shortcutHelp.current) shortcutHelp.current.open = false;
    if (next === "pose") { setPosing(true); setInteractionMode("edit"); }
    if (next === "placement" || next === "contact") {
      if (selectedJoint) setSelection({ kind: "body" });
      setPosing(false);
    }
    if (next === "timeline") setTimelineOpen(true);
    requestAnimationFrame(() => {
      const element = workshopRoot.current?.querySelector<HTMLElement>(`[data-workshop-panel="${next}"]`);
      element?.closest("[data-workshop-controls-scroll]")?.scrollTo({ top: 0 });
      if (window.matchMedia("(max-width: 767px)").matches) element?.scrollIntoView({ block: "start" });
    });
  };
  useEffect(() => {
    if (!tutorial.open) return;
    const frame = requestAnimationFrame(() => {
      const tip = workshopTutorialSteps[tutorial.step];
      setFocusMode(false); setPreviewOpen(true); setPlaying(false); setMode(tip.mode); setStep(tip.quickStep);
    });
    return () => cancelAnimationFrame(frame);
  }, [tutorial.open, tutorial.step, setPlaying]);
  const closeTutorial = () => {
    tutorial.update({ open: false, step: tutorial.step });
    if (historyHelp.current) historyHelp.current.open = false;
    requestAnimationFrame(() => tutorialButton.current?.focus({ preventScroll: true }));
  };
  return <WorkshopLanguageProvider language={language}><WorkshopGuidanceProvider enabled={false}><WorkshopCommitMetrics>{(<><div ref={workshopRoot} role="region" tabIndex={0} aria-label={t("Workshop editor")} onKeyDown={onShortcut}
      onPointerDownCapture={event => { if (event.target instanceof HTMLInputElement && event.target.type === "range") beginDrag(false); }}
      onKeyDownCapture={event => { if (event.target instanceof HTMLInputElement && event.target.type === "range" && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) beginDrag(false); }}
      onKeyUpCapture={event => { if (adjusting && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) endDrag(); }}
      onBlurCapture={event => { if (adjusting && event.target instanceof HTMLInputElement && event.target.type === "range") endDrag(); }}
      data-focus-mode={focusMode} data-tutorial-open={tutorial.open} className="fixed inset-0 z-[60] flex min-w-0 flex-col overflow-y-auto bg-card text-base focus-visible:outline-2 focus-visible:outline-ring md:overflow-hidden [&_.text-xs]:text-sm [&_summary]:min-h-11 [&_input[type=range]]:min-h-6" data-workshop="studio" dir={language === "he" ? "rtl" : "ltr"} lang={language}>
<section aria-label={t("Workshop actions")} className="relative shrink-0 space-y-2 border-b bg-card p-2">
      <div hidden={focusMode} className="flex min-w-0 flex-wrap items-center gap-3"><Link href={privateId ? `/my-exercises/${privateId}/edit` : "/my-exercises"} className={buttonClass}>{privateId ? t("Exercise details") : t("My exercises")}</Link>        {mode === "advanced" && <label className="flex min-w-40 flex-1 items-center gap-2 text-sm font-semibold">{t("Exercise name")}<input value={name} maxLength={160} onChange={event => setName(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm font-normal" placeholder={t("Name your private exercise")} /></label>}<div className="ms-auto"><WorkshopFullscreenButton target={workshopRoot} className={buttonClass} /></div></div>
      <div className="flex flex-wrap items-center justify-between gap-2">      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!past.length || dragging} onClick={undo} title={t("Undo · Ctrl / ⌘ + Z")} aria-keyshortcuts="Control+Z Meta+Z" className={buttonClass}><Undo2 size={16} />{t("Undo")}</button>
        <button type="button" disabled={!future.length || dragging} onClick={redo} title={t("Redo · Ctrl / ⌘ + Shift + Z · Ctrl + Y")} aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y" className={buttonClass}><Redo2 size={16} />{t("Redo")}</button>

        <button ref={tutorialButton} type="button" aria-expanded={tutorial.open} disabled={dragging || !!captureElbow} onClick={() => {
          if (tutorial.open) closeTutorial();
          else { tutorial.update({ open: true, step: 0 }); }
        }} className={buttonClass}>{t("Tutorial")}</button>
        <details ref={historyHelp} name="workshop-dropdown" className="lg:relative"><summary className="cursor-pointer px-3 py-2 text-sm">{t("Edit history")}</summary>
          <section data-tutorial-target="history" aria-label={t("Edit history")} className="absolute start-0 top-full z-50 mt-1 w-72 space-y-2 rounded-lg border bg-card p-3 text-sm shadow-lg"><WorkshopGuidance>{t("Latest edit first. Undo and Redo restore one edit at a time.")}</WorkshopGuidance>
            <ol className="max-h-40 overflow-y-auto">{[...past].reverse().map((entry, index) => <li key={index}>{entry.label}</li>)}</ol>
            {!!future.length && <p>{`Redo next: ${future[0].label}`}</p>}
          </section>
        </details>
<details ref={moreHelp} onToggle={event => { if (!event.currentTarget.open && shortcutHelp.current) shortcutHelp.current.open = false; }} name="workshop-dropdown" data-workshop-menu className="md:relative"><summary className="cursor-pointer px-3 py-2 text-sm">{t("More")}</summary><div className="absolute end-0 top-full z-50 mt-1 max-h-[calc(100dvh-12rem)] w-72 space-y-4 overflow-y-auto rounded-lg border bg-card p-4 shadow-lg">      <div  className="flex flex-wrap items-center justify-between gap-2">

        <label className="flex items-center gap-2 text-sm">{t("Language")}<select aria-label={t("Workshop language")} value={language} onChange={event => setLanguage(event.target.value as "en" | "he")} className="min-h-11 rounded-lg border bg-background p-2"><option value="en">{t("English")}</option><option value="he">עברית</option></select></label></div>
        <details ref={shortcutHelp} className="border-t pt-2">
          <summary className="cursor-pointer py-2 text-sm">{t("Recovery and shortcuts")}</summary>
          <div className="space-y-4 py-2 text-sm">
            <WorkshopShortcutGuide />
            <div className="space-y-4">
              <div className="space-y-2"><WorkshopGuidance>{t("Restore last saved replaces the scene and name. Undo restores the current scene.")}</WorkshopGuidance><button type="button" onClick={() => { update(draft.lastSaved.scene, "Restore last saved"); setName(draft.lastSaved.name); setSelectedFrame(0); setTimeMs(0); }} className={buttonClass}>{t("Restore last saved")}</button></div>
              <div className="space-y-2"><WorkshopGuidance>{t("Reset to example replaces the whole scene in one Undo step. Your chosen muscle highlight is kept.")}</WorkshopGuidance><button type="button" onClick={resetExample} className={buttonClass}>{t("Reset to example")}</button></div>
            </div>
          </div>
        </details>
        <button type="button" aria-pressed={focusMode} disabled={dragging} onClick={() => { setFocusMode(!focusMode); if (moreHelp.current) moreHelp.current.open = false; setPreviewOpen(true); if (!focusMode) { setMode("advanced"); if (historyHelp.current) historyHelp.current.open = false; if (shortcutHelp.current) shortcutHelp.current.open = false; } }} className={buttonClass}>{focusMode ? t("Exit focus mode") : t("Focus mode")}</button><button type="button" onClick={() => save(true)} disabled={dragging || !!captureElbow} className={buttonClass}>{t("Save & add details")}</button><Link href="/my-exercises" className={buttonClass}>{t("Exit workshop")}</Link></div></details>
      </div>
      <div className="flex flex-wrap items-center gap-3"><p role="status" aria-live="polite" className="text-sm text-muted-foreground">{t(draft.message)}</p>{draft.error && <button type="button" onClick={() => save()} disabled={pending} className={buttonClass}>{t("Retry saving")}</button>}{draft.dirty && !pending && <span className="text-sm">{draft.recoverable ? t("Recovery copy on this device") : t("Local recovery unavailable · save before leaving")}</span>}</div>
      {draft.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{draft.error} {/sign[ -]in/i.test(draft.error) && <a href={`/sign-in?next=${encodeURIComponent(savedId ? `/my-exercises/${savedId}/workshop` : "/my-exercises/new")}`} className="underline">{t("Sign in again")}</a>}</p>}
      {draft.recovery && <section aria-label={t("Recover draft")} className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-4"><h2 className="font-semibold">{t("An unfinished draft is available on this device")}</h2><p className="text-sm">{t("Restore the scene and name from")} {new Date(draft.recovery.updatedAt).toLocaleString()}{t(". Your last server save stays available.")}</p><div className="flex flex-wrap gap-2"><button type="button" onClick={() => { const recovered = draft.recovery!; update(recovered.scene, "Restore recovered draft"); setName(recovered.name); draft.acceptRecovery(); setSelectedFrame(0); setTimeMs(0); }} className={buttonClass}>{t("Restore recovered draft")}</button><button type="button" onClick={draft.dismissRecovery} className={buttonClass}>{t("Keep server version")}</button></div></section>}
</div>
    </section>
    {adding && <WorkshopEquipmentPicker options={equipmentOptions} ownerKey={ownerId} initialView={equipmentPickerView} onClose={closePicker} onSelect={slug => addObject(slug as StudioObject["slug"])} />}
    <div className="shrink-0">
    <div className="flex flex-wrap items-center gap-2 border-b border-border p-3" role="toolbar" aria-label={t("Workshop tools")}>
      <div className="relative">
        <button ref={addButton} type="button" onClick={event => { event.currentTarget.focus(); setEquipmentPickerView("popular"); setAdding(!adding); }} aria-expanded={adding} className={buttonClass}><Plus size={16} />{t("Add equipment")}<ChevronDown size={14} /></button>
      </div>
      {(activeMachine || studio.seating) && <button type="button" onClick={leaveEquipment} disabled={dragging} className={`${buttonClass} border-primary/40 bg-primary/10 text-primary`}><UserRound size={16} />{activeMachine ? t("Leave machine") : t("Stand up")}</button>}
      <div role="group" className="flex flex-wrap gap-2" aria-label={t("Editor mode")}>{(["quick", "advanced"] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)} className={`${buttonClass} ${mode === value ? "bg-muted" : ""}`}>{value === "quick" ? t("Quick create") : t("Advanced editing")}</button>)}</div>
      {/* The draft queue serializes manual saves with background autosave. */}
      {(mode === "advanced" || focusMode) && <button type="button" onClick={() => save()} disabled={dragging || !!captureElbow || name.trim().length < 2} className={`${buttonClass} ms-auto bg-primary text-primary-foreground`}><Save size={16} />{t("Save")}</button>}
    </div>
    </div>

    <div className="grid min-w-0 grid-cols-1 md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,1fr)_320px] md:overflow-hidden xl:grid-cols-[minmax(0,1fr)_360px]">
      <div data-tutorial-target="preview" className="relative flex h-auto min-h-80 min-w-0 flex-col overflow-hidden border-b bg-card p-2 md:min-h-0 md:border-b-0" data-workshop-preview>
        {overlappingObjects.length > 0 && <div role="status" className="mb-3 space-y-2 rounded-lg border border-amber-500 p-3 text-sm"><p>{t("Equipment and figure bounds overlap. Inspect from both sides; empty space inside a machine can also trigger this advisory.")}</p>{overlappingObjects.map(item => <button key={item.id} type="button" onClick={() => { selectObject({ kind: "object", id: item.id }); setMode("advanced"); setPlaying(false); }} className={buttonClass}>{t("Inspect placement ·")}<span data-workshop-translate="false">{item.name}</span></button>)}<p>{t("Repair: move this item away using Up or Position coordinates, then inspect again. Held items and linked supports are excluded.")}</p></div>}
        <div data-workshop-figure-preview hidden={!previewOpen} className="relative flex min-h-[45dvh] flex-1 flex-col overflow-y-auto md:min-h-0">
          {!comparison && <div role="group" className="absolute start-2 top-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-2 rounded-lg bg-card/95 p-1" aria-label={t("Mouse movement")}>
            <button type="button" aria-pressed={interactionMode === "camera"} onClick={() => setInteractionMode("camera")} className={`${buttonClass} ${interactionMode === "camera" ? "bg-primary text-primary-foreground" : ""}`}>{t("Camera")}</button>
            <button type="button" aria-label={t("Move with mouse")} aria-pressed={interactionMode === "edit" && tool === "select" && !limbPosing} disabled={dragging} onClick={() => enableMouseMovement()} className={`${buttonClass} ${interactionMode === "edit" && tool === "select" && !limbPosing ? "bg-primary text-primary-foreground" : ""}`}><Hand size={18} className="hidden lg:block" /><span className="hidden lg:inline">{t("Move with mouse")}</span><span className="lg:hidden">{t("Move")}</span></button>
            <button type="button" aria-label={t("Pose hands and feet")} aria-pressed={limbPosing && interactionMode === "edit"} disabled={dragging} onClick={enableLimbPosing} className={`${buttonClass} ${limbPosing && interactionMode === "edit" ? "bg-primary text-primary-foreground" : ""}`}><UserRound size={18} className="hidden lg:block" /><span className="hidden lg:inline">{t("Pose hands and feet")}</span><span className="lg:hidden">{t("Hands & feet")}</span></button>
            {(activeMachine || object?.slug === "cable-row-machine") && <button type="button" aria-pressed={!activeMachine} disabled={dragging} onClick={freeBody} className={`${buttonClass} ${!activeMachine ? "bg-primary text-primary-foreground" : ""}`}>{t("Free body")}</button>}
            {limbPosing && (mode === "quick" || panel !== "pose") && <button type="button" disabled={dragging || blockedJoints.length === jointSlugs.length} onClick={resetJoints} className={buttonClass}>{t("Reset all joints")}</button>}
          </div>}
          {interactionMode === "edit" && !limbPosing && <WorkshopGuidance essential className="mb-3 text-sm text-muted-foreground">{t("Drag equipment directly. Use the round grab buttons to move machine handles. Use Side view to drag up, down, toward or away from the body.")}</WorkshopGuidance>}
          {limbPosing && interactionMode === "edit" && <div className="mb-3 space-y-2 text-sm">
            <WorkshopGuidance essential>{t("Drag a hand or foot using its round button. Elbows and knees follow. Arrow keys move the selected handle; Shift takes a larger step. Escape cancels. Use Front and Side views to move in different directions.")}</WorkshopGuidance>
            <p>{poseScope === "all" ? t("The moved limb changes in all poses.") : t("Only the displayed pose changes. Undo restores the whole drag.")}</p>
            {Math.round(timeMs) !== current.timeMs && <p role="status">{t("Choose Edit this moment to pose the displayed time.")}</p>}
            {limbBlockReasons.map(reason => <p key={reason}>{reason}</p>)}
          </div>}
          {comparison ? <div className="min-h-0 flex-1 overflow-y-auto"><WorkshopComparison scene={scene} /></div> : <MotionCanvas scene={scene} timeMs={timeMs} playback={playback} editor={editor} simplifiedControls controlsTarget={viewControlsTarget} interactionMode={interactionMode} onInteractionModeChange={value => value === "edit" ? enableMouseMovement() : setInteractionMode("camera")} onMachineReachChange={onMachineReach} fillViewport className="min-h-44 flex-1" canvasOverlay={interactionMode === "edit" ? <WorkshopPoseFeedback kind={limbWarning} dragging={dragging} /> : undefined} />}
          {!comparison && <div data-workshop-current-hint className="pointer-events-none mt-2 flex justify-between gap-3 text-xs">
            <span className="rounded-lg bg-card/95 px-3 py-2 font-semibold">{playing ? t("Previewing movement") : interactionMode === "camera" ? t("Drag to rotate the camera. Choose Move to reposition the figure or equipment.") : limbPosing ? t("Drag a hand or foot using its round button") : controllingWeight?.machineUse ? <><span data-workshop-translate="false">{controllingWeight.name}</span> {t("controls contact")}</> : controllingWeight ? <><span data-workshop-translate="false">{controllingWeight.name}</span> {t("controls this arm")}</> : selectedJoint ? `${t(jointNames[selectedJoint])} · ${t(isWrist ? "use the palm controls" : "drag a ring to pose")}` : bodyLocked ? t("Select the machine to move the figure") : tool === "rotate" ? t("Drag a colored ring to rotate") : tool === "translate" ? t("Drag an arrow to move") : t("Drag the figure or equipment to move it")}</span>
          </div>}
        </div>
        {playbackControls}

      </div>
<div data-workshop-controls-scroll className="min-w-0 md:min-h-0 md:overflow-y-auto md:border-l">
      {mode === "advanced" && <div className="sticky top-0 z-20 bg-card"><WorkshopToolNavigation selected={panel} onSelect={openTool} /></div>}
      {mode === "quick" && <div className="min-w-0 lg:min-h-0 lg:overflow-y-auto">
        {step === 1 && (cableControls || benchControls) && <details className="mx-4 mt-4 border-b pb-3"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">{t("Grip and equipment options")}</summary>{cableControls}{benchControls}{cableControls && <button type="button" onClick={() => openTool("contact")} className={`${buttonClass} mt-3`}>{t("Cable position and pulley")}</button>}</details>}
        <WorkshopQuickCreate showAddEquipment={false}
          scene={scene} step={step} onStep={changeStep} onAddEquipment={addObject} onAdd={() => { setEquipmentPickerView("all"); closeMenus(); setAdding(true); }}
          onPoseMoment={poseMoment} onMatchReturn={() => update(matchWorkshopLoop(scene))}
          onPreviewTime={previewTime} name={name} onName={setName} onSave={() => save()}
          saving={pending} savedId={savedId} currentConfirmed={draft.currentConfirmed} confirmedName={draft.lastSaved.name}
          onDetails={() => save(true)} language={language} onAdvanced={() => openTool("pose")}
          reachWarning={Object.values(gripReach).some(value => !value)} />
      </div>}
      <aside data-tutorial-target="inspector" hidden={mode !== "advanced"} aria-label={t("Workshop controls")} className="min-w-0 space-y-4 p-3" inert={dragging}>
        <label className="block text-sm font-semibold">{t("Selected equipment")}<select aria-label={t("Selected equipment")} value={object?.id ?? "body"} onChange={event => selectObject(event.target.value === "body" ? { kind: "body" } : { kind: "object", id: event.target.value })} className={inputClass}>
          <option value="body">{t("Anatomical figure")}</option>{studio.objects.map(item => <option key={item.id} value={item.id} data-workshop-translate="false">{item.name}</option>)}
        </select></label>
        <WorkshopToolPanel tool="equipment" selected={panel}><section><h2 className="text-sm font-semibold">{t("In your scene")}</h2><div role="group" className="mt-2 max-h-40 space-y-1 overflow-y-auto" aria-label={t("Scene objects")}>
          <button type="button" onClick={() => selectObject({ kind: "body" })} aria-pressed={selection?.kind === "body"} className={`${buttonClass} w-full justify-start border-transparent ${selection?.kind === "body" ? "bg-primary/10 text-primary" : ""}`}><UserRound size={15} />{t("Anatomical figure")}</button>
          {studio.objects.map(item => <button key={item.id} type="button" onClick={() => { selectObject({ kind: "object", id: item.id }); setPosing(false); }} aria-pressed={object?.id === item.id} className={`${buttonClass} w-full justify-start border-transparent ${object?.id === item.id ? "border-primary bg-primary/15 text-primary ring-1 ring-primary" : ""}`}><Box size={14} /><span className="truncate" data-workshop-translate="false">{item.name}</span></button>)}
        </div>{object && <button type="button" onClick={removeObject} className={`${buttonClass} mt-3`}><Trash2 size={14} />{t("Remove item")}</button>}</section></WorkshopToolPanel>
        <WorkshopToolPanel tool="setups" selected={panel}><WorkshopSetups expanded ownerId={ownerId} scene={scene} onApply={next => { update(next, "Apply equipment setup"); setSelection({ kind: "body" }); setPlaying(false); setTimeMs(current.timeMs); }} /></WorkshopToolPanel>
        <WorkshopToolPanel tool="view" selected={panel}><h2 className="text-lg font-semibold">{t("View and muscles")}</h2><div className="flex flex-wrap gap-2"><button type="button" aria-pressed={comparison} disabled={dragging} onClick={() => { setComparison(!comparison); setPlaying(false); }} className={buttonClass}>{comparison ? t("Close comparison") : t("Compare start and finish")}</button><button type="button" aria-expanded={previewOpen} onClick={() => setPreviewOpen(!previewOpen)} className={buttonClass}>{previewOpen ? t("Collapse preview") : t("Show preview")}</button></div><div ref={setViewControlsTarget} /></WorkshopToolPanel>
        <WorkshopToolPanel tool="timeline" selected={panel}>{object && <InspectorSection title={t("Equipment movement")} visible={panel === "timeline"}>          {object && <div className="mt-4 space-y-2 rounded-lg border p-3 text-sm">
            <button type="button" aria-pressed={!!rawObject?.frames?.length} className={buttonClass} onClick={() => {
              const enabled = !rawObject?.frames?.length;
              const animated = setStudioObjectAnimated(rawObject!, enabled, current.timeMs, scene.keyframes.map(frame => frame.timeMs));
              updateObject(object.id, animated); setPlaying(false); setTimeMs(current.timeMs);
              setTimelineOpen(enabled);
            }}>{rawObject?.frames?.length ? t("Stop animation and edit placement") : t("Animate selected item")}</button>
            <p>{rawObject?.frames?.length ? `Editing ${label(current.timeMs)}. Changes affect this moment only.` : t("Static placement. Changes apply to the whole scene.")}</p>
          </div>}
          {object && isStudioMachine(object.slug) && <div className="space-y-3">
            <fieldset className="block text-base font-semibold"><legend>{object.machineMode === "reverse" ? t("Arm opening") : machineTravelLabels[object.slug]}</legend>
              <input aria-label={object.machineMode === "reverse" ? t("Arm opening") : machineTravelLabels[object.slug]} type="range" min={0} max={1} step={0.01} value={object.machinePosition ?? 0.5} onChange={event => {
                updateObject(object.id, setMachinePosition(rawObject!, Number(event.target.value), current.timeMs)); setPlaying(false); setTimeMs(current.timeMs);
              }} className="mt-2 w-full accent-primary" />
              <WorkshopNumberField label={t(`${object.machineMode === "reverse" ? "Arm opening" : machineTravelLabels[object.slug]} percent`)} min={0} max={100} step={1} value={Math.round((object.machinePosition ?? 0.5) * 100)} onChange={value => {
                updateObject(object.id, setMachinePosition(rawObject!, value / 100, current.timeMs)); setPlaying(false); setTimeMs(current.timeMs);
              }} />
            </fieldset>
            {object.slug === "cable-row-machine" && <div className="space-y-2"><WorkshopNumberField label={t("Handle height meters")} min={rowHandleHeight.min * object.scale} max={rowHandleHeight.max * object.scale} step={.05 * object.scale} value={Math.round((object.machineHandleHeight ?? rowHandleHeight.standard) * object.scale * 100) / 100} onChange={height => {
              updateObject(object.id, setMachineHandleHeight(rawObject!, height / object.scale, current.timeMs)); setPlaying(false); setTimeMs(current.timeMs);
            }} /><WorkshopGuidance className="text-sm text-muted-foreground">{t("Changes handle height at the editing moment. The seat, footplates and pulley stay in place.")}</WorkshopGuidance></div>}
          </div>}

          </InspectorSection>}        <section data-tutorial-target="timeline" className="space-y-4">
          <h2 className="text-lg font-semibold">{t("Timeline")}</h2><div className="flex flex-wrap gap-2"><button type="button" onClick={() => { const at = Math.round(timeMs); const index = scene.keyframes.findIndex(frame => frame.timeMs === at); if (index >= 0) selectFrame(index); else addFrame(); setInteractionMode("edit"); }} disabled={dragging || scene.keyframes.length >= 24} className={buttonClass}>{t("Edit this moment")}</button><button type="button" disabled={selectedFrame === 0 || dragging} onClick={() => selectFrame(selectedFrame - 1)} className={buttonClass}>{t("Previous pose")}</button><button type="button" disabled={selectedFrame === scene.keyframes.length - 1 || dragging} onClick={() => selectFrame(selectedFrame + 1)} className={buttonClass}>{t("Next pose")}</button></div>
          <div className="mt-4">
            <WorkshopGuidance className="text-sm text-muted-foreground">{t("Choose the pose to edit. Machine travel affects its moving parts; placement stays fixed.")}</WorkshopGuidance>
            <input aria-label={t("Scrub timeline")} type="range" min={0} max={scene.durationMs} step={1} value={Math.round(timeMs)} disabled={dragging} onChange={event => { setPlaying(false); setTimeMs(Number(event.target.value)); }} className="mt-4 w-full accent-primary" />
            <nav aria-label={t("Repetition markers")} className="mt-2 flex justify-between gap-2">{[0, scene.durationMs / 2, scene.durationMs].map(at => <button type="button" key={at} disabled={dragging} onClick={() => previewTime(at)} className={buttonClass}>{workshopMomentName(at, scene.durationMs)}</button>)}</nav>
            <div className="mt-2 flex flex-wrap gap-2">{scene.keyframes.map((frame, index) => <button key={`${frame.timeMs}-${index}`} type="button" disabled={dragging} aria-pressed={selectedFrame === index} onClick={() => selectFrame(index)} className={`${buttonClass} ${selectedFrame === index ? "bg-primary/10 text-primary" : "bg-card"}`}>{workshopMomentName(frame.timeMs, scene.durationMs, index)} · {label(frame.timeMs)}</button>)}</div>
            <section aria-label={t("Selected keyframe")} className="mt-3 space-y-3 rounded-lg border border-border p-3">
              <p className="text-xs font-semibold">{t("Selected:")} {workshopMomentName(current.timeMs, scene.durationMs, selectedFrame)} · {label(current.timeMs)}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={editFrame} disabled={dragging} className={buttonClass}>{t("Edit keyframe")}</button>
                <button type="button" onClick={removeFrame} disabled={scene.keyframes.length <= 2 || dragging} className={buttonClass}><Trash2 size={14} />{t("Delete keyframe")}</button>
                <button type="button" onClick={addFrame} disabled={scene.keyframes.length >= 24 || dragging} className={buttonClass}><Plus size={14} />{t("Add keyframe")}</button>
              </div>

              <div className="flex flex-wrap gap-2"><label className="text-sm">{t("Copy pose to")}<select aria-label={t("Copy pose destination")} value={copyTarget} onChange={event => setCopyTarget(Number(event.target.value))} className={inputClass}>{scene.keyframes.map((frame, index) => <option key={index} value={index}>{t("Pose")} {index + 1} · {label(frame.timeMs)}</option>)}</select></label><button type="button" onClick={() => update(copyWorkshopPose(scene, selectedFrame, copyTarget))} className={buttonClass}>{t("Copy to chosen pose")}</button><button type="button" onClick={() => update(copyWorkshopPose(scene, selectedFrame, "all"))} className={buttonClass}>{t("Copy to all poses")}</button><button type="button" onClick={() => update(mirrorWorkshopPose(scene, selectedFrame))} className={buttonClass}>{t("Mirror sides")}</button><button type="button" onClick={() => update(matchWorkshopLoop(scene))} className={buttonClass}>{t("Match loop end to start")}</button></div>
              {selectedFrame > 0 && selectedFrame < scene.keyframes.length - 1 ? <form key={`${selectedFrame}-${current.timeMs}`} onSubmit={event => { event.preventDefault(); changeFrameTime(String(new FormData(event.currentTarget).get("frameTime") ?? "")); }} className="flex flex-wrap items-end gap-2">
                <label className="text-xs font-semibold">{t("Frame time · seconds")}<input name="frameTime" aria-label={t("Keyframe time seconds")} type="number" step="0.001" required defaultValue={current.timeMs / 1000} disabled={dragging} className={`${inputClass} max-w-36`} /></label>
                <button type="submit" disabled={dragging} className={buttonClass}>{t("Update time")}</button>
              </form> : <WorkshopGuidance className="text-xs text-muted-foreground">{t("Start stays at 0; End stays at Duration. Deleting either uses the next surviving pose. Keep at least two frames.")}</WorkshopGuidance>}
              <WorkshopGuidance className="text-xs text-muted-foreground">{t("Edit the selected pose or equipment controls. Use Undo to restore changes.")}</WorkshopGuidance>
              {frameError && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{t(frameError)}</p>}
            </section>
            <details name="workshop-dropdown" className="mt-3 text-xs"><summary className="cursor-pointer text-muted-foreground">{t("Timeline settings")}</summary><div className="mt-3 flex flex-wrap items-center gap-3">
              <label>{t("Duration")}<select value={scene.durationMs} onChange={event => changeDuration(Number(event.target.value))} className="ml-2 rounded border bg-card p-2">{Array.from(new Set([1600, 2400, 3200, 4800, 6400, 8000, scene.durationMs])).sort((a, b) => a - b).map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
            </div></details>
          </div>
        </section></WorkshopToolPanel>
        <WorkshopToolPanel tool="pose" selected={panel}>      <label className="flex items-center gap-2 px-1 text-xs font-semibold" title={t("Restricts both shoulders to side-to-side movement across every pose. One Undo restores all previous poses.")}><input aria-label={t("Frontal-plane lock")} type="checkbox" checked={!!studio.frontalPlane} disabled={dragging} onChange={event => { update(setFrontalPlane(scene, event.target.checked)); setPlaying(false); setTimeMs(current.timeMs); }} />{t("Side-to-side shoulder movement only")}</label>              <fieldset><legend className="mb-2 font-semibold">{t("Pose editing scope")}</legend><div className="flex flex-wrap gap-2"><button type="button" aria-pressed={poseScope === "selected"} onClick={() => setPoseScope("selected")} className={buttonClass}>{t("Edit this pose")}</button><button type="button" aria-pressed={poseScope === "all"} onClick={() => setPoseScope("all")} className={buttonClass}>{t("Apply to all poses")}</button></div><p className="mt-2 text-sm">{poseScope === "all" ? t("Joint adjustments replace that joint across every pose in one Undo step.") : `Joint adjustments affect pose ${selectedFrame + 1} only.`}</p></fieldset><button type="button" disabled={dragging || blockedJoints.length === jointSlugs.length} onClick={resetJoints} className={buttonClass}>{t("Reset all joints")}</button><WorkshopJointPicker compact selected={selectedJoint} onSelect={slug => selectObject({ kind: "joint", slug })} /><InspectorSection title={t("Movement")} visible={panel === "pose"}>          {selectedJoint ? <div className="mt-3 space-y-3">
            {controllingWeight && <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
              <p>{controllingWeight.machineUse ? `${controllingWeight.name} keeps the hands and feet in contact. Select the machine to change travel.` : `${controllingWeight.name} controls this arm. Move the weight to pose the arm; wrist controls remain available.`}</p>
              <button type="button" onClick={() => { updateObject(controllingWeight.id, controllingWeight.machineUse ? { machineUse: false } : { attachment: "none", elbowLocks: undefined }); setCaptureElbow(null); }} className={`${buttonClass} mt-2`}>{controllingWeight.machineUse ? t("Stop using machine to pose freely") : t("Release weight to pose arm")}</button>
              <button type="button" onClick={() => selectObject({ kind: "object", id: controllingWeight.id })} className={`${buttonClass} mt-2`}>{controllingWeight.machineUse ? t("Select machine") : t("Select held weight")}</button>
            </div>}
            <p className="text-xs text-muted-foreground">{controllingWeight?.machineUse ? t("The machine controls contact. Select the machine to edit its travel, or stop using it to pose freely.") : controllingWeight ? t("These joint controls are paused while the weight is held.") : isWrist ? t("Turn the palm, bend the wrist, or tilt it sideways.") : isKnee ? t("0° is straight. Positive bends the knee backward; extension is limited to 5°.") : isAnkle ? t("Raise or point the toes, turn the foot, or tilt it sideways.") : t("Drag a rotation ring, or use these sliders.")}{timelineOpen ? ` Editing ${label(current.timeMs)}.` : ""}</p>
            {isWrist && <div className="flex flex-wrap gap-1">{[{ label: "Palm up", turn: -90 }, { label: "Neutral", turn: 0 }, { label: "Palm down", turn: 90 }].map(preset => <button type="button" key={preset.label} disabled={!!controllingWeight} title={preset.turn === -90 ? t("Supinated") : preset.turn === 90 ? t("Pronated") : t("Neutral grip")} aria-pressed={jointAngles.x === preset.turn} onClick={() => setPose(selectedJoint, { ...jointAngles, x: preset.turn })} className={`${buttonClass} ${jointAngles.x === preset.turn ? "bg-primary/10 text-primary" : ""}`}>{t(preset.label)}</button>)}</div>}
            {frontalShoulder && <WorkshopGuidance className="text-xs text-muted-foreground">{t("Frontal-plane lock applies to both shoulders across all keyframes. Edit side-to-side motion below.")}</WorkshopGuidance>}
            {(["x", "y", "z"] as const).filter(axis => (!isKnee || axis === "x") && (!frontalShoulder || axis === "z")).map(axis => {
              const range = jointControlRange(selectedJoint, axis);
              const value = jointControlValue(selectedJoint, axis, jointAngles[axis]);
              const changeAngle = (value: number) => setPose(selectedJoint, { ...jointAngles, [axis]: jointControlValue(selectedJoint, axis, clamp(value, ...range)) });
              const action = isWrist ? axis === "x" ? "Palm turn" : axis === "y" ? "Wrist bend" : "Wrist tilt" : isAnkle ? axis === "x" ? "Toes up / down" : axis === "y" ? "Foot turn" : "Foot tilt" : axis === "x" ? "Bend" : axis === "y" ? "Turn" : "Side to side";
              return <fieldset key={axis} className="space-y-2"><legend className="text-base font-semibold">{action}</legend><input aria-label={t(`${action} ${jointNames[selectedJoint]} degrees`)} disabled={!!controllingWeight} type="range" min={range[0]} max={range[1]} value={value} onChange={event => changeAngle(Number(event.target.value))} className="w-full accent-primary disabled:opacity-40" /><WorkshopNumberField label={t(`${action} ${jointNames[selectedJoint]} degrees`)} disabled={!!controllingWeight} min={range[0]} max={range[1]} value={value} onChange={changeAngle} /></fieldset>;
            })}
            <button type="button" disabled={!!controllingWeight} onClick={() => setPose(selectedJoint, { x: 0, y: 0, z: 0 })} className={buttonClass}>{t("Reset joint")}</button>
          </div> : null}
</InspectorSection></WorkshopToolPanel>
        <section hidden={!["placement", "contact"].includes(panel)} aria-label={t("Selected item")} data-grip-reachable={object && gripReach[object.id] === false ? "false" : "true"}>
          <h2 className="text-base font-semibold">{selectedJoint ? jointNames[selectedJoint] : object ? <span data-workshop-translate="false">{object.name}</span> : t("Anatomical figure")}</h2>
          <WorkshopToolPanel tool="contact" selected={panel}>{cableControls}{(!object || object.slug === "bench") && benchControls}
          {object?.slug === "cable-row-machine" && <section className="space-y-2 rounded-xl border p-3"><p className="text-sm">{t("Seated row links the seat, feet and handle. Free cable movement lets you pose the whole body.")}</p><button type="button" onClick={freeCable} className={buttonClass}>{t("Free cable movement")}</button></section>}
          {!object && !supportBench && <p>{t("Select equipment to set grips or supports.")}</p>}
          {object && !canHold && !isStudioMachine(object.slug) && object.slug !== "bench" && <p>{t("This item has no grip or support controls. Use Position to place it.")}</p>}
          {object && (isStudioMachine(object.slug) || canHold) && <InspectorSection title={t("Contact")} visible={panel === "contact"}>
          {object && isStudioMachine(object.slug) && <div className="mt-4 space-y-3 rounded-xl bg-primary/5 p-3">
            {object.slug === "pec-deck" && <label className="block text-xs font-semibold">{t("Pec deck mode")}<select aria-label={t("Pec deck mode")} value={object.machineMode ?? "regular"} onChange={event => {
              const machineMode = event.target.value as "regular" | "reverse";
              update(setPecDeckMode(scene, object.id, machineMode)); setPlaying(false);
            }} className={inputClass}>
              <option value="regular">{t("Regular")}</option><option value="reverse">{t("Reverse")}</option>
            </select></label>}
            {object.slug === "lat-pulldown-machine" && <label className="block text-xs font-semibold">{t("Pulldown grip")}<select aria-label={t("Pulldown grip")} value={object.machineGrip ?? "supinated"} onChange={event => updateObject(object.id, { machineGrip: event.target.value as "supinated" | "pronated" })} className={inputClass}>
              <option value="supinated">{t("Supinated · palms toward you")}</option><option value="pronated">{t("Pronated · palms away from you")}</option>
            </select></label>}
            <button type="button" aria-pressed={!!object.machineUse} onClick={() => {
              update({ ...scene, motionStyle: "free", equipment: null, studio: { ...studio, seating: undefined, objects: studio.objects.map(item => ({ ...item,
                machineUse: item.id === object.id ? !object.machineUse : item.machineUse === undefined ? undefined : false,
                attachment: item.id === object.id && item.slug === "cable-row-machine" && item.cableAttachment ? item.attachment : "none", elbowLocks: undefined })) } });
              setPlaying(false);
            }} className={`${buttonClass} ${object.machineUse ? "bg-primary text-primary-foreground" : "bg-card"}`}>{object.machineUse ? t("Stop using machine") : t("Use this machine")}</button>
            {object.id === exampleMachineId && <p className="text-xs text-muted-foreground">{object.machineMode === "reverse" ? t("Face the pad with your chest supported and feet planted. Open both arms outward, then return with control.") : machineContactDescriptions[object.slug]}</p>}
            {!(object.slug === "cable-row-machine" && object.cableAttachment) && <WorkshopGripControls object={object} onChange={choices => updateObject(object.id, choices)} onPreviewPose={pose => previewTime(pose === "start" ? 0 : scene.durationMs / 2)} reach={machineReach} />}
            <WorkshopGuidance className="text-xs text-muted-foreground">{t("Animate selected item creates editable moments for moving parts. The frame stays in place.")}</WorkshopGuidance>
          </div>}
          {canHold && object.slug !== "cable-machine" && <div className="mt-4 rounded-xl bg-primary/5 p-3">
            <WorkshopGuidance className="mb-2 text-sm">{t("Holding or attaching replaces contacts in the chosen hand and clears their elbow locks. An engaged machine is released. One Undo restores the scene.")}</WorkshopGuidance><h3 className="text-sm font-semibold">{t("Hold this weight")}</h3>
            <div className="mt-2 flex flex-wrap gap-2">{(["left", "right", ...(canHoldBoth ? ["both"] : [])] as ("left" | "right" | "both")[]).map(hand => <button key={hand} type="button" aria-pressed={object.attachment === hand} onClick={() => holdObject(hand)} className={`${buttonClass} ${object.attachment === hand ? "bg-primary text-primary-foreground" : "bg-card"}`}>{`Hold with ${hand === "both" ? "both hands" : `${hand} hand`}`}</button>)}</div>
            {held && <><p className="mt-3 flex items-center gap-1 text-xs font-semibold"><Check size={13} />{object.attachment === "both" ? t("Held with both hands") : `Held with ${object.attachment} hand`}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("Move the weight to move the arms with it.")}</p>
              {gripReach[object.id] === false && <p role="alert" className="mt-2 text-xs text-amber-700">{Object.keys(object.elbowLocks ?? {}).length ? t("Outside the locked elbow’s reach. Move the weight along the curl arc, or unlock the elbow.") : t("Too far to reach. Move the weight closer to the figure.")}</p>}
              <button type="button" onClick={() => holdObject("none")} className={`${buttonClass} mt-2 bg-card`}>{t("Release")}</button><div className="mt-2 flex flex-wrap gap-1">{(["left", "right"] as const).filter(side => object.attachment === side || object.attachment === "both").flatMap(side => (["wrist"] as const).map(joint => <button key={`${side}-${joint}`} type="button" onClick={() => selectObject({ kind: "joint", slug: `${side}-${joint}` })} className={`${buttonClass} bg-card`}>{side === "left" ? t("Left") : t("Right")} {joint}</button>))}</div>
              <div className="mt-3 space-y-2 border-t pt-3">
                <WorkshopGuidance className="text-xs text-muted-foreground">{t("Lock an elbow at its current position relative to the figure. Position the arm on the pad first, then keep the weight within reach.")}</WorkshopGuidance>
                {(["left", "right"] as const).filter(side => object.attachment === side || object.attachment === "both").map(side => <button key={side} type="button" disabled={!!captureElbow || playing || dragging} aria-pressed={!!object.elbowLocks?.[side]} onClick={() => {
                  if (object.elbowLocks?.[side]) { const locks = { ...object.elbowLocks }; delete locks[side]; updateObject(object.id, { elbowLocks: locks }); }
                  else { setPlaying(false); setTimeMs(current.timeMs); setCaptureElbow({ objectId: object.id, side }); }
                }} className={`${buttonClass} bg-card`}>{object.elbowLocks?.[side] ? t("Unlock") : t("Lock")} {side} {t("elbow")}</button>)}
              </div>
            </>}
          </div>}
          {object?.slug === "cable-machine" && <div className="mt-4 space-y-3">
            <fieldset className="space-y-2"><legend className="text-xs font-semibold">{t("Align pulley beside shoulder")}</legend>
              <div className="flex flex-wrap gap-2">{(["left", "right"] as const).map(side => <button key={side} type="button" aria-pressed={object.shoulderAlignment === side} onClick={() => updateObject(object.id, { shoulderAlignment: side })} className={`${buttonClass} ${object.shoulderAlignment === side ? "bg-primary/10 text-primary" : ""}`}>{t("Beside {side} shoulder", { side })}</button>)}</div>
              {object.shoulderAlignment && <><WorkshopGuidance className="text-xs text-muted-foreground">{t("Follows the shoulder when the figure or bench moves. Pulley height stays adjustable.")}</WorkshopGuidance><button type="button" onClick={() => transformObject(object.id, object)} className={buttonClass}>{t("Use manual placement")}</button></>}
            </fieldset>
            <fieldset className="block text-base font-semibold"><legend>{t("Pulley height · meters")}</legend><input aria-label={t("Pulley height meters")} type="range" min={0.2} max={maxPulleyHeight} step={0.05} value={object.pulleyHeight} onChange={event => updateObject(object.id, { pulleyHeight: Number(event.target.value) })} className="mt-2 w-full accent-primary" />
              <WorkshopNumberField label={t("Pulley height meters")} min={0.2} max={maxPulleyHeight} step={0.05} value={object.pulleyHeight} onChange={pulleyHeight => updateObject(object.id, { pulleyHeight })} /></fieldset>
            <div className="flex flex-wrap gap-2">{[["Near feet", .3], ["Near waist", 1.3], ["Near shoulders", 2.2], ["Above head", 2.8]].map(([label, height]) => <button key={label} type="button" onClick={() => updateObject(object.id, { pulleyHeight: clamp((studio.body.y + Number(height) * studio.body.scale - object.y) / object.scale, .2, maxPulleyHeight) })} className={buttonClass}>{t(String(label))}</button>)}</div>
          </div>}

          </InspectorSection>}
</WorkshopToolPanel>
<WorkshopToolPanel tool="placement" selected={panel}>          {!selectedJoint && <InspectorSection title={t("Placement")} visible={panel === "placement"}>
          {object?.slug === "cable-machine" && <fieldset className="space-y-2"><legend className="font-semibold">{t("Cable tower position")}</legend><div className="grid grid-cols-2 gap-2">{([['front', 'In front'], ['behind', 'Behind figure'], ['left', 'Left of figure'], ['right', 'Right of figure']] as const).map(([side, label]) => <button key={side} type="button" disabled={dragging} onClick={() => changeTransform(cableTowerPlacement(studio.body, object, side))} className={buttonClass}>{t(label)}</button>)}</div><div className="flex flex-wrap gap-2">{[-90, 90].map(turn => <button key={turn} type="button" disabled={dragging} onClick={() => changeTransform({ ...object, rotationY: ((object.rotationY + turn + 540) % 360) - 180 })} className={buttonClass}>{t(turn < 0 ? "Turn tower left" : "Turn tower right")}</button>)}</div></fieldset>}
          {bodyLocked && activeMachine ? <div className="mt-3 space-y-3 text-xs">
            <p>{t("The figure follows")} <span data-workshop-translate="false">{activeMachine.name}</span>{t(". Select the machine to move it or change travel.")}</p>
            <button type="button" onClick={() => selectObject({ kind: "object", id: activeMachine.id })} className={buttonClass}>{t("Select machine")}</button>
            <button type="button" onClick={() => updateObject(activeMachine.id, { machineUse: false })} className={buttonClass}>{t("Stop using machine to pose freely")}</button>
          </div> : <>
            <p className="mb-3 mt-1 text-xs text-muted-foreground">{placementLocked ? t("Placement is locked while editing travel. Use Stop animation and edit placement to reposition the machine.") : `Place ${object ? "this item" : "the figure"} using the buttons or coordinates.`}</p>
            <div className="flex gap-2"><button type="button" aria-pressed={tool === "select"} onClick={() => chooseTool("select")} className={`${buttonClass} ${tool === "select" ? "bg-primary/10 text-primary" : ""}`}><Hand size={14} />{t("Move")}</button><button type="button" aria-pressed={tool === "rotate"} onClick={() => chooseTool("rotate")} className={`${buttonClass} ${tool === "rotate" ? "bg-primary/10 text-primary" : ""}`}><Rotate3D size={14} />{t("Rotate")}</button></div>
            <div className="mt-2 flex gap-2"><button type="button" disabled={placementLocked} onClick={() => nudgeHeight(0.1)} className={buttonClass}><ArrowUp size={14} />{t("Up")}</button><button type="button" disabled={placementLocked} onClick={() => nudgeHeight(-0.1)} className={buttonClass}><ArrowDown size={14} />{t("Down")}</button></div>
          </>}
          {!selectedJoint && !bodyLocked && <WorkshopDisclosure key={`${object?.id ?? "body"}-${panel}`} title="Precise placement">
            <TransformFields value={selectedTransform} onChange={changeTransform} positionOnly disabled={placementLocked} />
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={snap} onChange={event => setSnap(event.target.checked)} />{t("Snap to grid")}</label>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={() => chooseTool("translate")} className={buttonClass}><Move3D size={14} />{t("3D arrows")}</button><button type="button" onClick={() => chooseTool("scale")} className={buttonClass}>{t("Resize")}</button></div>
            {object && <label className="block text-xs font-semibold">{t("Item name")}<input aria-label={t("Item name")} value={object.name} maxLength={60} onChange={event => updateObject(object.id, { name: event.target.value })} className={inputClass} /></label>}
            <TransformFields value={selectedTransform} onChange={changeTransform} disabled={placementLocked} />
            {object && <button type="button" onClick={duplicate} disabled={studio.objects.length >= 20} className={buttonClass}>{t("Duplicate")}</button>}
          </WorkshopDisclosure>}
          <WorkshopDisclosure title="Drag options"><fieldset className="flex flex-wrap gap-2"><legend className="sr-only">{t("Object drag direction")}</legend>{(["view", "floor"] as const).map(plane => <button type="button" key={plane} disabled={dragging} aria-pressed={dragPlane === plane} onClick={() => setDragPlane(plane)} className={`${buttonClass} ${dragPlane === plane ? "border-primary bg-primary/10 text-primary" : ""}`}>{plane === "view" ? t("Across view · includes height") : t("Along floor")}</button>)}</fieldset><label className="flex items-center gap-2 px-1 text-xs font-semibold">{t("Sensitivity")}<input aria-label={t("Movement sensitivity")} type="range" min={10} max={100} step={5} value={Math.round(sensitivity * 100)} onChange={event => changeSensitivity(Number(event.target.value) / 100)} disabled={dragging} className="w-20 accent-primary" />
        <output className="w-8 tabular-nums">{Math.round(sensitivity * 100)}%</output>
      </label></WorkshopDisclosure>
          </InspectorSection>}
</WorkshopToolPanel>

        </section>
        <WorkshopToolPanel tool="settings" selected={panel}>
        {scene.equipment && <section className="rounded-xl border p-3 text-xs"><p className="font-semibold">{equipmentOptions.find(item => item.slug === scene.equipment?.slug)?.label ?? scene.equipment.slug} {t("· demo equipment")}</p><button type="button" onClick={() => update({ ...scene, equipment: null })} className={`${buttonClass} mt-2`}>{t("Remove demo equipment")}</button></section>}
        <details name="workshop-dropdown" className="border-t border-border pt-3"><summary className="cursor-pointer text-xs font-semibold text-muted-foreground">{t("Advanced settings")}</summary><div className="mt-4 space-y-4">

          <label className="block text-xs font-semibold">{t("Movement setup")}<select value={scene.motionStyle ?? "free"} onChange={event => update({ ...scene, studio: { ...studio, seating: undefined }, motionStyle: event.target.value as WorkshopScene["motionStyle"] })} className={inputClass}>
            <option value="free">{t("Free posing")}</option><option value="squat">{t("Squat — feet planted")}</option><option value="hinge">{t("Hip hinge — feet planted")}</option><option value="row">{t("Bent-over row")}</option><option value="split-squat">{t("Stationary lunge")}</option><option value="bench-press">{t("Incline bench press")}</option><option value="seated-curl">{t("Seated biceps curl")}</option><option value="incline-curl">{t("Incline dumbbell curl")}</option>
          </select></label>
          {!!equipmentOptions.length && <label className="block text-xs font-semibold">{t("Legacy demo equipment")}<select value={scene.equipment?.slug ?? ""} onChange={event => {
            const next = { ...scene, equipment: event.target.value ? { slug: event.target.value as NonNullable<WorkshopScene["equipment"]>["slug"], x: 0, y: 0, z: 0, scale: 1 } : null };
            update(makeLegacyBarbellEditable(next, crypto.randomUUID()));
          }} className={inputClass}><option value="">{t("None")}</option>{equipmentOptions.map(item => <option key={item.slug} value={item.slug}>{item.label}</option>)}</select></label>}
          <AnnotationFields annotations={scene.annotations ?? []} durationMs={scene.durationMs} actions={jointActions} onChange={annotations => update({ ...scene, annotations })} />
        </div></details></WorkshopToolPanel>
      </aside></div>
    </div>
    {(status || tutorial.open) && <div className={status?.startsWith("Removed") || tutorial.open ? "flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-sm text-muted-foreground" : "sr-only"}>{status && <p role="status">{t(status)}</p>}{status?.startsWith("Removed") && <button type="button" onClick={undo} disabled={!past.length} className={buttonClass}>{t("Undo removal")}</button>}{tutorial.open && <span>{t("Camera looks around · Edit changes the scene")}</span>}</div>}
  {tutorial.open && <WorkshopTutorial root={workshopRoot} step={tutorial.step} onStep={index => { setMode("quick"); setStep(index); setPreviewOpen(true); setFocusMode(false); tutorial.update({ open: true, step: index }); }} onClose={closeTutorial} />}</div></>)}</WorkshopCommitMetrics></WorkshopGuidanceProvider></WorkshopLanguageProvider>;
}
