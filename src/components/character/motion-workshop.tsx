"use client";
import Link from "next/link";
import { createWorkshopLanguage } from "@/lib/motion/workshop-language";
import { WorkshopCommitMetrics } from "./workshop-commit-metrics";
import { WorkshopJointValues } from "./workshop-joint-values";
import { WorkshopPlaybackControls } from "./workshop-playback-controls";
import { useWorkshopHistory } from "./use-workshop-history";
import { useMotionPlayback } from "./use-motion-playback";
import { WorkshopFullscreenButton } from "./workshop-fullscreen-button";

import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Check, ChevronDown, Info, Plus, Redo2, Save, Scan, Trash2, Undo2 } from "@/components/ui/icons";
import { clampJointControlAngles, identityTransform, jointControlRange, jointControlValue, jointSlugs, sampleWorkshopPose, type BenchFacing, type JointAngles, type JointSlug, type SceneTransform, type StudioObject, type SupportContact, type SupportRegion, type WorkshopScene } from "@/lib/motion/workshop";
import type { AnatomyRig } from "@/lib/motion/anatomy";
import { bakeLegacySupportScene, bakeSupportRelease, evaluateSupportScene, previewSupportSceneReposition, supportRegionLabels, type SupportSolveReport } from "@/lib/motion/support-contacts";
import { changeBenchSupport, changeSupportContact, pickSupportContact, supportRegionForJoint } from "@/lib/motion/support-edit";
import { studioLayoutSchema } from "@/lib/motion/scene-schema";
import { WorkshopSupportControls } from "./workshop-support-controls";
import { constrainSupportToMesh } from "@/lib/motion/support-picking";
import { createSupportSetup, supportSetups, supportSetupLabels } from "@/lib/motion/support-setups";
import { clamp, makeLegacyBarbellEditable, maxPulleyHeight, setStudioObjectAnimated, studioAttachmentSlots, updateStudioObjectTransform } from "@/lib/motion/studio";
import { automaticWeightTransform } from "@/lib/motion/automatic-weight-grip";
import { canCarryWithArm, carryHeldWeights, editHeldWeightPose, createHeldWeightPoseSampler } from "@/lib/motion/held-weight-pose";
import { carryHeldWeightsWithBody } from "@/lib/motion/held-weight-body";
import { captureFirstWorkshopPose, hasIndependentWorkshopMotion, workshopPoseSignature } from "@/lib/motion/workshop-recording";
import { equipmentLabel } from "@/lib/motion/equipment-label";
import { equipmentGripHands, normalizeEquipmentContacts } from "@/lib/motion/equipment-capabilities";
import { jointEditChanges } from "@/lib/motion/joint-edit";
import { addWorkshopEquipment, cableTowerPlacement, createFreeCableSetup, editWorkshopMoment, freeWorkshopBody } from "@/lib/motion/workshop-freedom";
import { resetWorkshopJoints } from "@/lib/motion/workshop-pose";
import { isStudioMachine, machineContactDescriptions, machineTravelLabels, rowHandleHeight, setMachineHandleHeight, setMachinePosition, setPecDeckMode, type MachineReachReport } from "@/lib/motion/studio-machines";
import { editLeverMachinePose, releasePlateRowFeet } from "@/lib/motion/plate-row-pose";
import { releaseTBarFeet } from "@/lib/motion/t-bar-row-pose";
import { rowUsesHand } from "@/lib/motion/plate-row";
import { WorkshopPlateRowControls } from "./workshop-plate-row-controls";
import { WorkshopSeatingControls } from "./workshop-seating-controls";
import { activeSeat, constrainSeatedEdit, releaseSeatedFeet, resetSeatPose, setSeatOffsets } from "@/lib/motion/seated-pose";
import { editShoulderWithElbow } from "@/lib/motion/shoulder-follow";
import { addEvenlySpacedWorkshopFrames, captureWorkshopFrame, pasteWorkshopFrame, deleteWorkshopFrame, retimeWorkshopFrame, type WorkshopFrameClipboard } from "@/lib/motion/timeline";
import { automaticWristAngles } from "@/lib/motion/equipment-motion";
import { constrainFrontalPose, materializeArmDrivenWeight, materializeReleasedArmWeights, resolveStudioObject, setCableAttachment, setFrontalPlane } from "@/lib/motion/studio-constraints";
import { MotionCanvas } from "./motion-canvas";
import { moveMachineWithMouse, type StudioDragPlane } from "@/lib/motion/workshop-mouse";
import { AnnotationFields } from "./annotation-fields";
import type { StudioEditor, StudioSelection } from "./studio-controls";
import { WorkshopEquipmentPicker } from "./workshop-equipment-picker";
import { WorkshopNumberField } from "./workshop-number-field";
import { WorkshopBandControls } from "./workshop-band-controls";
import { detachBandAnchors } from "@/lib/motion/studio-band";
import { WorkshopFineAdjustment, WorkshopManipulationControls, type WorkshopManipulationTool } from "./workshop-manipulation-controls";
import { WorkshopRecoveryNotice } from "./workshop-recovery-notice";
import { WorkshopNameDialog } from "./workshop-name-dialog";
import { WorkshopGestureRange } from "./workshop-gesture-range";
import { useWorkshopDraft } from "./use-workshop-draft";
import { WorkshopGestureScene } from "@/lib/motion/workshop-gesture";
import { workshopEditorMode, workshopEditorFlags, type WorkshopEditorMode } from "@/lib/motion/workshop-editor-mode";
import { WorkshopJointPicker } from "./workshop-joint-picker";
import { WorkshopGripControls } from "./workshop-grip-controls";
import { WorkshopGripEditor } from "./workshop-grip-editor";
import { setGripOffset, type GripSide } from "@/lib/motion/grip-edit";
import { changeGripAttachment } from "@/lib/motion/studio-grip";
import { WorkshopLanguageProvider, useWorkshopLanguage } from "./workshop-language";
import { copyWorkshopPose, createQuickScene, mirrorWorkshopPose, matchWorkshopLoop, workshopDemonstrationCaption } from "@/lib/motion/quick-create";
import { isWorkshopPlacementLocked } from "@/lib/motion/workshop-placement";
import { limbPoseBlock, poseLimbs, type PoseLimb } from "@/lib/motion/limb-pose";
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
import { WorkshopToolNavigation, WorkshopToolPanel, workshopTools, type WorkshopTool } from "./workshop-tool-navigation";
import { WorkshopCableControls } from "./workshop-cable-controls";
import { WorkshopDisclosure } from "./workshop-disclosure";
import { WorkshopPoseFeedback, type WorkshopPoseFeedbackKind } from "./workshop-pose-feedback";
import { WorkshopPlacementWarning } from "./workshop-placement-warning";

const jointNames: Record<JointSlug, string> = {
  torso: "Torso", "left-shoulder": "Left shoulder", "right-shoulder": "Right shoulder",
  "left-elbow": "Left elbow", "right-elbow": "Right elbow", "left-hip": "Left hip",
  "right-hip": "Right hip", "left-knee": "Left knee", "right-knee": "Right knee",
  "left-wrist": "Left wrist", "right-wrist": "Right wrist",
  "left-ankle": "Left ankle", "right-ankle": "Right ankle",
};
const label = (milliseconds: number) => `${(milliseconds / 1000).toFixed(2)}s`;
const inputClass = "mt-1 min-h-11 w-full min-w-0 rounded-lg border border-border bg-background p-2 text-base font-normal";
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-base font-semibold transition-[filter,background-color] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40 aria-pressed:bg-accent aria-pressed:text-accent-foreground";
const menuRowClass = "flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-start text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40";

function TransformFields({ value, onChange, positionOnly = false, disabled = false, rotationDisabled = false }: { value: SceneTransform; onChange: (value: SceneTransform) => void | boolean; positionOnly?: boolean; disabled?: boolean; rotationDisabled?: boolean }) {
  const { t } = useWorkshopLanguage();
  return <div className="space-y-4">
    {(positionOnly ? ["Position"] as const : ["Rotation"] as const).map(kind => <fieldset key={kind}>
      <legend className="text-xs font-semibold text-muted-foreground">{t(kind)}{kind === "Rotation" ? t(" · degrees") : t(" · meters")}</legend>
      <div className="mt-2 grid grid-cols-1 gap-3">{(["x", "y", "z"] as const).map(axis => {
        const field = kind === "Position" ? axis : `rotation${axis.toUpperCase()}` as "rotationX" | "rotationY" | "rotationZ";
        const min = kind === "Rotation" ? -180 : axis === "y" ? -3 : -10, max = kind === "Rotation" ? 180 : 10;
        return <WorkshopNumberField key={axis} label={t(`${kind} ${axis.toUpperCase()} ${kind === "Position" ? "meters" : "degrees"}`)} value={kind === "Position" ? Number(value[field].toFixed(3)) : value[field]} maximumFractionDigits={kind === "Rotation" ? 2 : 3} min={min} max={max} step={kind === "Position" ? 0.1 : 1} disabled={disabled || kind === "Rotation" && rotationDisabled} onChange={next => onChange({ ...value, [field]: next })} />;
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
  const workshopRoot = useRef<HTMLDivElement>(null);
  // Keep the legacy object's UUID identical during server rendering and hydration.
  const [startingScene] = useState(() => normalizeEquipmentContacts(makeLegacyBarbellEditable(initialScene, privateId ?? ownerId)));
  const [scene, setScene] = useState(startingScene);
  const [gesture] = useState(() => new WorkshopGestureScene());
  const liveScene = useRef(scene);
  useLayoutEffect(() => { liveScene.current = scene; }, [scene]);
  const [firstPoseInitialized, setFirstPoseInitialized] = useState(!!privateId);
  const [recordedPoses, setRecordedPoses] = useState<Record<number, string>>(() => privateId
    ? Object.fromEntries(startingScene.keyframes.map(frame => [frame.timeMs, workshopPoseSignature(startingScene, frame.timeMs)])) : {});
  const [name, setName] = useState(initialName);
  const [nameRequest, setNameRequest] = useState<{ continueToDetails: boolean } | null>(null);
  const [manualSaveRequests, setManualSaveRequests] = useState(0);
  const [panel, setPanel] = useState<WorkshopTool>("equipment");
  const [gripEdit, setGripEdit] = useState<{ objectId: string; side: GripSide; picking: boolean } | null>(null);
  const [supportRegion, setSupportRegion] = useState<SupportRegion>("left-hand");
  const [supportEdit, setSupportEdit] = useState<StudioEditor["supportEdit"]>(null);
  const [supportRepositioning, setSupportRepositioning] = useState(false);
  const [supportError, setSupportError] = useState<string | undefined>();
  const [supportReports, setSupportReports] = useState<SupportSolveReport[]>([]);
  const supportRig = useRef<AnatomyRig | null>(null);
  const onSupportRigReady = useCallback((rig: AnatomyRig | null) => { supportRig.current = rig; }, []);
  const onSupportReachChange = useCallback((reports: SupportSolveReport[]) => setSupportReports(reports), []);
  const [viewControlsTarget, setViewControlsTarget] = useState<HTMLDivElement | null>(null);
  const [exampleMachineId, setExampleMachineId] = useState<string | null>(null);
  const [language, setLanguage] = useState<"en" | "he">("en");
  const { t } = useMemo(() => createWorkshopLanguage(language), [language]);
  const [editorMode, dispatchEditor] = useReducer(workshopEditorMode, { mode: "select" });
  const { interactionMode, tool, posing, limbPosing, freeDragging } = workshopEditorFlags(editorMode);
  const enterEditor = (state: WorkshopEditorMode) => dispatchEditor({ type: "enter", state });
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
  const [bothSides, setBothSides] = useState(true);
  const [elbowFollowsShoulder, setElbowFollowsShoulder] = useState(false);
  const [copyTarget, setCopyTarget] = useState(0);
  const [posesPerHalf, setPosesPerHalf] = useState(5);
  const poseClipboard = useRef<WorkshopFrameClipboard | null>(null);
  const timelineRows = useRef<HTMLDivElement>(null);
  const pendingFrameFocus = useRef<number | null>(null);
  const focusFrame = (index: number) => { pendingFrameFocus.current = index; };
  useLayoutEffect(() => {
    if (pendingFrameFocus.current === null) return;
    timelineRows.current?.querySelectorAll<HTMLButtonElement>("button")[pendingFrameFocus.current]?.focus({ preventScroll: true });
    pendingFrameFocus.current = null;
  });
  const addButton = useRef<HTMLButtonElement>(null);
  const shortcutHelp = useRef<HTMLDetailsElement>(null);
  const historyHelp = useRef<HTMLDetailsElement>(null);
  const moreHelp = useRef<HTMLDetailsElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
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
  const [selection, setSelection] = useState<StudioSelection>(null);
  const [lockedItemIds, setLockedItemIds] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [equipmentPickerView, setEquipmentPickerView] = useState<"popular" | "all">("popular");
  const [nudgeDistance, setNudgeDistance] = useState(0.01);
  const [nudgeAngle, setNudgeAngle] = useState(1);
  const [limbNudge, setLimbNudge] = useState<StudioEditor["limbNudge"]>();
  const nudgeId = useRef(0);
  const [limbWarning, setLimbWarning] = useState<WorkshopPoseFeedbackKind | null>(null);
  const [gripReach, setGripReach] = useState<Record<string, boolean>>({});
  const [machineReach, setMachineReach] = useState<MachineReachReport>();
  const onMachineReach = useCallback((report: MachineReachReport | undefined) => setMachineReach(report), []);
  const [captureElbow, setCaptureElbow] = useState<StudioEditor["captureElbow"]>(null);
  const [snap, setSnap] = useState(false);
  const [sensitivity, setSensitivity] = useState(0.35);
  const { clock: playback, timeMs, playing, setTimeMs, setPlaying } = useMotionPlayback(scene.durationMs, speed, false);
  const [dragging, setDragging] = useState(false);
  const [dragPlane, setDragPlane] = useState<StudioDragPlane>("view");
  const dragSession = useRef<{ scene: WorkshopScene; latest: WorkshopScene; timeMs: number; afterCommit?: (next: WorkshopScene) => void } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [mobileEditing, setMobileEditing] = useState(false);
  const [frameError, setFrameError] = useState<string | null>(null);
  const history = useWorkshopHistory();
  const { past, future, record } = history;
  const poseSignatures = useMemo(() => new Map([...new Set([0, scene.durationMs / 2, ...scene.keyframes.map(frame => frame.timeMs)])]
    .map(time => [time, workshopPoseSignature(scene, time)])), [scene]);
  const hasUnsavedPoses = scene.keyframes.some(frame => recordedPoses[frame.timeMs] !== poseSignatures.get(frame.timeMs));
  const draft = useWorkshopDraft({ ownerId, privateId, initialScene: startingScene, initialName, scene, name, firstPoseInitialized, gesture, paused: dragging || adjusting || supportRepositioning || !!captureElbow || hasUnsavedPoses });
  const savedId = draft.savedId;
  const pending = draft.saving || manualSaveRequests > 0;
  const studio = scene.studio ?? { body: identityTransform, objects: [] };
  const selectedSupport = studio.supports?.find(contact => contact.region === supportRegion);
  const rootSupport = studio.supports?.find(contact => ["pelvis", "chest", "back"].includes(contact.region));
  const current = scene.keyframes[Math.min(selectedFrame, scene.keyframes.length - 1)];
  const rawObject = selection?.kind === "object" ? studio.objects.find(item => item.id === selection.id) : undefined;
  const object = useMemo(() => rawObject ? resolveStudioObject(scene, rawObject, current.timeMs) : undefined, [scene, rawObject, current.timeMs]);
  const selectedJoint = selection?.kind === "joint" ? selection.slug : null;
  const jointControlName = selectedJoint ? bothSides && selectedJoint !== "torso" ? `Both ${selectedJoint.split("-")[1]}s` : jointNames[selectedJoint] : "";
  const activeMachine = studio.objects.find(item => item.machineUse);
  const seatedBench = studio.objects.find(item => item.id === studio.seating?.benchId && item.slug === "bench");
  const placementLockedIds = studio.objects.filter(item => lockedItemIds.includes(item.id) || isWorkshopPlacementLocked(item)).map(item => item.id);
  const placementLocked = !!object && placementLockedIds.includes(object.id);
  const [placementOverlaps, setPlacementOverlaps] = useState<Record<string, boolean>>({});
  const onPlacementOverlap = useCallback((id: string, overlap: boolean) => setPlacementOverlaps(previous => previous[id] === overlap ? previous : { ...previous, [id]: overlap }), []);
  const bodyLocked = !object && !selectedJoint && !!(activeMachine || seatedBench || rootSupport);
  const weightForJoint = (slug: JointSlug) => studio.objects.find(item => {
    if (item.machineUse) {
      if (item.slug === "smith-machine") return true;
      if (item.slug === "t-bar-row-machine") return slug === "torso" || /-(hip|knee|ankle)$/.test(slug) ? item.rowFootSupport !== false || slug === "torso" : rowUsesHand(item, slug.startsWith("left") ? "left" : "right");
      if (slug === "torso") return false;
      if (/-(hip|knee|ankle)$/.test(slug)) return item.slug === "leg-press";
      return !["row-machine", "shoulder-press-machine", "chest-press-machine"].includes(item.slug) && !(item.slug === "cable-row-machine" && item.cableAttachment && slug.endsWith("wrist"));
    }
    return ["barbell", "dumbbell", "kettlebell"].includes(item.slug) && /-(shoulder|elbow)$/.test(slug)
      && (item.attachment === (slug.startsWith("left") ? "left" : "right") || item.attachment === "both");
  });
  const controllingWeight = selectedJoint ? weightForJoint(selectedJoint) : undefined;
  const blockedJoints = jointSlugs.filter(slug => {
    const weight = weightForJoint(slug);
    if (elbowFollowsShoulder && slug.endsWith("shoulder") && weight?.machineUse && isStudioMachine(weight.slug) && weight.slug !== "leg-press") return false;
    return !!weight && (!canCarryWithArm(weight) || !!scene.motionStyle && scene.motionStyle !== "free");
  });
  const jointBlocked = !!selectedJoint && Object.keys(jointEditChanges(selectedJoint, { x: 0, y: 0, z: 0 }, bothSides)).some(slug => blockedJoints.includes(slug as JointSlug));
  const blockedLimbs = poseLimbs.filter(limb => limbPoseBlock(scene, limb));
  const limbBlockReasons = [...new Set(blockedLimbs.map(limb => limbPoseBlock(scene, limb)))];
  const isWrist = selectedJoint?.endsWith("wrist") ?? false;
  const isElbow = selectedJoint?.endsWith("elbow") ?? false;
  const isKnee = selectedJoint?.endsWith("knee") ?? false;
  const isAnkle = selectedJoint?.endsWith("ankle") ?? false;
  const frontalShoulder = !!studio.frontalPlane && !!selectedJoint?.endsWith("shoulder");
  const [inspectorSampler] = useState(createHeldWeightPoseSampler);
  useEffect(() => () => inspectorSampler.dispose(), [inspectorSampler]);
  const heldPose = useMemo(() => panel === "pose" && selectedJoint && !playing
    ? inspectorSampler.sample(scene, timeMs) : sampleWorkshopPose(scene.keyframes, timeMs), [scene, timeMs, panel, selectedJoint, playing, inspectorSampler]);
  const jointAngles = selectedJoint ? heldPose[selectedJoint] ?? (isWrist ? automaticWristAngles(scene) : { x: 0, y: 0, z: 0 }) : { x: 0, y: 0, z: 0 };

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
    // Drag callbacks report absolute transforms/poses against their starting
    // scene. Carrying from the previous preview would apply that delta twice.
    const before = dragSession.current?.scene ?? scene;
    next = normalizeEquipmentContacts(next);
    try {
      if (!dragSession.current && next.studio?.supports?.length) {
        const valid = studioLayoutSchema.safeParse(next.studio);
        if (!valid.success) throw new Error(valid.error.issues[0]?.message ?? "This edit conflicts with a body support.");
      }
      next = materializeReleasedArmWeights(before, next, current.timeMs);
      next = carryHeldWeightsWithBody(before, next);
    }
    catch (error) { setEditError(error instanceof Error ? error.message : "Could not move held weights."); return false; }
    if (dragSession.current) {
      dragSession.current.latest = next;
      liveScene.current = next;
      gesture.update(next);
      return true;
    }
    if (JSON.stringify(next) === JSON.stringify(scene)) return true;
    if ((current.timeMs !== 0 || poseScope === "all" || next.keyframes.length !== before.keyframes.length)
      && hasIndependentWorkshopMotion(before, next)) setFirstPoseInitialized(true);
    record({ scene, label: historyLabel ?? describeWorkshopChange(scene, next) });
    liveScene.current = next;
    setScene(next); setEditError(null); setStatus("Unsaved changes");
    return true;
  };
  const updateContacts = (build: () => WorkshopScene, historyLabel?: string): boolean => {
    try {
      const next = build();
      if (next.studio?.supports?.length) {
        const result = studioLayoutSchema.safeParse(next.studio);
        if (!result.success) throw new Error(result.error.issues[0]?.message ?? "This contact conflicts with an existing support.");
      }
      return update(next, historyLabel);
    }
    catch (error) { setEditError(error instanceof Error ? error.message : "Could not change this grip."); return false; }
  };
  const beginDrag = (blocking = true) => {
    if (dragSession.current) return;
    const before = liveScene.current;
    const at = Math.round(playback.timeMs);
    if (!gesture.begin(before, at)) return;
    dragSession.current = { scene: before, latest: before, timeMs: at };
    setEditError(null);
    if (blocking) setDragging(true);
    else setAdjusting(true);
  };
  const endDrag = useCallback((cancelled = false) => {
    const session = dragSession.current;
    const result = gesture.finish(cancelled);
    if (result) {
      liveScene.current = result.scene;
      if (cancelled) setLimbWarning(null);
      else if (result.changed) {
        if (((session?.timeMs ?? 0) !== 0 || poseScope === "all" || result.scene.keyframes.length !== result.before.keyframes.length)
          && hasIndependentWorkshopMotion(result.before, result.scene)) setFirstPoseInitialized(true);
        record({ scene: result.before, label: describeWorkshopChange(result.before, result.scene) });
        session?.afterCommit?.(result.scene);
        setScene(result.scene); setEditError(null); setStatus("Unsaved changes");
      }
    }
    dragSession.current = null; setDragging(false); setAdjusting(false);
  }, [gesture, poseScope, record]);
  const cancelSupportEdit = () => {
    if (dragSession.current) endDrag(true);
    setSupportEdit(null); setSupportRepositioning(false); setSupportError(undefined);
  };
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
    setGripEdit(null);
    setPlaying(false); enterEditor({ mode: "free", showJoints: false });
    if (at !== undefined) {
      const index = scene.keyframes.findIndex(frame => frame.timeMs === at);
      if (index >= 0) setSelectedFrame(index);
      setTimeMs(at);
    }
    if (activeMachine) {
      setSelection({ kind: "object", id: activeMachine.id });
    }
  };
  const enableLimbPosing = () => {
    setGripEdit(null);
    setPlaying(false); dispatchEditor({ type: "choose", tool: "limbs" });
    setSelection({ kind: "body" }); setLimbWarning(null);
    const index = scene.keyframes.findIndex(frame => frame.timeMs === Math.round(timeMs));
    if (index >= 0) setSelectedFrame(index);
  };
  const restore = (next: WorkshopScene) => {
    next = normalizeEquipmentContacts(next);
    const frameIndex = Math.min(selectedFrame, next.keyframes.length - 1);
    setScene(next); setSelectedFrame(frameIndex); setTimeMs(next.keyframes[frameIndex].timeMs); setPlaying(false); setFrameError(null); setStatus("Unsaved changes");
  };
  const undo = () => { if (supportRepositioning) { cancelSupportEdit(); return; } if (!past.length || dragging || adjusting) return; const entry = history.undo(scene)!; restore(entry.scene); setStatus(`Undid ${entry.label}`); };
  const redo = () => { if (supportRepositioning) { cancelSupportEdit(); return; } if (!future.length || dragging || adjusting) return; const entry = history.redo(scene)!; restore(entry.scene); setStatus(`Redid ${entry.label}`); };
  const selectFrame = (index: number) => { cancelSupportEdit(); setPlaying(false); setSelectedFrame(index); setTimeMs(scene.keyframes[index].timeMs); setFrameError(null); };
  const currentPoseSaved = recordedPoses[current.timeMs] === poseSignatures.get(current.timeMs);
  const savePose = () => {
    if (dragging || adjusting || captureElbow) return;
    if (recordedPoses[0] === undefined && selectedFrame !== 0) { selectFrame(0); setStatus("Capture the start before the finish."); return; }
    const next = firstPoseInitialized ? scene : captureFirstWorkshopPose(scene);
    if (!update(next, current.timeMs === 0 ? "Capture start" : "Capture pose")) return;
    setFirstPoseInitialized(true);
    setRecordedPoses(previous => ({ ...previous,
      ...(current.timeMs === 0 && previous[scene.durationMs] === undefined
        ? { [next.durationMs]: workshopPoseSignature(next, next.durationMs) } : {}),
      [current.timeMs]: workshopPoseSignature(next, current.timeMs),
    }));
    setPlaying(false); setTimeMs(current.timeMs); setStatus(firstPoseInitialized && current.timeMs === 0
      ? "Start captured. Existing finish kept; use Copy pose to replace it."
      : "Pose captured. Save exercise stores it in your account.");
  };
  const previewTime = (time: number) => {
    cancelSupportEdit();
    setPlaying(false); setTimeMs(time);
    const index = scene.keyframes.findIndex(frame => frame.timeMs === Math.round(time));
    if (index >= 0) setSelectedFrame(index);
  };
  const poseMoment = (time: number) => {
    setGripEdit(null);
    try {
      const moment = editWorkshopMoment(scene, Math.round(time));
      update(moment.scene); setSelectedFrame(moment.index); setPlaying(false); setTimeMs(Math.round(time));
    } catch (error) { setEditError(error instanceof Error ? error.message : "Unable to edit this moment."); return; }
    setPoseScope("selected"); enterEditor({ mode: "limbs", drag: "arrows" });
    setSelection({ kind: "body" }); setLimbWarning(null);
  };
  const selectObject = (next: StudioSelection) => {
    setGripEdit(null);
    if (supportRepositioning) cancelSupportEdit();
    setSupportEdit(null); setSupportError(undefined);
    if (next?.kind === "joint") setSupportRegion(supportRegionForJoint(next.slug));
    setLimbNudge(undefined);
    const endpoint = next?.kind === "joint" && (next.slug.endsWith("wrist") || next.slug.endsWith("ankle"));
    dispatchEditor({ type: "select", target: endpoint ? "endpoint" : next?.kind ?? "none" });
    setSelection(next); setPlaying(false);
    if (next?.kind === "joint") { setPanel("pose"); }
    else if (next?.kind === "object" && ["equipment", "pose"].includes(panel)) {
      const item = studio.objects.find(item => item.id === next.id);
      setPanel(item && ["bench", "barbell", "dumbbell", "kettlebell", "cable-machine"].includes(item.slug) || item && isStudioMachine(item.slug) ? "contact" : "placement");
    }
  };
  const activateObject = (next: StudioSelection) => {
    if (dragging || captureElbow) return;
    selectObject(next);
    const item = next?.kind === "object" ? studio.objects.find(item => item.id === next.id) : undefined;
    setPanel(item && (["bench", "barbell", "dumbbell", "kettlebell", "cable-machine"].includes(item.slug) || isStudioMachine(item.slug)) ? "contact" : "placement");
    workshopRoot.current?.focus({ preventScroll: true });
  };
  const setPose = (slug: JointSlug, angles: JointAngles, editedAxis?: "x" | "y" | "z") => {
    const changes = jointEditChanges(slug, clampJointControlAngles(slug, angles), bothSides);
    if (Object.keys(changes).some(joint => blockedJoints.includes(joint as JointSlug))) return;
    try {
      const at = Math.round(playback.timeMs);
      const moment = editWorkshopMoment(scene, at);
      if (Object.keys(changes).some(joint => /-(hip|knee|ankle)$/.test(joint))) moment.scene = releaseSeatedFeet(moment.scene);
      let next: WorkshopScene;
      if (elbowFollowsShoulder && slug.endsWith("shoulder")) {
        const balancedDumbbell = bothSides && studio.objects.some(item => item.slug === "dumbbell" && item.attachment === "both");
        next = editShoulderWithElbow(moment.scene, moment.index, poseScope === "all", changes, editedAxis, balancedDumbbell ? undefined : slug.startsWith("right-") ? "right" : "left");
      } else if (studio.objects.some(item => ["row-machine", "shoulder-press-machine", "chest-press-machine"].includes(item.slug) && (item.machineUse || item.attachment !== "none"))) {
        next = editLeverMachinePose(moment.scene, moment.index, poseScope === "all", changes);
      } else if (studio.objects.some(item => ["dumbbell", "barbell", "kettlebell"].includes(item.slug) && item.attachment !== "none")) {
        const balancedDumbbell = bothSides && studio.objects.some(item => item.slug === "dumbbell" && item.attachment === "both");
        const anchorSide = balancedDumbbell ? undefined : slug.startsWith("right-") ? "right" : slug.startsWith("left-") ? "left" : undefined;
        next = editHeldWeightPose(moment.scene, moment.index, poseScope, changes, anchorSide, editedAxis);
      } else {
        const wristDefault = slug.endsWith("wrist") ? automaticWristAngles(scene) : undefined;
        next = { ...moment.scene, motionStyle: "free", keyframes: moment.scene.keyframes.map((frame, index) => {
          if (index === moment.index || poseScope === "all") return { ...frame, poses: constrainFrontalPose({ ...frame.poses, ...changes }, studio.frontalPlane) };
          return wristDefault && !frame.poses[slug] ? { ...frame, poses: { ...frame.poses, [slug]: wristDefault } } : frame;
        }) };
      }
      next = constrainSeatedEdit(moment.scene, next, at);
      if (!update(next)) return;
      if (poseScope === "selected" && Object.keys(changes).every(joint => joint.endsWith("wrist"))) {
        const preserveRecorded = (completed: WorkshopScene) => {
          const preserved = completed.keyframes.filter(frame => frame.timeMs !== at &&
            (!scene.keyframes.some(existing => existing.timeMs === frame.timeMs) ||
              recordedPoses[frame.timeMs] === workshopPoseSignature(scene, frame.timeMs)));
          setRecordedPoses(previous => ({ ...previous, ...Object.fromEntries(preserved.map(frame =>
            [frame.timeMs, workshopPoseSignature(completed, frame.timeMs)])) }));
        };
        if (dragSession.current) dragSession.current.afterCommit = preserveRecorded;
        else preserveRecorded(next);
      }
      setSelectedFrame(next.keyframes.findIndex(frame => frame.timeMs === at)); setPlaying(false); setTimeMs(at);
    } catch (error) { setEditError(error instanceof Error ? error.message : "Unable to edit this moment."); }
  };
  const updateObject = (id: string, changes: Partial<StudioObject>) => update({ ...scene, studio: { ...studio, objects: studio.objects.map(item => item.id === id ? { ...item, ...changes } : item) } });
  const changeMachineTravel = (position: number, side?: "left" | "right") => {
    if (!rawObject) return;
    const animated = setStudioObjectAnimated(rawObject, true, current.timeMs, scene.keyframes.map(frame => frame.timeMs));
    const next = { ...scene, studio: { ...studio, objects: studio.objects.map(item => item.id === rawObject.id ? setMachinePosition(animated, position, current.timeMs, side) : item) } };
    update(constrainSeatedEdit(scene, next, current.timeMs)); setPlaying(false); setTimeMs(current.timeMs);
  };
  const toggleItemLock = () => {
    if (!object || dragging || adjusting || playing) return;
    setLockedItemIds(ids => ids.includes(object.id) ? ids.filter(id => id !== object.id) : [...ids, object.id]);
  };
  const editGrip = (side: GripSide, picking = false) => {
    if (!object) return;
    setGripEdit({ objectId: object.id, side, picking });
    setPlaying(false); setTimeMs(current.timeMs); enterEditor({ mode: "select" });
  };
  const resetJoints = () => {
    setPlaying(false); setTimeMs(current.timeMs); setLimbWarning(null);
    update(carryHeldWeights(scene, resetWorkshopJoints(scene, selectedFrame, poseScope, blockedJoints)), "Reset all joints");
  };
  const leaveEquipment = () => {
    if (activeMachine?.slug === "cable-row-machine") {
      freeBody(); selectObject({ kind: "body" }); enterEditor({ mode: "move", showJoints: false }); setCaptureElbow(null); return;
    }
    update({ ...scene, motionStyle: "free", studio: { ...studio, seating: undefined,
      objects: studio.objects.map(item => item.machineUse ? { ...item, machineUse: false } : item) } });
    selectObject({ kind: "body" }); enterEditor({ mode: "move", showJoints: false }); setCaptureElbow(null);
  };
  const transformObject = (id: string, transform: SceneTransform) => {
    if (placementLockedIds.includes(id)) return false;
    try {
      return update({ ...scene, studio: { ...studio, objects: studio.objects.map(item => {
        if (item.id !== id) return item;
        const placed = materializeArmDrivenWeight(scene, item, current.timeMs);
        return { ...updateStudioObjectTransform(placed, transform, current.timeMs, Boolean(placed.frames?.length)), ...(["dumbbell", "barbell", "kettlebell"].includes(item.slug) && item.attachment !== "none" ? { poseDriver: "weight" as const } : {}), shoulderAlignment: undefined };
      }) } });
    } catch (error) { setEditError(error instanceof Error ? error.message : "Could not move held weights."); return false; }
  };
  const holdObject = (attachment: StudioObject["attachment"], reset = false) => {
    if (!object) return;
    if (attachment !== "none" && !equipmentGripHands(object).includes(attachment)) return;
    if (!reset && attachment === object.attachment) return;
    let contact: StudioObject;
    try { contact = changeGripAttachment(reset ? { ...rawObject!, gripOffsets: undefined } : rawObject!, attachment); }
    catch (error) { setEditError(error instanceof Error ? error.message : "Could not change this grip."); return; }
    const hands = studioAttachmentSlots({ ...object, attachment });
    if (!updateContacts(() => ({ ...scene, equipment: attachment === "none" ? scene.equipment : null, studio: { ...studio, objects: studio.objects.map(item => {
      if (item.id === object.id) {
        let placed = item;
        if (["barbell", "dumbbell", "kettlebell"].includes(item.slug) && attachment !== "none") {
          const times = scene.keyframes.map(frame => frame.timeMs);
          placed = { ...item, frames: undefined };
          for (const time of times) placed = updateStudioObjectTransform(placed, automaticWeightTransform(studio.body, contact, attachment, scene, time), time, true);
        }
        return { ...placed, ...(["row-machine", "t-bar-row-machine"].includes(item.slug) ? { rowGrip: item.rowGrip ?? "neutral" as const } : isStudioMachine(item.slug) ? { machineUse: false } : {}), ...(["dumbbell", "barbell", "kettlebell"].includes(item.slug) ? { poseDriver: attachment !== "none" && attachment !== "both" && item.slug === "dumbbell" ? "arm" as const : undefined } : {}), cableAttachment: item.slug === "cable-row-machine" ? item.cableAttachment ?? "straight-bar" : item.cableAttachment, attachment, gripOffsets: contact.gripOffsets, elbowLocks: undefined };
      }
      const released = attachment !== "none" && item.machineUse ? { ...item, machineUse: false } : item;
      return studioAttachmentSlots(released).some(hand => hands.includes(hand)) && attachment !== "none" ? { ...changeGripAttachment(released, "none"), elbowLocks: undefined } : released;
    }) } }))) return;
    setPlaying(false); setTimeMs(current.timeMs);
    setGripEdit(null); enterEditor({ mode: "select" });
  };
  const updateCableContact = (changes: StudioObject) => {
    const slots = studioAttachmentSlots(changes);
    if (!updateContacts(() => ({ ...scene, studio: { ...studio, objects: studio.objects.map(item => item.id === changes.id ? changes
      : studioAttachmentSlots(item).some(slot => slots.includes(slot)) ? { ...changeGripAttachment(item, "none"), elbowLocks: undefined } : item) } }))) return;
    setPlaying(false); setTimeMs(current.timeMs);
  };
  const cableControls = object && ["cable-machine", "cable-row-machine"].includes(object.slug) && <WorkshopCableControls object={object}
    onAttachment={attachment => updateCableContact(setCableAttachment(rawObject!.slug === "cable-row-machine" && !rawObject!.cableAttachment ? { ...rawObject!, attachment: ["d-handle", "cuff"].includes(attachment) ? "left" : "both" } : rawObject!, attachment))}
    onHold={holdObject} onCuffPosition={cuffPosition => updateCableContact({ ...rawObject!, cuffPosition })}
    palmTurns={{ left: current.poses["left-wrist"]?.x ?? automaticWristAngles(scene).x,
      right: current.poses["right-wrist"]?.x ?? automaticWristAngles(scene).x }}
    onPalmTurn={(side, x) => setPose(`${side}-wrist`, { ...(current.poses[`${side}-wrist`] ?? automaticWristAngles(scene)), x })}
    onJoint={slug => { selectObject({ kind: "joint", slug }); }} reachable={gripReach[object.id] !== false} />;
  const addObject = (slug: StudioObject["slug"]) => {
    if (supportRepositioning) cancelSupportEdit();
    if (studio.objects.length >= 20) { setStatus("The scene has 20 items. Remove an item before adding another."); return; }
    setExampleMachineId(null);
    const id = crypto.randomUUID();
    const machine = isStudioMachine(slug);
    if (!updateContacts(() => addWorkshopEquipment(scene, slug, id))) return;
    setSelection({ kind: "object", id }); enterEditor({ mode: "move", showJoints: false }); setAdding(false); setPlaying(false); setTimeMs(current.timeMs);
    setPanel(["bench", "barbell", "dumbbell", "kettlebell", "cable-machine"].includes(slug) || machine ? "contact" : "placement");
  };
  const freeCable = () => {
    const row = object?.slug === "cable-row-machine" ? object : studio.objects.find(item => item.slug === "cable-row-machine" && item.machineUse) ?? studio.objects.find(item => item.slug === "cable-row-machine");
    const id = row?.id ?? crypto.randomUUID();
    try { update(createFreeCableSetup(scene, id), "Use free cable"); }
    catch (error) { setEditError(error instanceof Error ? error.message : "Unable to add cable."); return; }
    setExampleMachineId(null); setSelection({ kind: "object", id }); setPlaying(false);
    setSelectedFrame(0); setTimeMs(0); setPanel("contact");
    enterEditor({ mode: "move", showJoints: false });
  };
  const freeBody = () => {
    const row = object?.slug === "cable-row-machine" ? rawObject : activeMachine?.slug === "cable-row-machine" ? activeMachine : undefined;
    if (!updateContacts(() => freeWorkshopBody(scene, row?.id), "Free body")) return;
    setPlaying(false); setTimeMs(current.timeMs); enterEditor({ mode: "select" }); setLimbWarning(null);
    if (row) setSelection({ kind: "object", id: row.id });
  };
  const duplicate = () => {
    if (!object || studio.objects.length >= 20) return;
    let released: StudioObject;
    try { released = changeGripAttachment(object, "none"); }
    catch (error) { setEditError(error instanceof Error ? error.message : "Could not change this grip."); return; }
    const copy = { ...released, machineUse: object.machineUse === undefined ? undefined : false, shoulderAlignment: undefined, frames: undefined, elbowLocks: undefined, id: crypto.randomUUID(), name: `${object.name.slice(0, 55)} copy`, x: clamp(object.x + 0.5, -10, 10) };
    update({ ...scene, studio: { ...studio, objects: [...studio.objects, copy] } }); setSelection({ kind: "object", id: copy.id });
  };
  const removeObject = () => {
    if (!object) return;
    try {
      let next = scene;
      for (const contact of studio.supports?.filter(contact => contact.objectId === object.id) ?? []) {
        if (!supportRig.current) throw new Error("Wait for the preview before removing supported equipment.");
        next = bakeSupportRelease(next, contact.region, supportRig.current);
      }
      const layout = detachBandAnchors(next.studio!, object.id, current.timeMs, resolveStudioObject(next, object, current.timeMs));
      if (update({ ...next, studio: { ...layout, seating: layout.seating?.benchId === object.id ? undefined : layout.seating, objects: layout.objects.filter(item => item.id !== object.id) } })) {
        setSelection({ kind: "body" }); setSupportEdit(null); setStatus(`Removed ${object.name}. Undo restores it.`);
      }
    } catch (error) { setEditError(error instanceof Error ? error.message : "Could not remove this support."); }
  };
  const addFrame = (clipboard?: WorkshopFrameClipboard) => {
    if (scene.keyframes.length >= 24) return;
    const next = scene.keyframes.findIndex(frame => frame.timeMs > timeMs);
    const insertAt = next < 0 ? scene.keyframes.length - 1 : Math.max(1, next);
    const before = scene.keyframes[insertAt - 1].timeMs, after = scene.keyframes[insertAt].timeMs;
    if (after - before < 2) return;
    const at = Math.round(timeMs) > before && Math.round(timeMs) < after ? Math.round(timeMs) : Math.round((before + after) / 2);
    let added = { ...scene, keyframes: [...scene.keyframes.slice(0, insertAt), { timeMs: at, poses: sampleWorkshopPose(scene.keyframes, at) }, ...scene.keyframes.slice(insertAt)] };
    if (clipboard) added = pasteWorkshopFrame(added, insertAt, clipboard);
    if (!update(added)) return;
    setSelectedFrame(insertAt); setTimeMs(at); setPlaying(false);
    focusFrame(insertAt);
  };
  const removeFrame = () => {
    if (scene.keyframes.length <= 2 || dragging) return;
    const next = deleteWorkshopFrame(scene, selectedFrame), index = Math.max(0, selectedFrame - 1);
    if (!update(next)) return;
    setSelectedFrame(index); setTimeMs(next.keyframes[index].timeMs); setPlaying(false); setFrameError(null); focusFrame(index);
  };
  const addSpacedFrames = () => {
    try {
      const next = addEvenlySpacedWorkshopFrames(scene, posesPerHalf);
      if (!update(next)) return;
      setSelectedFrame(next.keyframes.findIndex(frame => frame.timeMs === current.timeMs));
      setPlaying(false); setFrameError(null);
    } catch (error) { setFrameError(error instanceof Error ? error.message : "Could not add poses."); }
  };
  const editFrame = () => {
    setPlaying(false); setTimeMs(current.timeMs); setFrameError(null);
    if (activeMachine) { selectObject({ kind: "object", id: activeMachine.id }); enterEditor({ mode: "move", showJoints: false }); }
    else if (object) { enterEditor({ mode: "move", showJoints: false }); }
    else { selectObject({ kind: "joint", slug: selectedJoint ?? "torso" }); enterEditor({ mode: "rotate", showJoints: true }); }
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
    const objects = studio.objects.map(item => ({ ...item, frames: item.frames?.map(frame => ({ ...frame, timeMs: Math.round(frame.timeMs * ratio) })) }));
    const annotations = scene.annotations?.map(item => ({ ...item, startMs: Math.round(item.startMs * ratio), endMs: Math.round(item.endMs * ratio) }));
    const timelines = [keyframes, ...objects.map(item => item.frames ?? [])];
    if (timelines.some(frames => frames.some((frame, index) => index > 0 && frame.timeMs <= frames[index - 1].timeMs))
      || annotations?.some(item => item.endMs <= item.startMs)) {
      setEditError("Choose a longer time so nearby poses and movement notes stay separate.");
      return false;
    }
    if (!update({ ...scene, durationMs, keyframes, studio: { ...studio, objects }, annotations })) return false;
    setTimeMs(keyframes[selectedFrame].timeMs); setPlaying(false);
    return true;
  };
  const save = (continueToDetails = false, enteredName?: string) => {
    if (supportRepositioning) { setSupportError("Use position or cancel the preview before saving."); return; }
    if (captureElbow || dragging) return;
    setPlaying(false);
    if ((enteredName ?? name).trim().length < 2) {
      setNameRequest({ continueToDetails });
      return;
    }
    if (enteredName !== undefined) setName(enteredName);
    setNameRequest(null);
    setManualSaveRequests(count => count + 1);
    const active = document.activeElement;
    if (active instanceof HTMLElement && workshopRoot.current?.contains(active)) active.blur();
    requestAnimationFrame(() => {
      void draft.saveNow(enteredName).then(result => {
        if (result?.privateId && !result.error && result.current) {
          setFirstPoseInitialized(true);
          const confirmed = liveScene.current;
          setRecordedPoses(Object.fromEntries(confirmed.keyframes.map(frame => [frame.timeMs, workshopPoseSignature(confirmed, frame.timeMs)])));
          if (continueToDetails) router.push(`/my-exercises/${result.privateId}/edit?sceneSaved=1`);
        }
      }).finally(() => setManualSaveRequests(count => Math.max(0, count - 1)));
    });
  };
  const placeSupport = (contact: SupportContact, constrain = false) => {
    const rig = supportRig.current;
    if (!rig) { setSupportError("Wait for the preview before placing a support."); return false; }
    try {
      const base = dragSession.current?.scene ?? scene;
      const original = base.studio?.supports?.find(item => item.region === contact.region);
      if (constrain && original && base.studio) {
        let root = rig.root;
        while (root.parent) root = root.parent as typeof root;
        const constrained = constrainSupportToMesh(root, base.studio, original, contact, playback.timeMs, rig);
        if (!constrained) { setSupportError("Keep this contact on its current surface, or choose Change support."); return false; }
        contact = constrained;
      }
      const converted = bakeLegacySupportScene(base, rig);
      const next = constrain ? changeSupportContact(converted, contact) : pickSupportContact(converted, contact, rig, playback.timeMs);
      if (constrain && evaluateSupportScene(next, rig, playback.timeMs).some(report => !report.reachable)) { setSupportError("Reach limit. Choose Reposition body to adjust the setup."); return false; }
      if (update(next, `Position ${supportRegionLabels[contact.region]} support`)) {
        setSupportError(undefined);
        if (!constrain) setSupportEdit({ region: contact.region, picking: false, adjusting: true });
        return true;
      }
    } catch (error) { setSupportError(error instanceof Error ? error.message : "Could not place this support."); }
    return false;
  };
  const releaseSupport = () => {
    if (!supportRig.current) { setSupportError("Wait for the preview before releasing a support."); return; }
    try {
      if (update(bakeSupportRelease(scene, supportRegion, supportRig.current), `Release ${supportRegionLabels[supportRegion]} support`)) cancelSupportEdit();
    } catch (error) { setSupportError(error instanceof Error ? error.message : "Could not release this support."); }
  };
  const repositionForSupports = () => {
    if (!supportRig.current) { setSupportError("Wait for the preview before repositioning."); return; }
    try {
      const result = previewSupportSceneReposition(scene, supportRig.current, playback.timeMs);
      if (!result.reachable) { setSupportError("These supports cannot all be reached. Move a contact closer or release one first."); return; }
      setPlaying(false); setSupportEdit(null);
      const before = liveScene.current, at = Math.round(playback.timeMs);
      if (!gesture.begin(before, at)) return;
      dragSession.current = { scene: before, latest: before, timeMs: at };
      if (update({ ...scene, studio: { ...studio, body: result.body } })) { setSupportRepositioning(true); setSupportError(undefined); }
      else endDrag(true);
    } catch (error) { setSupportError(error instanceof Error ? error.message : "Could not reposition the body."); }
  };
  const editor: StudioEditor = {
    interactionEnabled: !supportEdit?.picking && !supportEdit?.adjusting && !supportRepositioning,
    supportEdit: panel === "contact" && !playing && !supportRepositioning ? supportEdit ?? (selectedSupport ? { region: supportRegion, picking: false, adjusting: false } : null) : null,
    onSupportPick: contact => placeSupport(contact),
    onSupportDragStart: () => { setPlaying(false); beginDrag(); setSupportError(undefined); },
    onSupportChange: contact => placeSupport(contact, true),
    onSupportDragEnd: endDrag,
    limbPosing: limbPosing && Math.round(timeMs) === current.timeMs,
    limbPose: heldPose,
    blockedLimbs,
    onLimbDragStart: () => { beginDrag(); setLimbWarning(null); },
    onLimbPoseChange: (limb, poses, error) => {
      const session = dragSession.current;
      if (!session || limbPoseBlock(session.scene, limb) || session.timeMs !== current.timeMs) return;
      try {
        const base = limb.endsWith("foot") ? releaseSeatedFeet(session.scene) : session.scene;
        const next = base.studio?.objects.some(item => ["row-machine", "shoulder-press-machine", "chest-press-machine"].includes(item.slug) && (item.machineUse || item.attachment !== "none"))
          ? editLeverMachinePose(base, selectedFrame, poseScope === "all", poses)
          : editHeldWeightPose(base, selectedFrame, poseScope, poses);
        update(constrainSeatedEdit(base, next, session.timeMs));
      } catch (failure) { setEditError(failure instanceof Error ? failure.message : "Could not release this support."); return; }
      const warning = error > .025 ? "limit" : limb.endsWith("foot") ? "contact" : null;
      setLimbWarning(previous => previous === warning ? previous : warning);
    },
    onCableDragStart: id => { beginDrag(); setSelection({ kind: "object", id }); setLimbWarning(null); },
    onCablePoseChange: (id, poses, error) => {
      const session = dragSession.current, cable = session?.scene.studio?.objects.find(item => item.id === id);
      if (!session || !cable || cable.machineUse || session.timeMs !== current.timeMs) return;
      update({ ...session.scene, keyframes: session.scene.keyframes.map((frame, index) => index === selectedFrame || poseScope === "all"
        ? { ...frame, poses: constrainFrontalPose({ ...frame.poses, ...poses }, session.scene.studio?.frontalPlane) } : frame) });
      const warning = error > .025 ? "limit" : null;
      setLimbWarning(previous => previous === warning ? previous : warning);
    },
    dragPlane,
    onMachineDragStart: id => { beginDrag(); setSelection({ kind: "object", id }); },
    onMachineHandleChange: (id, values) => {
      const session = dragSession.current;
      if (!session) return;
      try { update(constrainSeatedEdit(session.scene, moveMachineWithMouse(session.scene, id, session.timeMs, values, "advanced"), session.timeMs)); }
      catch (error) { setEditError(error instanceof Error ? error.message : "Could not move this handle. Try an existing moment."); }
    },
    bodyLocked: !!(activeMachine || seatedBench || rootSupport) || limbPosing,
    placementLockedIds, supportObjectIds: [...new Set([...(studio.seating ? [studio.seating.benchId] : []), ...(studio.supports?.flatMap(contact => contact.objectId ? [contact.objectId] : []) ?? [])])], onPlacementOverlap,
    selection, tool, snap, sensitivity, playing, dragging, adjusting, posing, directDragging: freeDragging, limbNudge,
    onLimbNudgeConsumed: id => setLimbNudge(previous => previous?.id === id ? undefined : previous),
    onSelect: selectObject, onActivate: activateObject,
    onBodyChange: body => { if (!activeMachine && !seatedBench && !rootSupport) update({ ...scene, studio: { ...studio, body } }); },
    onObjectChange: transformObject, onJointChange: setPose,
    jointPosePreview: !!selectedJoint && (elbowFollowsShoulder && selectedJoint.endsWith("shoulder")
      || /-(shoulder|elbow)$/.test(selectedJoint) && studio.objects.some(item => ["row-machine", "shoulder-press-machine", "chest-press-machine"].includes(item.slug) && (item.machineUse || item.attachment !== "none"))),
    onDragStart: beginDrag, onDragEnd: endDrag,
    onGripReach: (id, reachable) => setGripReach(previous => previous[id] === reachable ? previous : { ...previous, [id]: reachable }),
    gripEdit: panel === "contact" && interactionMode === "edit" && !limbPosing && object?.id === gripEdit?.objectId && !playing && !dragging ? gripEdit : null,
    onGripPoint: (id, side, point) => {
      const item = studio.objects.find(item => item.id === id);
      if (item) updateObject(id, { gripOffsets: setGripOffset(item, side, point).gripOffsets });
      setGripEdit({ objectId: id, side, picking: false });
    },
    captureElbow, blockedJoints, frontalPlane: studio.frontalPlane,
    onCaptureElbow: (id, side, point) => {
      const item = studio.objects.find(item => item.id === id);
      if (item) {
        const resolved = resolveStudioObject(scene, item, current.timeMs);
        updateObject(id, { ...updateStudioObjectTransform(item, resolved, current.timeMs, true),
          ...(["dumbbell", "barbell", "kettlebell"].includes(item.slug) ? { poseDriver: "weight" as const } : {}), elbowLocks: { ...item.elbowLocks, [side]: point } });
      }
      setCaptureElbow(null);
    },
    onPresentationChange: presentation => update({ ...scene, studio: { ...studio, presentation } }),
  };

  const changeTransform = (value: SceneTransform) => {
    setPlaying(false); setTimeMs(current.timeMs);
    if (object) return transformObject(object.id, value);
    else if (!activeMachine && !seatedBench) return update({ ...scene, studio: { ...studio, body: value } });
    return false;
  };
  const chooseTool = (value: StudioEditor["tool"]) => {
    cancelSupportEdit();
    setGripEdit(null); setPlaying(false);
    enterEditor(value === "select" ? { mode: "free", showJoints: posing }
      : { mode: value === "translate" ? "move" : value, showJoints: posing });
  };
  const selectedLimb: PoseLimb | undefined = limbPosing && selectedJoint
    ? selectedJoint.endsWith("wrist") ? `${selectedJoint.startsWith("left") ? "left" : "right"}-hand`
      : selectedJoint.endsWith("ankle") ? `${selectedJoint.startsWith("left") ? "left" : "right"}-foot` : undefined
    : undefined;
  const chooseManipulation = (next: WorkshopManipulationTool) => {
    if (dragging || adjusting || captureElbow) return;
    cancelSupportEdit();
    setGripEdit(null); setPlaying(false); setLimbWarning(null);
    setLimbNudge(undefined);
    if (next === "limbs") { enableLimbPosing(); return; }
    if (next === "free" && !limbPosing) { enableMouseMovement(); return; }
    if (next === "rotate" && object?.slug === "dumbbell" && ["left", "right"].includes(object.attachment) && !object.elbowLocks?.[object.attachment as "left" | "right"]) {
      selectObject({ kind: "joint", slug: `${object.attachment as "left" | "right"}-wrist` });
    }
    dispatchEditor({ type: "choose", tool: next, endpoint: !!selectedJoint && (selectedJoint.endsWith("wrist") || selectedJoint.endsWith("ankle")) });
  };
  const nudgeSelection = (axis: "x" | "y" | "z", direction: number) => {
    if (dragging || adjusting || captureElbow || !selection) return;
    if (selectedLimb && tool !== "rotate") {
      if (limbPoseBlock(scene, selectedLimb)) return;
      setLimbNudge({ id: ++nudgeId.current, limb: selectedLimb, axis, amount: nudgeDistance * direction });
    } else if (selectedJoint) {
      if (!jointBlocked) {
        const displayed = jointControlValue(selectedJoint, axis, jointAngles[axis]);
        setPose(selectedJoint, { ...jointAngles, [axis]: jointControlValue(selectedJoint, axis, displayed + nudgeAngle * direction) }, axis);
      }
    } else if (!bodyLocked && !placementLocked) {
      const key = tool === "rotate" ? ({ x: "rotationX", y: "rotationY", z: "rotationZ" } as const)[axis] : axis;
      const increment = tool === "rotate" ? nudgeAngle : nudgeDistance;
      changeTransform({ ...selectedTransform, [key]: Math.round((selectedTransform[key] + increment * direction) * 1000) / 1000 });
    }
  };
  const selectedTransform = object ?? studio.body;
  const canHold = !!object && equipmentGripHands(object).length > 0;
  const canHoldBoth = !!object && equipmentGripHands(object).includes("both");
  const held = object && object.attachment !== "none";
  const automaticDumbbell = object?.slug === "dumbbell" && (object.attachment === "left" || object.attachment === "right") && !object.elbowLocks?.[object.attachment];
  const weight = object && ["barbell", "dumbbell", "kettlebell"].includes(object.slug);
  const objectLabel = (item: StudioObject) => equipmentLabel(studio.objects, item);
  const weightGripControls = weight && <div className="space-y-3 rounded-xl border border-border p-3">
    <h3 className="font-semibold" data-workshop-translate="false">{objectLabel(object)}</h3>
    <div className="flex flex-wrap gap-2">{(["left", "right", ...(canHoldBoth ? ["both"] : [])] as ("left" | "right" | "both")[]).map(hand => <button key={hand} type="button" aria-pressed={object.attachment === hand} onClick={() => holdObject(hand)} className={`${buttonClass} ${object.attachment === hand ? "bg-primary text-primary-foreground" : "bg-card"}`}>{t(hand === "both" ? "Hold with both hands" : `Hold with ${hand} hand`)}</button>)}</div>
    {held && <><button type="button" disabled={playing || dragging} title={t("Fits every saved pose and clears custom grip points and elbow locks. Undo restores the movement.")} onClick={() => holdObject(object.attachment, true)} className={buttonClass}>{t("Reset to automatic grip")}</button><button type="button" onClick={() => holdObject("none")} className={buttonClass}>{t("Release")}</button></>}
      <p className="text-sm text-muted-foreground">{t(object.slug === "dumbbell" && object.attachment === "both"
        ? "Both palms support one dumbbell head. Move the weight or pose either arm; the other hand follows."
        : "Choose a hand. The weight fits its current pose. Move the weight to move the arm.")}</p>
    {object.slug === "dumbbell" && gripReach[object.id] === false && <p role="status" className="text-sm text-amber-700">{t("Arm reach limit. The weight stays in the hand; move it closer to continue.")}</p>}
  </div>;
  const supportBench = object?.slug === "bench" ? object : seatedBench;
  const changeBenchSetup = (next: WorkshopScene) => {
    try {
      // Validate the automatic stance without committing its foot-release copy.
      if (activeSeat(next)?.slug === "bench") releaseSeatedFeet(next);
      update(constrainSeatedEdit(scene, next, current.timeMs)); setEditError(null);
    } catch (error) { setEditError(error instanceof Error ? error.message : "This bench position is outside the figure's joint limits."); }
    setPlaying(false);
  };
  const benchControls = supportBench && <WorkshopBenchControls bench={supportBench} facing={studio.seating?.benchId === supportBench.id ? studio.seating.facing : undefined} onAngle={benchAngle => changeBenchSetup({ ...scene, studio: { ...studio, objects: studio.objects.map(item => item.id === supportBench.id ? { ...item, benchAngle } : item) } })} onPosition={(facing?: BenchFacing) => {
    if (studio.supports?.length) {
      const rig = supportRig.current;
      if (!rig) { setEditError("Wait for the preview before changing body support."); return; }
      updateContacts(() => changeBenchSupport(scene, supportBench.id, facing, rig)); setPlaying(false); return;
    }
    changeBenchSetup({ ...scene, motionStyle: "free", studio: { ...studio,
      objects: studio.objects.map(item => facing && item.machineUse ? { ...item, machineUse: false } : item),
      seating: facing ? { benchId: supportBench.id, facing } : undefined } });
    setPlaying(false);
  }} />;

  const closePicker = () => setAdding(false);
  const chooseExample = (example: WorkshopScene) => {
    setFirstPoseInitialized(true);
    setExampleMachineId(example.studio!.objects[0].id);
    const presentation = studio.presentation;
    update({ ...example, studio: { ...example.studio!, presentation: presentation ? { ...example.studio!.presentation!, highlight: presentation.highlight, isolate: presentation.isolate } : example.studio!.presentation } });
    setSelectedFrame(0); setTimeMs(0); setPlaying(false); setSelection({ kind: "object", id: example.studio!.objects[0].id });
  };
  const resetExample = () => {
    const recipe = createQuickScene(activeMachine && isStudioMachine(activeMachine.slug) ? activeMachine.slug : "cable-row-machine");
    chooseExample(activeMachine?.machineMode === "reverse" ? setPecDeckMode(recipe, recipe.studio!.objects[0].id, "reverse") : recipe);
  };
  const showExampleInstructions = !!activeMachine && activeMachine.id === exampleMachineId;
  const demonstrationCaption = showExampleInstructions ? workshopDemonstrationCaption(activeMachine!, timeMs, scene.durationMs) : null;
  const overlappingObjects = playing ? [] : studio.objects.filter(item => placementOverlaps[item.id]);
  const onShortcut = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || !(event.target instanceof HTMLElement)) return;
    if (event.key === "Escape" && (supportEdit || supportRepositioning)) { event.preventDefault(); cancelSupportEdit(); return; }
    const target = event.target;
    const dialogOpen = adding || !!nameRequest || !!draft.recovery || tutorial.open || !!target.closest('dialog,[role="dialog"],[aria-modal="true"]');
    if (event.key === "Escape" && !event.repeat && !event.nativeEvent.isComposing && !dragging && !adjusting && !dialogOpen) {
      const menu = workshopRoot.current?.querySelector<HTMLDetailsElement>('[data-workshop-menu][open], [data-tutorial-target="manipulation"] details[name="workshop-dropdown"][open]');
      if (menu) {
        event.preventDefault();
        menu.open = false;
        if (menu === moreHelp.current) {
          if (shortcutHelp.current) shortcutHelp.current.open = false;
          if (historyHelp.current) historyHelp.current.open = false;
        }
        workshopRoot.current?.focus({ preventScroll: true });
        return;
      }
      if (editor.gripEdit?.picking) {
        event.preventDefault(); setGripEdit({ ...editor.gripEdit, picking: false }); return;
      }
      if (captureElbow) {
        event.preventDefault(); setCaptureElbow(null); return;
      }
      if (target.isContentEditable || target.closest('textarea,select,input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"])')) {
        event.preventDefault(); workshopRoot.current?.focus({ preventScroll: true }); return;
      }
    }
    const timeline = !!target.closest("[data-timeline-rows]");
    const command = workshopShortcut(event.nativeEvent, {
      timeline,
      typing: target.isContentEditable || !!target.closest('textarea,select,input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"])'),
      interactive: !!target.closest('button,a[href],summary,input,select,textarea,[role="slider"],[role="button"],[role="spinbutton"]'),
      blocked: dragging || adjusting || !!captureElbow || dialogOpen,
    });
    if (!command) return;
    event.preventDefault();
    const camera = () => { cancelSupportEdit(); setGripEdit(null); setLimbNudge(undefined); dispatchEditor({ type: "choose", tool: "camera" }); };
    switch (command) {
      case "undo": undo(); break;
      case "redo": redo(); break;
      case "save":
        save();
        break;
      case "duplicate":
        try { if (timeline) addFrame(captureWorkshopFrame(scene, selectedFrame)); else duplicate(); }
        catch (error) { setFrameError(error instanceof Error ? error.message : "Could not add poses."); }
        break;
      case "remove": if (timeline) removeFrame(); else removeObject(); break;
      case "copy": poseClipboard.current = captureWorkshopFrame(scene, selectedFrame); setStatus("Pose copied"); break;
      case "cut": if (scene.keyframes.length > 2) { poseClipboard.current = captureWorkshopFrame(scene, selectedFrame); removeFrame(); } break;
      case "paste":
        try { if (poseClipboard.current && update(pasteWorkshopFrame(scene, selectedFrame, poseClipboard.current))) { setFirstPoseInitialized(true); setFrameError(null); } }
        catch (error) { setFrameError(error instanceof Error ? error.message : "Could not add poses."); }
        break;
      case "play": cancelSupportEdit(); setGripEdit(null); setLimbNudge(undefined); setPlaying(!playing); break;
      case "previous": if (selectedFrame > 0) { selectFrame(selectedFrame - 1); if (timeline) focusFrame(selectedFrame - 1); } break;
      case "next": if (selectedFrame < scene.keyframes.length - 1) { selectFrame(selectedFrame + 1); if (timeline) focusFrame(selectedFrame + 1); } break;
      case "edit": chooseManipulation("select"); break;
      case "camera": camera(); break;
      case "lock": toggleItemLock(); break;
      case "help":
        if (moreHelp.current) moreHelp.current.open = true;
        if (shortcutHelp.current) { shortcutHelp.current.open = true; shortcutHelp.current.querySelector("summary")?.focus(); }
        break;
      case "escape":
        if (selection) { selectObject(null); setLimbWarning(null); }
        else if (focusMode) { setFocusMode(false); setMobileEditing(true); }
        else { camera(); setPlaying(false); }
        break;
    }
  };
  const playbackControls = <WorkshopPlaybackControls scene={scene} timeMs={timeMs} playback={playback} playing={playing} speed={speed} selectedFrame={selectedFrame} disabled={dragging || supportRepositioning || !!captureElbow} demonstrationCaption={demonstrationCaption} onPlayingChange={value => { cancelSupportEdit(); setGripEdit(null); setLimbNudge(undefined); setPlaying(value); }} onSpeedChange={setSpeed} onTimeChange={previewTime} onFrameChange={selectFrame} poseSaved={currentPoseSaved} firstPoseRecorded={recordedPoses[0] !== undefined} onSavePose={savePose} />;
  const openTool = (next: WorkshopTool) => {
    cancelSupportEdit();
    setPanel(next); setMobileEditing(true); setMoreOpen(false);
    if (moreHelp.current) moreHelp.current.open = false;
    if (historyHelp.current) historyHelp.current.open = false;
    if (shortcutHelp.current) shortcutHelp.current.open = false;
    if (next !== "placement" || !selectedJoint) dispatchEditor({ type: "panel", panel: next, joint: !!selectedJoint });
    if (next === "contact") {
      if (selectedJoint) setSelection({ kind: "body" });
    }
    requestAnimationFrame(() => {
      const element = workshopRoot.current?.querySelector<HTMLElement>(`[data-workshop-panel="${next}"]`);
      element?.closest("[data-workshop-controls-scroll]")?.scrollTo({ top: 0 });

    });
  };
  useEffect(() => {
    if (!tutorial.open) return;
    const frame = requestAnimationFrame(() => {
      const tip = workshopTutorialSteps[tutorial.step];
      setFocusMode(false); setPreviewOpen(true); setPlaying(false); setPanel(tip.panel); setMobileEditing(tip.target === "equipment" || tip.target === "pose");
      if (tip.panel === "pose") dispatchEditor({ type: "panel", panel: "pose" });
    });
    return () => cancelAnimationFrame(frame);
  }, [tutorial.open, tutorial.step, setPlaying]);
  const closeTutorial = () => {
    tutorial.update({ open: false, step: tutorial.step });
    if (historyHelp.current) historyHelp.current.open = false;
    requestAnimationFrame(() => moreHelp.current?.querySelector("summary")?.focus({ preventScroll: true }));
  };
  const plateRowControls = object?.slug === "row-machine" ? <WorkshopPlateRowControls object={object} reach={machineReach} onChange={changes => changes.rowFootSupport === false && object.machineUse ? update(releasePlateRowFeet(scene)) : updateObject(object.id, {
    ...(object.machineUse && object.rowGrip === undefined && object.attachment === "none" ? { attachment: "both" as const, rowGrip: "neutral" as const } : {}), ...changes,
  })} onTravel={(side, position) => {
    changeMachineTravel(position, side);
  }} /> : null;
  const seat = activeSeat(scene);
  const seatingControls = seat && (!object || object.id === seat.id) && <WorkshopSeatingControls object={resolveStudioObject(scene, seat, current.timeMs)} torso={heldPose.torso ?? { x: 0, y: 0, z: 0 }}
    onOffset={changes => { update(setSeatOffsets(scene, seat.id, current.timeMs, changes)); setPlaying(false); }}
    onTorso={angles => setPose("torso", angles)}
    onFeet={supported => {
      try {
        if (supported) {
          const next = { ...scene, studio: { ...studio, objects: studio.objects.map(item => item.id === seat.id
            ? { ...item, seatFootSupport: true, ...(seat.slug === "row-machine" ? { rowFootSupport: true } : {}) } : item) } };
          // Restoring automatic support must satisfy the same limits as its release.
          releaseSeatedFeet(next);
          update(next);
        }
        else {
          const at = Math.round(playback.timeMs), moment = editWorkshopMoment(scene, at);
          update(releaseSeatedFeet(moment.scene));
          setSelectedFrame(moment.index); setPlaying(false); setTimeMs(at);
        }
        setEditError(null);
      } catch (error) { setEditError(error instanceof Error ? error.message : "Could not release this support."); }
    }}
    onReset={() => {
      try { update(resetSeatPose(scene, seat.id, selectedFrame), "Reset seat"); setPlaying(false); }
      catch (error) { setEditError(error instanceof Error ? error.message : "Could not reset this seat."); }
    }} />;
  return <WorkshopLanguageProvider language={language}><WorkshopGuidanceProvider enabled={false}><WorkshopCommitMetrics>{(<><div ref={workshopRoot} role="region" tabIndex={0} aria-label={t("Workshop editor")} onKeyDown={onShortcut}
      onPointerDownCapture={event => { if (event.target instanceof HTMLInputElement && event.target.hasAttribute("data-workshop-scene-range")) beginDrag(false); }}
      onKeyDownCapture={event => { if (event.target instanceof HTMLInputElement && event.target.hasAttribute("data-workshop-scene-range") && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) beginDrag(false); }}
      onKeyUpCapture={event => { if (adjusting && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) endDrag(); }}
      onBlurCapture={event => { if (adjusting && event.target instanceof HTMLInputElement && event.target.hasAttribute("data-workshop-scene-range")) endDrag(); }}
      data-focus-mode={focusMode} data-tutorial-open={tutorial.open} className="fixed inset-0 z-[60] flex min-w-0 flex-col overflow-hidden bg-card text-base focus-visible:outline-2 focus-visible:outline-ring md:overflow-hidden [&_.text-xs]:text-sm [&_summary]:min-h-11 [&_input[type=range]]:min-h-6" data-workshop="studio" dir={language === "he" ? "rtl" : "ltr"} lang={language}>
<section aria-label={t("Workshop actions")} className="relative shrink-0 space-y-1 border-b bg-card px-3 py-2 md:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <Link href="/my-exercises" aria-label={t("My exercises")} title={t("My exercises")} className={`${buttonClass} shrink-0`}><ArrowLeft size={16} className="rtl:rotate-180" /><span className="hidden lg:inline">{t("My exercises")}</span></Link>
        <h1 aria-label={name.trim() || t("Untitled exercise")} className="min-w-24 flex-1 text-lg font-semibold sm:min-w-36"><input aria-label={t("Exercise name")} title={t("Rename exercise")} value={name} maxLength={160} onChange={event => setName(event.target.value)} className="min-h-11 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-lg font-semibold placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring" placeholder={t("Untitled exercise")} /></h1>
        <div className="flex shrink-0 items-center gap-2">
          <p role="status" aria-live="polite" className="sr-only max-w-40 text-sm text-muted-foreground sm:not-sr-only">{t(manualSaveRequests > 0 ? "Saving…" : draft.message)}</p>
          <button data-tutorial-target="save" aria-label={t("Save exercise")} type="button" onClick={() => save()} aria-busy={pending} disabled={dragging || !!captureElbow} className={`${buttonClass} bg-primary text-primary-foreground`}><Save size={16} /><span className="hidden sm:inline">{t(pending ? "Saving…" : "Save exercise")}</span><span className="sm:hidden">{t(pending ? "Saving…" : "Save")}</span></button>
        </div>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2 border-t border-border/60 pt-1">
        <div role="group" aria-label={t("Edit history")} className="flex gap-1">
          <button type="button" aria-label={t("Undo")} disabled={!past.length || dragging} onClick={undo} title={t("Undo · Ctrl / ⌘ + Z")} className={buttonClass}><Undo2 size={16} /></button>
          <button type="button" aria-label={t("Redo")} disabled={!future.length || dragging} onClick={redo} title={t("Redo · Ctrl / ⌘ + Shift + Z · Ctrl + Y")} className={buttonClass}><Redo2 size={16} /></button>
        </div>
        <button data-tutorial-target="equipment" ref={addButton} aria-label={t("Add equipment")} title={t("Add equipment")} type="button" onClick={event => { event.currentTarget.focus(); setEquipmentPickerView("popular"); setAdding(!adding); }} aria-expanded={adding} className={`${buttonClass} ms-auto`}><Plus size={16} /><span className="hidden sm:inline">{t("Add equipment")}</span><span className="sm:hidden">{t("Add")}</span></button>
        <details ref={moreHelp} onToggle={event => { setMoreOpen(event.currentTarget.open); if (!event.currentTarget.open && shortcutHelp.current) shortcutHelp.current.open = false; }} name="workshop-dropdown" data-workshop-menu className="relative"><summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">{t("More")}<ChevronDown size={12} /></summary><div className="absolute end-0 top-full z-50 mt-1 max-h-[calc(100dvh-9rem)] w-72 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-xl border bg-card p-1.5 shadow-lg">
        <div role="tablist" aria-label={t("More tools")} aria-orientation="vertical">
          {workshopTools.slice(6).map(([tool, label]) => <button key={tool} id={`workshop-tool-${tool}`} type="button" role="tab" aria-controls={`workshop-panel-${tool}`} aria-selected={panel === tool} onClick={() => {
            openTool(tool);
            requestAnimationFrame(() => document.getElementById(`workshop-panel-${tool}`)?.focus({ preventScroll: true }));
          }} onKeyDown={event => {
            const tabs = Array.from(event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
            const index = tabs.indexOf(event.currentTarget);
            const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : event.key === "ArrowDown" ? (index + 1) % tabs.length : event.key === "ArrowUp" ? (index + tabs.length - 1) % tabs.length : null;
            if (next !== null) { event.preventDefault(); tabs[next].focus(); }
          }} className={`${menuRowClass} aria-selected:bg-accent aria-selected:text-accent-foreground`}>{t(label)}</button>)}
        </div>
        <button type="button" aria-label={t("Tutorial")} aria-expanded={tutorial.open} onClick={() => { if (moreHelp.current) moreHelp.current.open = false; if (tutorial.open) closeTutorial(); else tutorial.update({ open: true, step: 0 }); }} className={menuRowClass}><Info size={16} />{t("Tutorial")}</button>
        <div className="my-1 border-t" />
        <WorkshopFullscreenButton target={workshopRoot} className={`${menuRowClass} [&_span]:inline`} />
        <button type="button" aria-pressed={focusMode} disabled={dragging || adjusting} onClick={() => { setFocusMode(!focusMode); setMobileEditing(focusMode); if (moreHelp.current) moreHelp.current.open = false; setPreviewOpen(true); if (!focusMode) { if (historyHelp.current) historyHelp.current.open = false; if (shortcutHelp.current) shortcutHelp.current.open = false; } }} className={menuRowClass}><Scan size={16} />{focusMode ? t("Show controls") : t("Hide controls")}</button>

        <label className="flex min-h-11 items-center justify-between gap-3 px-3 py-1 text-sm font-medium">{t("Language")}<select aria-label={t("Workshop language")} value={language} onChange={event => setLanguage(event.target.value as "en" | "he")} className="min-h-11 max-w-32 rounded-md bg-background px-2 font-normal"><option value="en">{t("English")}</option><option value="he">עברית</option></select></label>
        <div className="my-1 border-t" />
        <details ref={shortcutHelp}>
          <summary className={`${menuRowClass} cursor-pointer list-none justify-between [&::-webkit-details-marker]:hidden`}>{t("Recovery and shortcuts")}<ChevronDown size={12} /></summary>
          <div className="space-y-4 px-3 py-2 text-sm">
            <WorkshopShortcutGuide />
            <div className="space-y-4">
              <div className="space-y-2"><WorkshopGuidance>{t("Restore last saved replaces the scene and name. Undo restores the current scene.")}</WorkshopGuidance><button type="button" onClick={() => { update(draft.lastSaved.scene, "Restore last saved"); setName(draft.lastSaved.name); setSelectedFrame(0); setTimeMs(0); }} className={buttonClass}>{t("Restore last saved")}</button></div>
              <div className="space-y-2"><WorkshopGuidance>{t("Reset to example replaces the whole scene in one Undo step. Your chosen muscle highlight is kept.")}</WorkshopGuidance><button type="button" onClick={resetExample} className={buttonClass}>{t("Reset to example")}</button></div>
            </div>
          </div>
        </details>
        <details ref={historyHelp}><summary className={`${menuRowClass} cursor-pointer list-none justify-between [&::-webkit-details-marker]:hidden`}>{t("Recent edits")}<ChevronDown size={12} /></summary>
          <section aria-label={t("Edit history")} className="space-y-2 px-3 py-2 text-sm">
            <p className="text-muted-foreground">{t("Use Undo or Redo to restore an edit. This list describes changes from this session.")}</p>
            {past.length ? <ol className="max-h-40 space-y-2 overflow-y-auto">{[...past].reverse().map((entry, index) => <li key={index}>{entry.label}</li>)}</ol> : <p>{t("No edits in this session yet.")}</p>}
            {!!future.length && <p>{`Redo next: ${future[0].label}`}</p>}
          </section>
        </details>
        <div className="my-1 border-t" />
        {savedId && <Link href={`/my-exercises/${savedId}/edit`} aria-label={t("Exercise details")} className={menuRowClass}><BookOpen size={16} />{t("Add exercise details")}</Link>}
        <button type="button" onClick={() => save(true)} disabled={dragging || !!captureElbow} className={menuRowClass}><Save size={16} />{t("Save & add details")}</button><Link href="/my-exercises" className={menuRowClass}><ArrowLeft size={16} />{t("Exit workshop")}</Link></div></details>
      </div>

      {!draft.recoverable && draft.dirty && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t("Local recovery unavailable · save before leaving")}</p>}
      {editError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{editError}</p>}
      {draft.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{draft.error} <button type="button" onClick={() => save()} disabled={pending} className={buttonClass}>{t("Retry saving")}</button> {/sign[ -]in/i.test(draft.error) && <a href={`/sign-in?next=${encodeURIComponent(savedId ? `/my-exercises/${savedId}/workshop` : "/my-exercises/new")}`} className="underline">{t("Sign in again")}</a>}</p>}
      {draft.recovery && <WorkshopRecoveryNotice updatedAt={draft.recovery.updatedAt} hasSavedVersion={!!privateId} onRestore={() => { const recovered = draft.recovery!; update(recovered.scene, "Restore recovered draft"); setFirstPoseInitialized(recovered.firstPoseInitialized ?? true); setName(recovered.name); draft.acceptRecovery(); setSelectedFrame(0); setTimeMs(0); }} onDismiss={draft.dismissRecovery} />}

      {focusMode && <button inert={moreOpen} type="button" onClick={() => { setFocusMode(false); setMobileEditing(true); }} className={buttonClass}><Scan size={16} />{t("Show controls")}</button>}
      {!focusMode && <div inert={moreOpen} className="flex items-center justify-between gap-2 md:hidden"><div role="group" aria-label={t("Workshop view")} className="flex gap-1"><button type="button" aria-pressed={!mobileEditing} onClick={() => { setMobileEditing(false); setPreviewOpen(true); }} className={buttonClass}>{t("Preview")}</button><button type="button" aria-pressed={mobileEditing} onClick={() => setMobileEditing(true)} className={buttonClass}>{t("Edit controls")}</button></div>{(activeMachine || studio.seating) && <button type="button" onClick={leaveEquipment} disabled={dragging} className={buttonClass}>{t(activeMachine ? "Leave machine" : "Stand up")}</button>}</div>}
    </section>
    {adding && <WorkshopEquipmentPicker options={equipmentOptions} ownerKey={ownerId} initialView={equipmentPickerView} onClose={closePicker} onSelect={slug => addObject(slug as StudioObject["slug"])} />}
    {nameRequest && <WorkshopNameDialog initialName={name} onClose={() => setNameRequest(null)} onSave={enteredName => save(nameRequest.continueToDetails, enteredName)} />}
    <div inert={moreOpen} className={"grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden md:overflow-hidden " + (focusMode ? "" : "md:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]")}>
      <div data-tutorial-target="preview" className={"relative min-h-0 min-w-0 flex-col overflow-hidden border-b bg-background p-2 md:flex md:border-b-0 md:p-3 " + (mobileEditing && !focusMode ? "hidden" : "flex")} data-workshop-preview>
        <div data-workshop-figure-preview hidden={!previewOpen} className="relative flex min-h-0 flex-1 flex-col">
          {!comparison && <WorkshopManipulationControls
            active={interactionMode === "camera" ? "camera" : freeDragging ? "free" : limbPosing ? "limbs" : tool === "select" ? "select" : tool === "rotate" ? "rotate" : "move"}
            onTool={chooseManipulation} plane={dragPlane} onPlane={setDragPlane}
            selectedName={selectedJoint ? t(jointNames[selectedJoint]) : object ? objectLabel(object) : selection?.kind === "body" ? t("Anatomical figure") : null}
            disabled={dragging || adjusting || !!captureElbow || playing}
            canMove={!selectedJoint || isWrist || isAnkle}
            rotating={tool === "rotate" || !!selectedJoint && !selectedLimb} sensitivity={sensitivity} onSensitivity={changeSensitivity} snap={snap} onSnap={setSnap} />}
          {limbPosing && interactionMode === "edit" && <p className="shrink-0 px-1 py-0.5 text-sm text-muted-foreground">{t(freeDragging ? "Drag a hand or foot using its round button" : "Select a hand or foot, then use arrows. Direction locks movement.")}</p>}
          {comparison ? <div className="min-h-0 flex-1 overflow-y-auto"><WorkshopComparison scene={scene} /></div> : <MotionCanvas scene={scene} gesture={gesture} timeMs={timeMs} playback={playback} editor={editor} simplifiedControls controlsTarget={viewControlsTarget} interactionMode={interactionMode} onInteractionModeChange={value => { cancelSupportEdit(); dispatchEditor({ type: "choose", tool: value === "edit" ? "move" : "camera" }); }} onMachineReachChange={onMachineReach} onSupportRigReady={onSupportRigReady} onSupportReachChange={onSupportReachChange} fillViewport className="min-h-44 flex-1" canvasOverlay={<>
            <WorkshopPlacementWarning objects={studio.objects} overlapping={overlappingObjects} supports={supportReports} onSupportInspect={region => {
              cancelSupportEdit(); setSupportRegion(region); setSelection({ kind: "body" }); setPanel("contact"); setMobileEditing(true);
            }} onInspect={id => {
              selectObject({ kind: "object", id }); setPanel("placement"); setMobileEditing(true);
              requestAnimationFrame(() => {
                const placement = workshopRoot.current?.querySelector<HTMLElement>('[data-workshop-panel="placement"]');
                placement?.closest("[data-workshop-controls-scroll]")?.scrollTo({ top: 0 });
                if (window.matchMedia("(max-width: 767px)").matches) placement?.scrollIntoView({ block: "start" });
                placement?.querySelector<HTMLElement>("button:not([disabled])")?.focus({ preventScroll: true });
              });
            }} />
            {interactionMode === "edit" && <WorkshopPoseFeedback kind={limbWarning} dragging={dragging} />}
          {(playing || interactionMode === "edit" && (selectedJoint || controllingWeight || bodyLocked || tool !== "select")) && <div data-workshop-current-hint className="pointer-events-none absolute bottom-8 start-2 end-16 z-10 flex justify-between gap-3 text-xs">
            <span className="rounded-lg bg-card/95 px-3 py-2 font-semibold">{playing ? t("Previewing movement") : interactionMode === "camera" ? t("Drag to rotate the camera. Choose Move to reposition the figure or equipment.") : limbPosing ? t(freeDragging ? "Drag a hand or foot using its round button" : "Drag an arrow to move this hand or foot") : controllingWeight?.machineUse ? <><span data-workshop-translate="false">{controllingWeight.name}</span> {t("controls contact")}</> : controllingWeight ? jointBlocked ? t("Move the held weight or release its support to pose this arm") : t("The held weight follows the arm") : selectedJoint ? `${t(jointNames[selectedJoint])} · ${t(isWrist ? "use the palm controls" : "drag a ring to pose")}` : rootSupport ? t("Adjust or release the body support to move the figure.") : bodyLocked ? t(seatedBench && !activeMachine ? "Select the bench to move the figure" : "Select the machine to move the figure") : tool === "rotate" ? t("Drag a colored ring to rotate") : tool === "translate" ? t("Drag an arrow to move") : t("Drag the figure or equipment to move it")}</span>
          </div>}
          </>} />}
        </div>

      </div>
<div data-workshop-controls-scroll hidden={focusMode} className={"min-h-0 min-w-0 overflow-y-auto bg-card " + (focusMode ? "hidden" : "md:block md:border-s " + (mobileEditing ? "block" : "hidden"))}>
      <div className="sticky top-0 z-20 bg-card"><WorkshopToolNavigation selected={panel} onSelect={openTool} /></div>
      <aside data-tutorial-target="inspector" aria-label={t("Workshop controls")} className="min-w-0 space-y-5 p-4" inert={dragging}>
        {panel === "placement" && selection && interactionMode === "edit" && <WorkshopFineAdjustment
          plane={dragPlane} disabled={dragging || adjusting || !!captureElbow || playing}
          canNudge={selectedLimb ? !limbPoseBlock(scene, selectedLimb) : selectedJoint ? !jointBlocked : !bodyLocked && !placementLocked}
          rotating={tool === "rotate" || !!selectedJoint && !selectedLimb}
          axes={selectedJoint && !selectedLimb ? isElbow || isKnee ? ["x"] : frontalShoulder ? ["z"] : ["x", "y", "z"] : undefined}
          step={tool === "rotate" || !!selectedJoint && !selectedLimb ? nudgeAngle : nudgeDistance}
          onStep={tool === "rotate" || !!selectedJoint && !selectedLimb ? setNudgeAngle : setNudgeDistance} onNudge={nudgeSelection} />}
        {limbPosing && interactionMode === "edit" && <div className="space-y-2 text-sm text-muted-foreground">{limbBlockReasons.map(reason => <p key={reason}>{reason}</p>)}{Math.round(timeMs) !== current.timeMs && <button type="button" onClick={() => poseMoment(timeMs)} className={buttonClass}>{t("Edit this moment")}</button>}</div>}
        <label className="block border-b border-border pb-5 text-sm font-semibold text-muted-foreground">{t("Selected item")}<select aria-label={t("Selected item")} value={object?.id ?? (selectedJoint ? `joint:${selectedJoint}` : selection?.kind === "body" ? "body" : "")} onChange={event => selectObject(!event.target.value ? null : event.target.value === "body" ? { kind: "body" } : { kind: "object", id: event.target.value })} className={`${inputClass} text-foreground`}>
          <option value="">{t("No selection")}</option>{selectedJoint && <option value={`joint:${selectedJoint}`} disabled>{t(jointNames[selectedJoint])}</option>}<option value="body">{t("Anatomical figure")}</option>{studio.objects.map(item => <option key={item.id} value={item.id} data-workshop-translate="false">{objectLabel(item)}{["left", "right", "both"].includes(item.attachment) ? ` · ${t(item.attachment === "both" ? "Held with both hands" : `Held with ${item.attachment} hand`)}` : ""}</option>)}
        </select></label>
        {object && <button type="button" onClick={toggleItemLock} disabled={dragging || adjusting || playing} aria-pressed={lockedItemIds.includes(object.id)} aria-label={t(lockedItemIds.includes(object.id) ? "Unlock placement" : "Lock placement")} className={buttonClass}>{t(lockedItemIds.includes(object.id) ? "Unlock placement" : "Lock placement")} <kbd dir="ltr">L</kbd></button>}
        <WorkshopToolPanel tool="equipment" selected={panel}><section className="space-y-3"><h2 className="text-sm font-semibold">{t("Scene setup")}</h2><p className="text-sm text-muted-foreground">{t("Add equipment above, or choose the figure for a bodyweight exercise. Select an item to adjust its position or contacts.")}</p>{panel === "equipment" && plateRowControls}{object && <button type="button" onClick={removeObject} className={buttonClass}><Trash2 size={14} />{t("Remove item")}</button>}</section></WorkshopToolPanel>
        <WorkshopToolPanel tool="setups" selected={panel}>
          <details className="rounded-lg border p-3"><summary className="min-h-11 cursor-pointer content-center font-semibold">{t("Body support setups")}</summary>
            <p className="my-3 text-sm text-muted-foreground">{t("Start with editable supports. Applying replaces body poses across the movement; Undo restores them.")}</p>
            <div className="grid gap-2">{supportSetups.map(setup => <button key={setup} type="button" className={buttonClass} disabled={setup.startsWith("bench") && !studio.objects.some(item => item.slug === "bench")} onClick={() => {
              const rig = supportRig.current;
              if (!rig) { setEditError("Wait for the preview before applying a support setup."); return; }
              const next = createSupportSetup(scene, setup, rig);
              if (updateContacts(() => next, `Apply ${supportSetupLabels[setup]}`)) { setSupportRegion(next.studio?.supports?.[0]?.region ?? "left-hand"); setSelection({ kind: "body" }); setPlaying(false); setPanel("contact"); }
            }}>{t(supportSetupLabels[setup])}</button>)}</div>
          </details>
          <WorkshopSetups expanded ownerId={ownerId} scene={scene} onApply={next => { update(next, "Apply equipment setup"); setSelection({ kind: "body" }); setPlaying(false); setTimeMs(current.timeMs); }} />
        </WorkshopToolPanel>
        <WorkshopToolPanel tool="view" selected={panel} eager><h2 className="text-lg font-semibold">{t("View and muscles")}</h2><div className="flex flex-wrap gap-2"><button type="button" aria-pressed={comparison} disabled={dragging} onClick={() => { setComparison(!comparison); setPlaying(false); }} className={buttonClass}>{comparison ? t("Close comparison") : t("Compare start and finish")}</button><button type="button" aria-expanded={previewOpen} onClick={() => setPreviewOpen(!previewOpen)} className={buttonClass}>{previewOpen ? t("Collapse preview") : t("Show preview")}</button></div><div ref={setViewControlsTarget} /></WorkshopToolPanel>
        <WorkshopToolPanel tool="timeline" selected={panel}>{object && (!held || isStudioMachine(object.slug)) && object.slug !== "bench" && object.slug !== "squat-rack" && <InspectorSection title={t("Equipment movement")} visible={panel === "timeline"}>          {object && <div className="mt-4 space-y-2 rounded-lg border p-3 text-sm">
            <button type="button" aria-pressed={!!rawObject?.frames?.length} className={buttonClass} onClick={() => {
              const enabled = !rawObject?.frames?.length;
              const animated = setStudioObjectAnimated(rawObject!, enabled, current.timeMs, scene.keyframes.map(frame => frame.timeMs));
              updateObject(object.id, animated); setPlaying(false); setTimeMs(current.timeMs);
            }}>{rawObject?.frames?.length ? t("Stop animation and edit placement") : t("Animate selected item")}</button>
            <p>{rawObject?.frames?.length ? `Editing ${label(current.timeMs)}. Changes affect this moment only.` : t("Static placement. Changes apply to the whole scene.")}</p>
          </div>}
          {object && isStudioMachine(object.slug) && <div className="space-y-3">
            <fieldset className="block text-base font-semibold"><legend>{object.machineMode === "reverse" ? t("Arm opening") : machineTravelLabels[object.slug]}</legend>
              <WorkshopGestureRange gesture={gesture} aria-label={object.machineMode === "reverse" ? t("Arm opening") : machineTravelLabels[object.slug]} min={0} max={1} step={0.01} value={object.machinePosition ?? 0.5} onChange={event => {
                changeMachineTravel(Number(event.target.value));
              }} className="mt-2 w-full accent-primary" />
              <WorkshopNumberField label={t(`${object.machineMode === "reverse" ? "Arm opening" : machineTravelLabels[object.slug]} percent`)} min={0} max={100} step={1} value={Math.round((object.machinePosition ?? 0.5) * 100)} onChange={value => {
                changeMachineTravel(value / 100);
              }} />
            </fieldset>
            {object.slug === "cable-row-machine" && <div className="space-y-2"><WorkshopNumberField label={t("Handle height meters")} min={rowHandleHeight.min * object.scale} max={rowHandleHeight.max * object.scale} step={.05 * object.scale} value={Math.round((object.machineHandleHeight ?? rowHandleHeight.standard) * object.scale * 100) / 100} onChange={height => {
              updateObject(object.id, setMachineHandleHeight(rawObject!, height / object.scale, current.timeMs)); setPlaying(false); setTimeMs(current.timeMs);
            }} /><WorkshopGuidance className="text-sm text-muted-foreground">{t("Changes handle height at the editing moment. The seat, footplates and pulley stay in place.")}</WorkshopGuidance></div>}
          </div>}

          </InspectorSection>}        <section data-tutorial-target="timeline" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">{t("Timeline")}</h2>
            <button type="button" aria-label={t("Add pose")} title={t("Add pose")} onClick={() => addFrame()} disabled={dragging || scene.keyframes.length >= 24} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-muted"><Plus size={16} />{t("Add pose")}</button>
          </div>
          <WorkshopNumberField label="Time to finish seconds" min={0.125} max={6} step={0.1} maximumFractionDigits={3} value={scene.durationMs / 2000} disabled={dragging} onChange={seconds => changeDuration(Math.round(seconds * 2000))} />
          <p className="text-xs text-muted-foreground">{t("Full repetition: {seconds}s, including the return.", { seconds: scene.durationMs / 1000 })}</p>
          <div ref={timelineRows} data-timeline-rows role="group" aria-label={t("Saved poses")}  className="divide-y divide-border border-y border-border">
            {scene.keyframes.map((frame, index) => <button key={`${frame.timeMs}-${index}`} type="button" disabled={dragging} aria-pressed={selectedFrame === index && Math.round(timeMs) === frame.timeMs} onFocus={() => selectFrame(index)} onClick={() => selectFrame(index)} className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-muted disabled:opacity-40 aria-pressed:bg-primary/10 aria-pressed:font-semibold aria-pressed:text-primary">
              <span>{t(workshopMomentName(frame.timeMs, scene.durationMs, index))}<span className="sr-only"> · </span></span><span className="tabular-nums text-muted-foreground">{label(frame.timeMs)}</span>
            </button>)}
          </div>
          <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">{t("Advanced pose actions")}</summary>
          <p id="timeline-shortcuts" className="text-xs text-muted-foreground">{t("Pose shortcuts: Ctrl / ⌘ + X / C / V / D, Delete, arrow keys. Undo restores changes.")}</p>
          <div className="space-y-2 rounded-lg border border-border p-3">
            <label className="block text-sm font-semibold">{t("Poses from start to finish")}<select aria-label={t("Poses from start to finish")} value={posesPerHalf} onChange={event => setPosesPerHalf(Number(event.target.value))} className={inputClass}>{[3, 5, 9].map(count => <option key={count} value={count}>{count}</option>)}</select></label>
            <p className="text-xs text-muted-foreground">{t("Even spacing: {seconds}s. Also fills the return. Existing poses stay.", { seconds: (scene.durationMs / 2000 / (posesPerHalf - 1)).toFixed(3) })}</p>
            <button type="button" onClick={addSpacedFrames} disabled={dragging || scene.keyframes.length >= 24} className={`${buttonClass} w-full`}>{t("Add evenly spaced poses")}</button>
          </div>
          {!scene.keyframes.some(frame => frame.timeMs === Math.round(timeMs)) && <button type="button" aria-label={t("Edit this moment")} onClick={() => { const moment = editWorkshopMoment(scene, Math.round(timeMs)); if (update(moment.scene)) { setSelectedFrame(moment.index); setPlaying(false); enterEditor({ mode: "select" }); } }} disabled={dragging || scene.keyframes.length >= 24} className={`${buttonClass} w-full`}>{t("Edit this moment")} · {label(timeMs)}</button>}
          <section aria-label={t("Selected pose")} className="space-y-3">
            <div className="flex items-center gap-2">
              <button type="button" onClick={editFrame} disabled={dragging} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-border px-3 text-sm font-semibold hover:bg-muted disabled:opacity-40">{t("Edit pose")}</button>
              <button type="button" aria-label={t("Delete pose")} title={t("Delete pose")} onClick={removeFrame} disabled={scene.keyframes.length <= 2 || dragging} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-40"><Trash2 size={16} /></button>
            </div>
              {selectedFrame > 0 && selectedFrame < scene.keyframes.length - 1 ? <form key={`${selectedFrame}-${current.timeMs}`} onSubmit={event => { event.preventDefault(); changeFrameTime(String(new FormData(event.currentTarget).get("frameTime") ?? "")); }} className="flex flex-wrap items-end gap-2">
                <label className="text-xs font-semibold">{t("Frame time · seconds")}<input name="frameTime" aria-label={t("Keyframe time seconds")} type="number" step="0.001" required defaultValue={current.timeMs / 1000} disabled={dragging} className={`${inputClass} max-w-36`} /></label>
                <button type="submit" disabled={dragging} className={buttonClass}>{t("Update time")}</button>
              </form> : null}
              {frameError && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{t(frameError)}</p>}
          </section>
          <WorkshopDisclosure title="Pose actions">
            <div className="flex min-w-0 items-end gap-2"><label className="min-w-0 flex-1 text-sm">{t("Copy pose to")}<select aria-label={t("Copy pose destination")} value={copyTarget} onChange={event => setCopyTarget(Number(event.target.value))} className={inputClass}>{scene.keyframes.map((frame, index) => <option key={index} value={index}>{t(workshopMomentName(frame.timeMs, scene.durationMs, index))} · {label(frame.timeMs)}</option>)}</select></label><button type="button" aria-label={t("Copy to chosen pose")} disabled={copyTarget === selectedFrame} onClick={() => { if (update(carryHeldWeights(scene, copyWorkshopPose(scene, selectedFrame, copyTarget)))) setFirstPoseInitialized(true); }} className={buttonClass}>{t("Copy")}</button></div>
            <div className="grid gap-2"><button type="button" onClick={() => { if (update(carryHeldWeights(scene, copyWorkshopPose(scene, selectedFrame, "all")))) setFirstPoseInitialized(true); }} className={buttonClass}>{t("Copy to all poses")}</button><button type="button" onClick={() => update(carryHeldWeights(scene, mirrorWorkshopPose(scene, selectedFrame)))} className={buttonClass}>{t("Mirror sides")}</button><button type="button" onClick={() => { if (update(matchWorkshopLoop(scene))) setFirstPoseInitialized(true); }} className={buttonClass}>{t("Match loop end to start")}</button></div>
          </WorkshopDisclosure>
          <details name="workshop-dropdown" className="border-t pt-2 text-sm"><summary className="cursor-pointer text-muted-foreground">{t("Timeline settings")}</summary><div className="mt-3 flex flex-wrap items-center gap-3">
              <label>{t("Duration")}<select value={scene.durationMs} onChange={event => changeDuration(Number(event.target.value))} className="ml-2 rounded border bg-card p-2">{Array.from(new Set([1600, 2400, 3200, 4800, 6400, 8000, scene.durationMs])).sort((a, b) => a - b).map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
            </div></details>
          </details>
        </section></WorkshopToolPanel>
        <WorkshopToolPanel tool="pose" selected={panel}>
          <div className="space-y-2"><p className="text-sm leading-6 text-muted-foreground">{t("Choose a body joint below, or select it directly in the scene, to bend or turn it. Use Hands & feet to reposition a limb.")}</p></div>
          <WorkshopJointPicker compact selected={selectedJoint} bothSides={bothSides} onBothSidesChange={setBothSides} onSelect={slug => selectObject({ kind: "joint", slug })} />
          <InspectorSection title={t("Movement")} visible={panel === "pose" && !!selectedJoint}>          {selectedJoint ? <WorkshopJointValues active={panel === "pose"} scene={scene} playback={playback} sampler={inspectorSampler} joint={selectedJoint} initial={jointAngles}>{jointAngles => <div className="mt-3 space-y-3">
            {jointBlocked && <p className="text-xs text-muted-foreground">{t("Move the held weight, or release it to use these joint controls.")}</p>}
            {isWrist && <div className="flex flex-wrap gap-1">{[{ label: "Palm up", turn: -90 }, { label: "Neutral", turn: 0 }, { label: "Palm down", turn: 90 }].map(preset => <button type="button" key={preset.label} disabled={jointBlocked} title={preset.turn === -90 ? t("Supinated") : preset.turn === 90 ? t("Pronated") : t("Neutral grip")} aria-pressed={jointAngles.x === preset.turn} onClick={() => setPose(selectedJoint, { ...jointAngles, x: preset.turn }, "x")} className={`${buttonClass} ${jointAngles.x === preset.turn ? "bg-primary/10 text-primary" : ""}`}>{t(preset.label)}</button>)}</div>}
            {frontalShoulder && <WorkshopGuidance className="text-xs text-muted-foreground">{t("Frontal-plane lock applies to both shoulders across all keyframes. Edit side-to-side motion below.")}</WorkshopGuidance>}
            {selectedJoint.endsWith("shoulder") && <div className="space-y-2">
              <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={elbowFollowsShoulder} disabled={playing || dragging} onChange={event => setElbowFollowsShoulder(event.target.checked)} />{t("Elbow follows shoulder")}</label>
              {elbowFollowsShoulder && <p className="text-sm text-muted-foreground">{t("Use the shoulder controls below. The elbow follows, keeping any held equipment attached.")}</p>}
            </div>}
            {(["x", "y", "z"] as const).filter(axis => (!(isKnee || isElbow) || axis === "x") && (!frontalShoulder || axis === "z")).map(axis => {
              const range = jointControlRange(selectedJoint, axis);
              const value = jointControlValue(selectedJoint, axis, jointAngles[axis]);
              const changeAngle = (value: number) => setPose(selectedJoint, { ...jointAngles, [axis]: jointControlValue(selectedJoint, axis, clamp(value, ...range)) }, axis);
              const action = isWrist ? axis === "x" ? "Palm turn" : axis === "y" ? "Wrist bend" : "Wrist tilt" : isAnkle ? axis === "x" ? "Toes up / down" : axis === "y" ? "Foot turn" : "Foot tilt" : axis === "x" ? "Bend" : axis === "y" ? "Turn" : "Side to side";
              return <fieldset key={`${selectedJoint}-${axis}`} className="space-y-2"><legend className="text-base font-semibold">{action}</legend><WorkshopGestureRange gesture={gesture} aria-label={t(`${action} ${jointControlName} degrees`)} disabled={jointBlocked} min={range[0]} max={range[1]} value={value} onChange={event => changeAngle(Number(event.target.value))} className="w-full accent-primary disabled:opacity-40" /><WorkshopNumberField label={t(`${action} ${jointControlName} degrees`)} disabled={jointBlocked} min={range[0]} max={range[1]} maximumFractionDigits={2} value={value} onChange={changeAngle} /></fieldset>;
            })}
            <button type="button" disabled={jointBlocked} onClick={() => setPose(selectedJoint, { x: 0, y: 0, z: 0 })} className={buttonClass}>{t("Reset joint")}</button>
            <p className="text-xs text-muted-foreground">{isWrist ? t("Turn the palm, bend the wrist, or tilt it sideways.") : isKnee ? t("0° is straight. Positive bends the knee backward; extension is limited to 5°.") : isAnkle ? t("Raise or point the toes, turn the foot, or tilt it sideways.") : t("Drag a rotation ring, or use these sliders.")}</p>
            {controllingWeight && <details open={jointBlocked} className="border-t text-xs">
              <summary className="min-h-11 cursor-pointer content-center text-sm text-muted-foreground">{t("Held equipment")}</summary>
              <p>{controllingWeight.machineUse ? `${controllingWeight.name} keeps the hands and feet in contact. Select the machine to change travel.` : controllingWeight.attachment === "both" && !jointBlocked ? t("Bend a joint to move the weight. Both hands stay attached.") : controllingWeight.elbowLocks ? t("Elbow support holds this arm in place. Release the support or weight to pose freely.") : jointBlocked ? t("Move the held weight to pose this arm. Choose Free posing to edit a held dumbbell with joint controls.") : t("The arm and held weight move together. Use the joint controls or drag the hand or weight.")}</p>
              <button type="button" onClick={() => { updateContacts(() => ({ ...scene, studio: { ...studio, objects: studio.objects.map(item => item.id === controllingWeight.id ? { ...changeGripAttachment(item, "none"), machineUse: item.machineUse === undefined ? undefined : false, elbowLocks: undefined } : item) } })); setCaptureElbow(null); }} className={`${buttonClass} mt-2`}>{controllingWeight.machineUse ? t("Stop using machine to pose freely") : t("Release weight")}</button>
              <button type="button" onClick={() => selectObject({ kind: "object", id: controllingWeight.id })} className={`${buttonClass} mt-2`}>{controllingWeight.machineUse ? t("Select machine") : t("Select held weight")}</button>
            </details>}
          </div>}</WorkshopJointValues> : null}
</InspectorSection>
          <WorkshopDisclosure title="Pose options">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={poseScope === "all"} onChange={event => setPoseScope(event.target.checked ? "all" : "selected")} />{t("Apply to all poses")}</label>
            <label className="flex items-center gap-2 text-sm" title={t("Restricts both shoulders to side-to-side movement across every pose. One Undo restores all previous poses.")}><input aria-label={t("Frontal-plane lock")} type="checkbox" checked={!!studio.frontalPlane} disabled={dragging} onChange={event => { update(setFrontalPlane(scene, event.target.checked)); setPlaying(false); setTimeMs(current.timeMs); }} />{t("Side-to-side shoulder movement only")}</label>
            <button type="button" disabled={dragging || !activeMachine && blockedJoints.length === jointSlugs.length} onClick={resetJoints} className={buttonClass}>{t("Reset all joints")}</button>
          </WorkshopDisclosure>
        </WorkshopToolPanel>
        <section hidden={!["placement", "contact"].includes(panel)} aria-label={t("Selected item")} data-grip-reachable={object && gripReach[object.id] === false ? "false" : "true"}>
          <h2 className="text-base font-semibold">{selectedJoint ? jointNames[selectedJoint] : object ? <span data-workshop-translate="false">{objectLabel(object)}</span> : t("Anatomical figure")}</h2>
          <WorkshopToolPanel tool="contact" selected={panel}>{cableControls}{(!object || object.slug === "bench") && benchControls}{seatingControls}
          {!object && <WorkshopSupportControls region={supportRegion} contact={selectedSupport} picking={!!supportEdit?.picking} adjusting={!!supportEdit?.adjusting} repositioning={supportRepositioning}
            error={supportError ?? (supportReports.some(report => report.region === supportRegion && !report.reachable) ? "This support is beyond reach. Reposition the body or move the contact closer." : supportReports.some(report => report.region === supportRegion && report.orientationLimited) ? "Contact angle is limited. Adjust the contact orientation or nearby joints." : undefined)}
            onRegionChange={region => { cancelSupportEdit(); setSupportRegion(region); }}
            onPick={() => { setPlaying(false); setGripEdit(null); enterEditor({ mode: "select" }); setSupportError(undefined); setSupportEdit({ region: supportRegion, picking: true, adjusting: false }); setMobileEditing(false); }}
            onAdjust={() => { setPlaying(false); enterEditor({ mode: "select" }); setSupportEdit({ region: supportRegion, picking: false, adjusting: true }); setMobileEditing(false); }}
            onChange={contact => placeSupport(contact, true)} onRelease={releaseSupport} onReposition={repositionForSupports}
            onConfirmReposition={() => { endDrag(); setSupportRepositioning(false); }} onCancel={cancelSupportEdit} />}
          {object?.slug === "cable-row-machine" && <section className="space-y-2 rounded-xl border p-3"><p className="text-sm">{t("Seated row links the seat, feet and handle. Free cable movement lets you pose the whole body.")}</p><button type="button" onClick={freeCable} className={buttonClass}>{t("Free cable movement")}</button></section>}
          {object?.slug === "resistance-band" && <WorkshopBandControls object={object} objects={studio.objects} disabled={dragging || adjusting || playing} onChange={band => updateObject(object.id, { band })} />}
          {object && ["stool", "plyo-box"].includes(object.slug) && <p className="text-sm text-muted-foreground">{t("Place or rotate this support, then select a body part and choose Support on… to use any solid face.")}</p>}
          {object && (isStudioMachine(object.slug) || canHold) && <InspectorSection title={t("Contact")} visible={panel === "contact"}>
          {object && isStudioMachine(object.slug) && <div className="mt-4 space-y-3 rounded-xl bg-primary/5 p-3">
            {object.slug === "smith-machine" && <fieldset className="space-y-2"><legend className="text-sm font-semibold">{t("Bar travel limits")}</legend>
              <WorkshopNumberField label={t("Lowest bar height meters")} min={.3} max={(object.machineRange?.max ?? 2.18) - .1} step={.05} value={object.machineRange?.min ?? 1.53} onChange={min => updateObject(object.id, { machineRange: { min, max: object.machineRange?.max ?? 2.18 } })} />
              <WorkshopNumberField label={t("Highest bar height meters")} min={(object.machineRange?.min ?? 1.53) + .1} max={3.05} step={.05} value={object.machineRange?.max ?? 2.18} onChange={max => updateObject(object.id, { machineRange: { min: object.machineRange?.min ?? 1.53, max } })} />
              <p className="text-xs text-muted-foreground">{t("Set the rail range for presses, pulls or squats. Stop using machine to pose the figure and add your own supports.")}</p>
            </fieldset>}
            {object.slug === "pec-deck" && <label className="block text-xs font-semibold">{t("Pec deck mode")}<select aria-label={t("Pec deck mode")} value={object.machineMode ?? "regular"} onChange={event => {
              const machineMode = event.target.value as "regular" | "reverse";
              update(setPecDeckMode(scene, object.id, machineMode)); setPlaying(false);
            }} className={inputClass}>
              <option value="regular">{t("Regular")}</option><option value="reverse">{t("Reverse")}</option>
            </select></label>}
            {object.slug === "lat-pulldown-machine" && <label className="block text-xs font-semibold">{t("Pulldown grip")}<select aria-label={t("Pulldown grip")} value={object.machineGrip ?? "supinated"} onChange={event => updateObject(object.id, { machineGrip: event.target.value as "supinated" | "pronated" })} className={inputClass}>
              <option value="supinated">{t("Supinated · palms toward you")}</option><option value="pronated">{t("Pronated · palms away from you")}</option>
            </select></label>}
            {["shoulder-press-machine", "chest-press-machine"].includes(object.slug) && <section aria-label={t(object.slug === "chest-press-machine" ? "Chest press setup" : "Shoulder press setup")} className="space-y-3">
              <label className="block text-sm font-semibold">{t("Press grip")}<select aria-label={t("Press grip")} value={object.pressGrip ?? "wide"} onChange={event => updateObject(object.id, { pressGrip: event.target.value as StudioObject["pressGrip"], gripOffsets: undefined })} className={inputClass}>
                <option value="wide">{t("Wide grip · elbows out")}</option>{object.slug === "chest-press-machine" && <option value="angled">{t("Angled grip")}</option>}<option value="neutral">{t("Neutral grip · elbows forward")}</option>
              </select></label>
              {(["left", "right"] as const).map(side => <WorkshopNumberField key={side} label={side === "left" ? "Left press travel percent" : "Right press travel percent"} min={0} max={100} step={1}
                value={Math.round(((side === "left" ? object.machinePositionLeft : object.machinePositionRight) ?? object.machinePosition ?? .5) * 100)} onChange={value => {
                  changeMachineTravel(value / 100, side);
                }} />)}
            </section>}
            {object.slug === "t-bar-row-machine" && <section className="space-y-3" aria-label={t("T-bar row contacts")}>
              <label className="block text-sm font-semibold">{t("T-bar grip")}<select aria-label={t("T-bar grip")} value={object.rowGrip ?? "neutral"} onChange={event => updateObject(object.id, { rowGrip: event.target.value as "neutral" | "wide", ...(object.rowGrip === undefined && object.machineUse && object.attachment === "none" ? { attachment: "both" as const } : {}), gripOffsets: undefined })} className={inputClass}>
                <option value="neutral">{t("Neutral grip")}</option><option value="wide">{t("Wide grip")}</option>
              </select></label>
              {object.machineUse && <button type="button" className={buttonClass} aria-pressed={object.rowFootSupport !== false} onClick={() => object.rowFootSupport === false ? updateObject(object.id, { rowFootSupport: true }) : update(releaseTBarFeet(scene))}>{object.rowFootSupport === false ? t("Restore foot support") : t("Release foot support")}</button>}
            </section>}
            <button type="button" aria-pressed={!!object.machineUse} onClick={() => {
              updateContacts(() => ({ ...scene, motionStyle: "free", equipment: null, studio: { ...studio, seating: undefined, objects: studio.objects.map(item => ({ ...changeGripAttachment(item, item.id === object.id && (["row-machine", "t-bar-row-machine", "shoulder-press-machine", "chest-press-machine"].includes(item.slug) || item.slug === "cable-row-machine" && item.cableAttachment) ? item.attachment : "none"),
                machineUse: item.id === object.id ? !object.machineUse : item.machineUse === undefined ? undefined : false,
                elbowLocks: undefined })) } }));
              setPlaying(false);
            }} className={`${buttonClass} ${object.machineUse ? "bg-primary text-primary-foreground" : "bg-card"}`}>{object.machineUse ? t("Stop using machine") : t("Use this machine")}</button>
            {object.id === exampleMachineId && <p className="text-xs text-muted-foreground">{object.machineMode === "reverse" ? t("Face the pad with your chest supported and feet planted. Open both arms outward, then return with control.") : machineContactDescriptions[object.slug]}</p>}
            {!(object.slug === "cable-row-machine" && object.cableAttachment) && <WorkshopGripControls object={object} onChange={choices => updateObject(object.id, choices)} onPreviewPose={pose => previewTime(pose === "start" ? 0 : scene.durationMs / 2)} reach={machineReach} />}
            {panel === "contact" && plateRowControls}
            <WorkshopGuidance className="text-xs text-muted-foreground">{t("Animate selected item creates editable moments for moving parts. The frame stays in place.")}</WorkshopGuidance>
          </div>}
          {weightGripControls}
          {canHold && !["cable-machine", "cable-row-machine"].includes(object.slug) && <div className="mt-4 rounded-xl bg-primary/5 p-3">
            {!weight && <><WorkshopGuidance className="mb-2 text-sm">{t("Holding or attaching replaces contacts in the chosen hand and clears their elbow locks. An engaged machine is released. One Undo restores the scene.")}</WorkshopGuidance><h3 className="text-sm font-semibold">{t(isStudioMachine(object.slug) ? "Hold this equipment" : "Hold this weight")}</h3>
            <div className="mt-2 flex flex-wrap gap-2">{(["left", "right", ...(canHoldBoth ? ["both"] : [])] as ("left" | "right" | "both")[]).map(hand => <button key={hand} type="button" aria-pressed={object.attachment === hand} onClick={() => holdObject(hand)} className={`${buttonClass} ${object.attachment === hand ? "bg-primary text-primary-foreground" : "bg-card"}`}>{`Hold with ${hand === "both" ? "both hands" : `${hand} hand`}`}</button>)}</div></>}
            {held && <><p className="mt-3 flex items-center gap-1 text-xs font-semibold"><Check size={13} />{object.attachment === "both" ? t("Held with both hands") : `Held with ${object.attachment} hand`}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t(isStudioMachine(object.slug) ? "Hands follow the machine grips. Body placement and supports stay editable." : "Joint edits keep the weight in the hand. Drag the weight to pose the arm.")}</p>
              {gripReach[object.id] === false && (object.slug !== "dumbbell" || Object.keys(object.elbowLocks ?? {}).length > 0) && <p role="alert" className="mt-2 text-xs text-amber-700">{Object.keys(object.elbowLocks ?? {}).length ? t("Outside the locked elbow’s reach. Move the weight along the curl arc, or unlock the elbow.") : t("Too far to reach. Move the weight closer to the figure.")}</p>}
              {!weight && <button type="button" onClick={() => holdObject("none")} className={`${buttonClass} mt-2 bg-card`}>{t("Release")}</button>}<div className="mt-2 flex flex-wrap gap-1">{(["left", "right"] as const).filter(side => object.attachment === side || object.attachment === "both").flatMap(side => (["wrist"] as const).map(joint => <button key={`${side}-${joint}`} type="button" onClick={() => selectObject({ kind: "joint", slug: `${side}-${joint}` })} className={`${buttonClass} bg-card`}>{side === "left" ? t("Left") : t("Right")} {joint}</button>))}</div>
              {["barbell", "dumbbell", "kettlebell"].includes(object.slug) && <WorkshopDisclosure title="Elbow support">
                <WorkshopGuidance className="text-xs text-muted-foreground">{t("Lock an elbow at its current position relative to the figure. Position the arm on the pad first, then keep the weight within reach.")}</WorkshopGuidance>
                {(["left", "right"] as const).filter(side => object.attachment === side || object.attachment === "both").map(side => <button key={side} type="button" disabled={!!captureElbow || playing || dragging} aria-pressed={!!object.elbowLocks?.[side]} onClick={() => {
                  if (object.elbowLocks?.[side]) { const locks = { ...object.elbowLocks }; delete locks[side]; updateObject(object.id, { elbowLocks: locks }); }
                  else { setPlaying(false); setTimeMs(current.timeMs); setCaptureElbow({ objectId: object.id, side }); }
                }} className={`${buttonClass} bg-card`}>{object.elbowLocks?.[side] ? t("Unlock") : t("Lock")} {side} {t("elbow")}</button>)}
              </WorkshopDisclosure>}
            </>}
          </div>}
          {object?.slug === "cable-machine" && <div className="mt-4 space-y-3">
            <fieldset className="space-y-2"><legend className="text-xs font-semibold">{t("Align pulley beside shoulder")}</legend>
              <div className="flex flex-wrap gap-2">{(["left", "right"] as const).map(side => <button key={side} type="button" aria-pressed={object.shoulderAlignment === side} onClick={() => updateObject(object.id, { shoulderAlignment: side })} className={`${buttonClass} ${object.shoulderAlignment === side ? "bg-primary/10 text-primary" : ""}`}>{t("Beside {side} shoulder", { side })}</button>)}</div>
              {object.shoulderAlignment && <><WorkshopGuidance className="text-xs text-muted-foreground">{t("Follows the shoulder when the figure or bench moves. Pulley height stays adjustable.")}</WorkshopGuidance><button type="button" onClick={() => transformObject(object.id, object)} className={buttonClass}>{t("Use manual placement")}</button></>}
            </fieldset>
            <fieldset className="block text-base font-semibold"><legend>{t("Pulley height · meters")}</legend><WorkshopGestureRange gesture={gesture} aria-label={t("Pulley height meters")} min={0.2} max={maxPulleyHeight} step={0.05} value={object.pulleyHeight} onChange={event => updateObject(object.id, { pulleyHeight: Number(event.target.value) })} className="mt-2 w-full accent-primary" />
              <WorkshopNumberField label={t("Pulley height meters")} min={0.2} max={maxPulleyHeight} step={0.05} value={object.pulleyHeight} onChange={pulleyHeight => updateObject(object.id, { pulleyHeight })} /></fieldset>
            <div className="flex flex-wrap gap-2">{[["Near feet", .3], ["Near waist", 1.3], ["Near shoulders", 2.2], ["Above head", 2.8]].map(([label, height]) => <button key={label} type="button" onClick={() => updateObject(object.id, { pulleyHeight: clamp((studio.body.y + Number(height) * studio.body.scale - object.y) / object.scale, .2, maxPulleyHeight) })} className={buttonClass}>{t(String(label))}</button>)}</div>
          </div>}

            {object.slug !== "bench" && object.slug !== "squat-rack" && <WorkshopGripEditor object={object} side={gripEdit?.objectId === object.id ? gripEdit.side : object.attachment === "right" ? "right" : "left"}
            picking={gripEdit?.objectId === object.id && gripEdit.picking} disabled={playing || dragging}
            onEdit={side => editGrip(side)} onPick={() => editGrip(gripEdit?.objectId === object.id ? gripEdit.side : object.attachment === "right" ? "right" : "left", !(gripEdit?.objectId === object.id && gripEdit.picking))}
            onChange={(side, point) => { updateObject(object.id, { gripOffsets: setGripOffset(rawObject!, side, point).gripOffsets }); editGrip(side); }} />}
          </InspectorSection>}
</WorkshopToolPanel>
<WorkshopToolPanel tool="placement" selected={panel}>          {!selectedJoint && <InspectorSection title={t("Placement")} visible={panel === "placement"}>
          {!object && seatingControls}
          {object?.slug === "cable-machine" && <fieldset className="space-y-2"><legend className="font-semibold">{t("Cable tower position")}</legend><div className="grid grid-cols-2 gap-2">{([['front', 'In front'], ['behind', 'Behind figure'], ['left', 'Left of figure'], ['right', 'Right of figure']] as const).map(([side, label]) => <button key={side} type="button" disabled={dragging} onClick={() => changeTransform(cableTowerPlacement(studio.body, object, side))} className={buttonClass}>{t(label)}</button>)}</div><div className="flex flex-wrap gap-2">{[-90, 90].map(turn => <button key={turn} type="button" disabled={dragging} onClick={() => changeTransform({ ...object, rotationY: ((object.rotationY + turn + 540) % 360) - 180 })} className={buttonClass}>{t(turn < 0 ? "Turn tower left" : "Turn tower right")}</button>)}</div></fieldset>}
          {bodyLocked && activeMachine ? <div className="mt-3 space-y-3 text-xs">
            <p>{t("The figure follows")} <span data-workshop-translate="false">{activeMachine.name}</span>{t(". Select the machine to move it or change travel.")}</p>
            <button type="button" onClick={() => selectObject({ kind: "object", id: activeMachine.id })} className={buttonClass}>{t("Select machine")}</button>
            <button type="button" onClick={() => updateObject(activeMachine.id, { machineUse: false })} className={buttonClass}>{t("Stop using machine to pose freely")}</button>
          </div> : bodyLocked && seatedBench ? <div className="mt-3 space-y-3 text-xs">
            <p>{t("The figure follows the bench. Select the bench to move it, or leave the bench to place the figure freely.")}</p>
            <button type="button" onClick={() => selectObject({ kind: "object", id: seatedBench.id })} className={buttonClass}>{t("Select bench")}</button>
            <button type="button" onClick={() => update({ ...scene, studio: { ...studio, seating: undefined } })} className={buttonClass}>{t("Leave bench")}</button>
          </div> : <>
            <p className="mb-3 mt-1 text-xs text-muted-foreground">{object && lockedItemIds.includes(object.id) ? t("Placement locked. Press L to unlock. Locks last until you leave the editor.") : placementLocked ? t("Placement is locked while editing travel. Use Stop animation and edit placement to reposition the machine.") : `Place ${object ? "this item" : "the figure"} using the buttons or coordinates.`}</p>
            {automaticDumbbell && <p className="mt-2 text-xs text-muted-foreground">{t("Turn the wrist to rotate a held dumbbell.")}</p>}

          </>}
          {!selectedJoint && !bodyLocked && <WorkshopDisclosure key={`${object?.id ?? "body"}-${panel}`} title="Precise placement">
            <TransformFields value={selectedTransform} onChange={changeTransform} positionOnly disabled={placementLocked} />
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={snap} onChange={event => setSnap(event.target.checked)} />{t("Snap to grid")}</label>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={() => chooseTool("scale")} className={buttonClass}>{t("Resize")}</button></div>
            {object && <label className="block text-xs font-semibold">{t("Item name")}<input aria-label={t("Item name")} value={object.name} maxLength={60} onChange={event => updateObject(object.id, { name: event.target.value })} className={inputClass} /></label>}
            <TransformFields value={selectedTransform} onChange={changeTransform} disabled={placementLocked} rotationDisabled={automaticDumbbell} />
            {object && <button type="button" onClick={duplicate} disabled={studio.objects.length >= 20} className={buttonClass}>{t("Duplicate")}</button>}
          </WorkshopDisclosure>}

          </InspectorSection>}
</WorkshopToolPanel>

        </section>
        <WorkshopToolPanel tool="settings" selected={panel}>
        {scene.equipment && <section className="rounded-xl border p-3 text-xs"><p className="font-semibold">{equipmentOptions.find(item => item.slug === scene.equipment?.slug)?.label ?? scene.equipment.slug} {t("· demo equipment")}</p><button type="button" onClick={() => update({ ...scene, equipment: null })} className={`${buttonClass} mt-2`}>{t("Remove demo equipment")}</button></section>}
        <details name="workshop-dropdown" className="border-t border-border pt-3"><summary className="cursor-pointer text-xs font-semibold text-muted-foreground">{t("Advanced settings")}</summary><div className="mt-4 space-y-4">

          <label className="block text-xs font-semibold">{t("Movement setup")}<select value={scene.motionStyle ?? "free"} onChange={event => update({ ...scene, studio: { ...studio, seating: undefined }, motionStyle: event.target.value as WorkshopScene["motionStyle"] })} className={inputClass}>
            <option value="free">{t("Free posing")}</option><option value="squat">{t("Squat — feet planted")}</option><option value="hinge">{t("Hip hinge — feet planted")}</option><option value="row">{t("Bent-over row")}</option><option value="split-squat">{t("Stationary lunge")}</option><option value="bench-press">{t("Incline bench press")}</option><option value="seated-curl">{t("Seated biceps curl")}</option><option value="incline-curl">{t("Incline dumbbell curl")}</option>
          </select></label>
          <AnnotationFields annotations={scene.annotations ?? []} durationMs={scene.durationMs} actions={jointActions} onChange={annotations => update({ ...scene, annotations })} />
        </div></details></WorkshopToolPanel>
      </aside></div>
    </div>
    <div inert={moreOpen} className="shrink-0">{playbackControls}</div>
    {(status || tutorial.open) && <div className={status?.startsWith("Removed") || tutorial.open ? "flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-sm text-muted-foreground" : "sr-only"}>{status && <p role="status">{t(status)}</p>}{status?.startsWith("Removed") && <button type="button" onClick={undo} disabled={!past.length} className={buttonClass}>{t("Undo removal")}</button>}{tutorial.open && <span>{t("Camera looks around · Edit changes the scene")}</span>}</div>}
  {tutorial.open && <WorkshopTutorial root={workshopRoot} step={tutorial.step} onStep={index => { setPreviewOpen(true); setFocusMode(false); tutorial.update({ open: true, step: index }); }} onClose={closeTutorial} />}</div></>)}</WorkshopCommitMetrics></WorkshopGuidanceProvider></WorkshopLanguageProvider>;
}
