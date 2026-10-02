"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Box, Check, ChevronDown, Hand, Move3D, Pause, Play, Plus, Redo2, Rotate3D, Save, Trash2, Undo2, UserRound } from "lucide-react";
import { cableAttachmentSlugs, identityTransform, jointControlRange, jointControlValue, jointSlugs, sampleWorkshopPose, type BenchFacing, type CableAttachment, type JointAngles, type JointSlug, type SceneTransform, type StudioObject, type WorkshopScene } from "@/lib/motion/workshop";
import { cableAttachmentNames } from "@/lib/motion/studio-cable";
import { clamp, createStudioObject, heldEquipmentTransform, makeLegacyBarbellEditable, maxPulleyHeight, setStudioObjectAnimated, studioAttachmentSlots, updateStudioObjectTransform } from "@/lib/motion/studio";
import { benchFacingNames } from "@/lib/motion/studio-seat";
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
import { WorkshopLanguageProvider, translateWorkshopTree } from "./workshop-language";
import { copyWorkshopPose, createQuickScene, mirrorWorkshopPose, matchWorkshopLoop, workshopDemonstrationCaption } from "@/lib/motion/quick-create";
import { isWorkshopPlacementLocked } from "@/lib/motion/workshop-placement";
import { limbPoseBlock, poseLimbs } from "@/lib/motion/limb-pose";
import { workshopShortcut } from "@/lib/motion/workshop-shortcuts";
import { WorkshopShortcutGuide } from "./workshop-shortcut-guide";

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
  return <div className="space-y-4">
    {(positionOnly ? ["Position"] as const : ["Rotation"] as const).map(kind => <fieldset key={kind}>
      <legend className="text-xs font-semibold text-muted-foreground">{kind}{kind === "Rotation" ? " · degrees" : " · meters"}</legend>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">{(["x", "y", "z"] as const).map(axis => {
        const field = kind === "Position" ? axis : `rotation${axis.toUpperCase()}` as "rotationX" | "rotationY" | "rotationZ";
        const min = kind === "Rotation" ? -180 : axis === "y" ? -3 : -10, max = kind === "Rotation" ? 180 : 10;
        return <WorkshopNumberField key={axis} label={`${kind} ${axis.toUpperCase()} ${kind === "Position" ? "meters" : "degrees"}`} value={kind === "Position" ? Number(value[field].toFixed(3)) : value[field]} min={min} max={max} step={kind === "Position" ? 0.1 : 1} disabled={disabled} onChange={next => onChange({ ...value, [field]: next })} />;
      })}</div>
    </fieldset>)}
    {!positionOnly && <WorkshopNumberField label="Scale" min={0.5} max={2} step={0.1} value={value.scale} disabled={disabled} onChange={scale => onChange({ ...value, scale })} />}
  </div>;
}

export function MotionWorkshop({ privateId, initialScene, equipmentOptions, jointActions, ownerId = "local", initialName = "" }: {
  privateId: string | null; initialScene: WorkshopScene;
  ownerId?: string; initialName?: string;
  equipmentOptions: { slug: string; label: string; active: boolean }[];
  jointActions: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const [startingScene] = useState(() => makeLegacyBarbellEditable(initialScene, crypto.randomUUID()));
  const [scene, setScene] = useState(startingScene);
  const [name, setName] = useState(initialName);
  const [mode, setMode] = useState<"quick" | "advanced">("quick");
  const [step, setStep] = useState(privateId ? 1 : 0);
  const [language, setLanguage] = useState<"en" | "he">("en");
  const [interactionMode, setInteractionMode] = useState<"camera" | "edit">("camera");
  const [previewOpen, setPreviewOpen] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [poseScope, setPoseScope] = useState<"selected" | "all">("selected");
  const [copyTarget, setCopyTarget] = useState(0);
  const addButton = useRef<HTMLButtonElement>(null);
  const shortcutHelp = useRef<HTMLDetailsElement>(null);
  const [selectedFrame, setSelectedFrame] = useState(0);
  const [selection, setSelection] = useState<StudioSelection>({ kind: "body" });
  const [tool, setTool] = useState<StudioEditor["tool"]>("select");
  const [adding, setAdding] = useState(false);
  const [posing, setPosing] = useState(false);
  const [limbPosing, setLimbPosing] = useState(false);
  const [limbWarning, setLimbWarning] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [gripReach, setGripReach] = useState<Record<string, boolean>>({});
  const [machineReach, setMachineReach] = useState<MachineReachReport>();
  const onMachineReach = useCallback((report: MachineReachReport | undefined) => setMachineReach(report), []);
  const [captureElbow, setCaptureElbow] = useState<StudioEditor["captureElbow"]>(null);
  const [snap, setSnap] = useState(false);
  const [sensitivity, setSensitivity] = useState(0.35);
  const [timeMs, setTimeMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragPlane, setDragPlane] = useState<StudioDragPlane>("view");
  const dragSession = useRef<{ scene: WorkshopScene; latest: WorkshopScene; timeMs: number } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [frameError, setFrameError] = useState<string | null>(null);
  const [past, setPast] = useState<WorkshopScene[]>([]);
  const [future, setFuture] = useState<WorkshopScene[]>([]);
  const startedAt = useRef(0);
  const draft = useWorkshopDraft({ ownerId, privateId, initialScene: startingScene, initialName, scene, name, paused: dragging || !!captureElbow });
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
  const weightForJoint = (slug: JointSlug) => studio.objects.find(item => item.machineUse || ["barbell", "dumbbell", "kettlebell"].includes(item.slug)
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

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    startedAt.current = performance.now() - timeMs / speed;
    const tick = (now: number) => { setTimeMs(((now - startedAt.current) * speed) % scene.durationMs); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, scene.durationMs, speed]);

  const update = (next: WorkshopScene) => {
    if (dragSession.current) dragSession.current.latest = next;
    else { setPast(items => [...items.slice(-49), scene]); setFuture([]); }
    setScene(next); setStatus("Unsaved changes");
  };
  const beginDrag = () => {
    dragSession.current = { scene, latest: scene, timeMs: Math.round(timeMs) };
    setDragging(true);
  };
  const endDrag = (cancelled = false) => {
    const session = dragSession.current;
    if (session) {
      if (cancelled) { setScene(session.scene); setLimbWarning(null); }
      else if (JSON.stringify(session.latest) !== JSON.stringify(session.scene)) {
        setPast(items => [...items.slice(-49), session.scene]); setFuture([]);
      }
    }
    dragSession.current = null; setDragging(false);
  };
  const enableMouseMovement = (at?: number) => {
    setPlaying(false); setInteractionMode("edit"); setTool("select"); setPosing(false); setLimbPosing(false);
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
  const undo = () => { if (!past.length || dragging) return; setFuture(items => [scene, ...items]); restore(past[past.length - 1]); setPast(items => items.slice(0, -1)); };
  const redo = () => { if (!future.length || dragging) return; setPast(items => [...items, scene]); restore(future[0]); setFuture(items => items.slice(1)); };
  const selectFrame = (index: number) => { setPlaying(false); setSelectedFrame(index); setTimeMs(scene.keyframes[index].timeMs); setFrameError(null); };
  const previewTime = (time: number) => { setPlaying(false); setTimeMs(time); };
  const selectObject = (next: StudioSelection) => {
    setLimbPosing(false);
    setSelection(next); setPlaying(false); setTimeMs(current.timeMs);
    setTool(next?.kind === "joint" ? "rotate" : "select");
    if (next?.kind === "joint") setPosing(true);
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
  const leaveEquipment = () => {
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
        const placed = item.slug === "cable-machine" || attachment === "none" ? item : updateStudioObjectTransform(item, heldEquipmentTransform(studio.body, object, attachment), current.timeMs, Boolean(item.frames?.length));
        return { ...placed, attachment, elbowLocks: undefined };
      }
      if (attachment !== "none" && item.machineUse) return { ...item, machineUse: false };
      return studioAttachmentSlots(item).some(hand => hands.includes(hand)) && attachment !== "none" ? { ...item, attachment: "none", elbowLocks: undefined } : item;
    }) } });
    setPlaying(false); setTimeMs(current.timeMs);
  };
  const addObject = (slug: StudioObject["slug"]) => {
    if (studio.objects.length >= 20) { setStatus("The scene has 20 items. Remove an item before adding another."); return; }
    const next = createStudioObject(slug, crypto.randomUUID(), studio.objects.length);
    const machine = isStudioMachine(slug);
    if (slug === "bench" && activeMachine) next.rotationY = activeMachine.rotationY;
    update({ ...scene, equipment: machine ? null : scene.equipment, studio: { ...studio, seating: machine ? undefined : studio.seating, objects: [...studio.objects.map(item => machine ? { ...item, machineUse: item.machineUse === undefined ? undefined : false, attachment: "none" as const, elbowLocks: undefined } : item), { ...next, machineUse: machine ? true : next.machineUse }] } });
    setSelection({ kind: "object", id: next.id }); setTool("select"); setAdding(false); setPosing(false); setPlaying(false); setTimeMs(current.timeMs);
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
    void draft.saveNow().then(result => { if (continueToDetails && result?.privateId && !result.error && result.current) router.push(`/my-exercises/${result.privateId}/edit?sceneSaved=1`); });
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
      setLimbWarning(error > .025 ? "This target is beyond the limb's reach or joint limits. The closest pose within joint limits is shown."
        : limb.endsWith("foot") ? "Foot contact changed. Check the sole and floor from Side view before saving." : null);
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
    selection, tool, snap, sensitivity, playing, dragging, posing, onSelect: selectObject,
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
  const isCuff = object?.slug === "cable-machine" && object.cableAttachment === "cuff";
  const canHoldBoth = object && (["barbell", "kettlebell"].includes(object.slug) || object.slug === "cable-machine" && !["d-handle", "cuff"].includes(object.cableAttachment ?? "d-handle"));
  const held = object && object.attachment !== "none";
  const nudgeHeight = (amount: number) => changeTransform({ ...selectedTransform, y: Math.round(clamp(selectedTransform.y + amount, -3, 10) * 100) / 100 });

  const closePicker = () => setAdding(false);
  const chooseExample = (example: WorkshopScene) => {
    const presentation = studio.presentation;
    update({ ...example, studio: { ...example.studio!, presentation: presentation ? { ...example.studio!.presentation!, highlight: presentation.highlight, isolate: presentation.isolate } : example.studio!.presentation } });
    setSelectedFrame(0); setTimeMs(0); setPlaying(false); setSelection({ kind: "object", id: example.studio!.objects[0].id });
  };
  const changeStep = (next: number) => { setStep(next); setPlaying(false); setStatus(`Step ${next + 1}: ${["Choose equipment", "Start and finish", "Preview", "Name and save"][next]}`); };
  const resetExample = () => {
    const recipe = createQuickScene(activeMachine && isStudioMachine(activeMachine.slug) ? activeMachine.slug : "cable-row-machine");
    chooseExample(activeMachine?.machineMode === "reverse" ? setPecDeckMode(recipe, recipe.studio!.objects[0].id, "reverse") : recipe);
  };
  const demonstrationCaption = activeMachine ? workshopDemonstrationCaption(activeMachine, timeMs, scene.durationMs) : null;
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
        if (!pending) {
          // Numeric controls commit on blur. Save after React has applied that edit.
          target.blur();
          requestAnimationFrame(() => save());
        }
        break;
      case "duplicate": duplicate(); break;
      case "remove": removeObject(); break;
      case "play": setPlaying(value => !value); break;
      case "previous": if (selectedFrame > 0) selectFrame(selectedFrame - 1); break;
      case "next": if (selectedFrame < scene.keyframes.length - 1) selectFrame(selectedFrame + 1); break;
      case "edit": enableMouseMovement(); break;
      case "camera": camera(); break;
      case "help":
        if (shortcutHelp.current) { shortcutHelp.current.open = true; shortcutHelp.current.querySelector("summary")?.focus(); }
        break;
      case "escape":
        if (shortcutHelp.current?.open) { shortcutHelp.current.open = false; event.currentTarget.focus(); }
        else { camera(); setPlaying(false); }
        break;
    }
  };
  return <WorkshopLanguageProvider language={language}>{translateWorkshopTree(<div tabIndex={0} aria-label="Workshop editor" onKeyDown={onShortcut} className="min-w-0 rounded-2xl border border-border bg-card text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_.text-xs]:text-sm [&_summary]:min-h-11 [&_input[type=range]]:min-h-11" data-workshop="studio" dir={language === "he" ? "rtl" : "ltr"} lang={language}>
    <header className="space-y-3 border-b p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2" aria-label="Editor mode"><button type="button" aria-pressed={mode === "quick"} onClick={() => setMode("quick")} className={`${buttonClass} ${mode === "quick" ? "bg-primary text-primary-foreground" : ""}`}>{language === "he" ? "יצירה מהירה" : "Quick create"}</button><button type="button" aria-pressed={mode === "advanced"} onClick={() => setMode("advanced")} className={`${buttonClass} ${mode === "advanced" ? "bg-primary text-primary-foreground" : ""}`}>{language === "he" ? "עריכה מתקדמת" : "Advanced editing"}</button></div>
        <label className="flex items-center gap-2 text-sm">Language<select aria-label="Workshop language" value={language} onChange={event => setLanguage(event.target.value as "en" | "he")} className="min-h-11 rounded-lg border bg-background p-2"><option value="en">English</option><option value="he">עברית</option></select></label></div>
      {mode === "advanced" && <label className="block font-semibold">Exercise name<input value={name} maxLength={160} onChange={event => setName(event.target.value)} className={inputClass} placeholder="Name your private exercise" /></label>}
      <div className="flex flex-wrap items-center gap-3"><p role="status" aria-live="polite" className="text-sm text-muted-foreground">{draft.message}</p>{draft.error && <button type="button" onClick={() => save()} disabled={pending} className={buttonClass}>Retry saving</button>}{draft.dirty && !pending && <span className="text-sm">{draft.recoverable ? "Recovery copy on this device" : "Local recovery unavailable · save before leaving"}</span>}</div>
      {draft.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{draft.error} {/sign[ -]in/i.test(draft.error) && <a href={`/sign-in?next=${encodeURIComponent(savedId ? `/my-exercises/${savedId}/workshop` : "/my-exercises/new")}`} className="underline">Sign in again</a>}</p>}
      {draft.recovery && <section aria-label="Recover draft" className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-4"><h2 className="font-semibold">An unfinished draft is available on this device</h2><p className="text-sm">Restore the scene and name from {new Date(draft.recovery.updatedAt).toLocaleString()}. Your last server save stays available.</p><div className="flex flex-wrap gap-2"><button type="button" onClick={() => { const recovered = draft.recovery!; update(recovered.scene); setName(recovered.name); draft.acceptRecovery(); setSelectedFrame(0); setTimeMs(0); }} className={buttonClass}>Restore recovered draft</button><button type="button" onClick={draft.dismissRecovery} className={buttonClass}>Keep server version</button></div></section>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!past.length || dragging} onClick={undo} title="Undo · Ctrl / ⌘ + Z" aria-keyshortcuts="Control+Z Meta+Z" className={buttonClass}><Undo2 size={16} />Undo</button>
        <button type="button" disabled={!future.length || dragging} onClick={redo} title="Redo · Ctrl / ⌘ + Shift + Z · Ctrl + Y" aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y" className={buttonClass}><Redo2 size={16} />Redo</button>
        <details ref={shortcutHelp} className="basis-full rounded-lg border border-border">
          <summary className="cursor-pointer px-3 py-2 text-sm">Recovery and shortcuts</summary>
          <div className="space-y-4 border-t p-3 text-sm">
            <WorkshopShortcutGuide />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><p>Restore last saved replaces the scene and name. Undo restores the current scene.</p><button type="button" onClick={() => { update(draft.lastSaved.scene); setName(draft.lastSaved.name); setSelectedFrame(0); setTimeMs(0); }} className={buttonClass}>Restore last saved</button></div>
              <div className="space-y-2"><p>Reset to example replaces the whole scene in one Undo step. Your chosen muscle highlight is kept.</p><button type="button" onClick={resetExample} className={buttonClass}>Reset to example</button></div>
            </div>
          </div>
        </details>
      </div>
    </header>
    <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-4 py-3 text-sm" role="status" aria-live="polite">
      <span className="rounded-md border bg-background px-2 py-1 font-semibold tabular-nums">{`Editing pose ${selectedFrame + 1} · ${label(current.timeMs)}`}</span>
      <span>{object ? <span data-workshop-translate="false">{object.name}</span> : <span>{selectedJoint ? jointNames[selectedJoint] : "Anatomical figure"}</span>}</span>
      <span className="text-muted-foreground">{object?.machineUse ? "Machine contacts linked" : object?.attachment && object.attachment !== "none" ? `Held with ${object.attachment === "both" ? "both hands" : `${object.attachment} hand`}` : "No held contact selected"}</span>
    </div>
    {adding && <WorkshopEquipmentPicker options={equipmentOptions} ownerKey={ownerId} onClose={closePicker} onSelect={slug => addObject(slug as StudioObject["slug"])} />}
    <div hidden={mode !== "advanced"}>
    <div className="flex flex-wrap items-center gap-2 border-b border-border p-3" role="toolbar" aria-label="Workshop tools">
      <div className="relative">
        <button ref={addButton} type="button" onClick={() => setAdding(!adding)} aria-expanded={adding} className={`${buttonClass} bg-primary text-primary-foreground`}><Plus size={16} />Add equipment<ChevronDown size={14} /></button>
      </div>
      <button type="button" disabled={dragging} onClick={() => { setPosing(!posing); selectObject({ kind: "body" }); }} aria-pressed={posing} className={`${buttonClass} ${posing ? "bg-primary/10 text-primary" : ""}`}><UserRound size={16} />Pose body</button>
      {(activeMachine || studio.seating) && <button type="button" onClick={leaveEquipment} disabled={dragging} className={`${buttonClass} border-primary/40 bg-primary/10 text-primary`}><UserRound size={16} />{activeMachine ? "Leave machine" : "Stand up"}</button>}
      <label className="flex items-center gap-2 px-1 text-xs font-semibold" title="Restricts both shoulders to side-to-side movement across every pose. One Undo restores all previous poses."><input aria-label="Frontal-plane lock" type="checkbox" checked={!!studio.frontalPlane} disabled={dragging} onChange={event => { update(setFrontalPlane(scene, event.target.checked)); setPlaying(false); setTimeMs(current.timeMs); }} />Side-to-side shoulder movement only</label>
      <button aria-label="Undo" type="button" onClick={undo} disabled={!past.length || dragging} className={buttonClass}><Undo2 size={16} /></button>
      <button aria-label="Redo" type="button" onClick={redo} disabled={!future.length || dragging} className={buttonClass}><Redo2 size={16} /></button>
      <label className="flex items-center gap-2 px-1 text-xs font-semibold">Sensitivity
        <input aria-label="Movement sensitivity" type="range" min={10} max={100} step={5} value={Math.round(sensitivity * 100)} onChange={event => changeSensitivity(Number(event.target.value) / 100)} disabled={dragging} className="w-20 accent-primary" />
        <output className="w-8 tabular-nums">{Math.round(sensitivity * 100)}%</output>
      </label>
      {savedId && <button type="button" onClick={() => save()} disabled={dragging || !!captureElbow} className={`${buttonClass} ml-auto`}><Save size={15} />Save scene</button>}
      <button type="button" onClick={() => save(true)} disabled={dragging || !!captureElbow} className={`${buttonClass} ${savedId ? "" : "ml-auto"} bg-primary text-primary-foreground`}>{pending ? "Saving…" : "Save & add details"} →</button>
    </div>
    </div>
    <div className={`grid min-w-0 grid-cols-1 ${mode === "quick" ? "xl:grid-cols-[minmax(0,1fr)_minmax(360px,520px)]" : "lg:grid-cols-[minmax(0,1fr)_380px]"}`}>
      <div className="min-w-0 self-start bg-card p-3 sm:p-4" data-workshop-preview>
        <button type="button" aria-expanded={previewOpen} onClick={() => setPreviewOpen(!previewOpen)} className={`${buttonClass} mb-3`}>{previewOpen ? "Collapse preview" : "Show preview"}</button>
        {overlappingObjects.length > 0 && <div role="status" className="mb-3 space-y-2 rounded-lg border border-amber-500 p-3 text-sm"><p>Equipment and figure bounds overlap. Inspect from both sides; empty space inside a machine can also trigger this advisory.</p>{overlappingObjects.map(item => <button key={item.id} type="button" onClick={() => { selectObject({ kind: "object", id: item.id }); setMode("advanced"); setPlaying(false); }} className={buttonClass}>Inspect placement · <span data-workshop-translate="false">{item.name}</span></button>)}<p>Repair: move this item away using Up or Position coordinates, then inspect again. Held items and linked supports are excluded.</p></div>}
        <div hidden={!previewOpen} className="relative">
          <div className="mb-3 flex flex-wrap items-center gap-2" aria-label="Mouse movement">
            <button type="button" aria-pressed={interactionMode === "edit" && tool === "select" && !limbPosing} disabled={dragging} onClick={() => enableMouseMovement()} className={`${buttonClass} ${interactionMode === "edit" && tool === "select" && !limbPosing ? "bg-primary text-primary-foreground" : ""}`}><Hand size={18} />Move with mouse</button>
            <button type="button" aria-pressed={limbPosing && interactionMode === "edit"} disabled={dragging} onClick={enableLimbPosing} className={`${buttonClass} ${limbPosing && interactionMode === "edit" ? "bg-primary text-primary-foreground" : ""}`}><UserRound size={18} />Pose hands and feet</button>
            {interactionMode === "edit" && <fieldset className="flex flex-wrap gap-2"><legend className="sr-only">Object drag direction</legend>{(["view", "floor"] as const).map(plane => <button type="button" key={plane} disabled={dragging} aria-pressed={dragPlane === plane} onClick={() => setDragPlane(plane)} className={`${buttonClass} ${dragPlane === plane ? "border-primary bg-primary/10 text-primary" : ""}`}>{plane === "view" ? "Across view · includes height" : "Along floor"}</button>)}</fieldset>}
          </div>
          {interactionMode === "edit" && !limbPosing && <p className="mb-3 text-sm text-muted-foreground">Drag equipment directly. Use the round grab buttons to move machine handles. For the cable row, use Side view to drag up, down, toward or away from the body.</p>}
          {limbPosing && interactionMode === "edit" && <div className="mb-3 space-y-2 text-sm">
            <p>Drag a hand or foot using its round button. Elbows and knees follow. Arrow keys move the selected handle; Shift takes a larger step. Escape cancels. Use Front and Side views to move in different directions.</p>
            <p>{poseScope === "all" ? "The moved limb changes in all poses." : "Only the displayed pose changes. Undo restores the whole drag."}</p>
            {Math.round(timeMs) !== current.timeMs && <p role="status">Choose Edit this moment to pose the displayed time.</p>}
            {limbBlockReasons.map(reason => <p key={reason}>{reason}</p>)}
            {limbWarning && <p role="status" className="rounded-lg border border-amber-500 bg-amber-500/10 p-3">{limbWarning}</p>}
          </div>}
          <MotionCanvas scene={scene} timeMs={timeMs} editor={editor} simplifiedControls interactionMode={interactionMode} onInteractionModeChange={value => value === "edit" ? enableMouseMovement() : setInteractionMode("camera")} onMachineReachChange={onMachineReach} className="h-[clamp(240px,40dvh,420px)] xl:h-[480px]" />
          <div className="pointer-events-none mt-2 flex justify-between gap-3 text-xs">
            <span className="rounded-lg bg-card/95 px-3 py-2 font-semibold">{playing ? "Previewing movement" : limbPosing ? "Drag a hand or foot using its round button" : controllingWeight?.machineUse ? `${controllingWeight.name} controls contact` : controllingWeight ? `${controllingWeight.name} controls this arm` : selectedJoint ? `${jointNames[selectedJoint]} · ${isWrist ? "use the palm controls" : "drag a ring to pose"}` : bodyLocked ? "Select the machine to move the figure" : tool === "rotate" ? "Drag a colored ring to rotate" : tool === "translate" ? "Drag an arrow to move" : "Drag the figure or equipment to move it"}</span>
          </div>
        </div>
        <section aria-label="Playback controls" className="mt-4 space-y-3 rounded-xl border bg-background p-3"><div className="flex flex-wrap items-center gap-2"><button type="button" disabled={dragging} onClick={() => setPlaying(!playing)} className={buttonClass}>{playing ? <Pause size={16} /> : <Play size={16} />}{playing ? "Pause" : "Play"}</button><label className="flex flex-wrap items-center gap-2">Preview speed<select aria-label="Preview speed" value={speed} onChange={event => setSpeed(Number(event.target.value))} className="min-h-11 rounded-lg border bg-card p-2">{[.25, .5, 1].map(value => <option key={value} value={value}>{new Intl.NumberFormat(language).format(value)}×</option>)}</select></label><button type="button" onClick={() => previewTime(0)} className={buttonClass}>View start</button><button type="button" onClick={() => previewTime(scene.durationMs / 2)} className={buttonClass}>View finish</button></div><label className="block text-sm"><span>{`Preview time ${label(timeMs)} · Editing pose ${label(current.timeMs)}`}</span><input aria-label="Preview time" type="range" min={0} max={scene.durationMs} step={1} value={Math.round(timeMs)} disabled={dragging} onChange={event => { setPlaying(false); setTimeMs(Number(event.target.value)); }} className="mt-2 w-full accent-primary" /></label><div className="flex flex-wrap gap-2"><button type="button" onClick={() => { const at = Math.round(timeMs); const index = scene.keyframes.findIndex(frame => frame.timeMs === at); if (index >= 0) selectFrame(index); else addFrame(); setMode("advanced"); setTimelineOpen(true); setInteractionMode("edit"); }} disabled={dragging || scene.keyframes.length >= 24} className={buttonClass}>Edit this moment</button><button type="button" disabled={selectedFrame === 0 || dragging} onClick={() => selectFrame(selectedFrame - 1)} className={buttonClass}>Previous pose</button><button type="button" disabled={selectedFrame === scene.keyframes.length - 1 || dragging} onClick={() => selectFrame(selectedFrame + 1)} className={buttonClass}>Next pose</button></div>{demonstrationCaption && <p className="rounded-lg bg-muted p-3 text-sm"><strong>Demonstration caption: </strong>{demonstrationCaption} <span>Use Play to watch the short repetition. Playback starts only when you choose it.</span></p>}<p className="text-sm text-muted-foreground">{`Speed changes this preview only. Saved duration remains ${label(scene.durationMs)}.`}</p></section>
        <details hidden={mode !== "advanced"} open={timelineOpen} onToggle={event => setTimelineOpen(event.currentTarget.open)} className="mt-3 rounded-xl border border-border bg-background p-3">
          <summary className="cursor-pointer text-sm font-semibold">Advanced timeline <span className="ml-2 text-xs font-normal text-muted-foreground">Optional</span></summary>
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">Choose the pose to edit. Machine travel affects its moving parts; placement stays fixed.</p>
            <input aria-label="Scrub timeline" type="range" min={0} max={scene.durationMs} step={1} value={Math.round(timeMs)} disabled={dragging} onChange={event => { setPlaying(false); setTimeMs(Number(event.target.value)); }} className="mt-4 w-full accent-primary" />
            <div className="mt-2 flex flex-wrap gap-2">{scene.keyframes.map((frame, index) => <button key={`${frame.timeMs}-${index}`} type="button" disabled={dragging} aria-pressed={selectedFrame === index} onClick={() => selectFrame(index)} className={`${buttonClass} ${selectedFrame === index ? "bg-primary/10 text-primary" : "bg-card"}`}>{index === 0 ? "Start" : index === scene.keyframes.length - 1 ? "End" : `Keyframe ${index + 1}`} · {label(frame.timeMs)}</button>)}</div>
            <section aria-label="Selected keyframe" className="mt-3 space-y-3 rounded-lg border border-border p-3">
              <p className="text-xs font-semibold">Selected: {selectedFrame === 0 ? "Start" : selectedFrame === scene.keyframes.length - 1 ? "End" : `Keyframe ${selectedFrame + 1}`} · {label(current.timeMs)}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={editFrame} disabled={dragging} className={buttonClass}>Edit keyframe</button>
                <button type="button" onClick={removeFrame} disabled={scene.keyframes.length <= 2 || dragging} className={buttonClass}><Trash2 size={14} />Delete keyframe</button>
                <button type="button" onClick={addFrame} disabled={scene.keyframes.length >= 24 || dragging} className={buttonClass}><Plus size={14} />Add keyframe</button>
              </div>
              <fieldset><legend className="mb-2 font-semibold">Pose editing scope</legend><div className="flex flex-wrap gap-2"><button type="button" aria-pressed={poseScope === "selected"} onClick={() => setPoseScope("selected")} className={buttonClass}>Edit this pose</button><button type="button" aria-pressed={poseScope === "all"} onClick={() => setPoseScope("all")} className={buttonClass}>Apply to all poses</button></div><p className="mt-2 text-sm">{poseScope === "all" ? "Joint adjustments replace that joint across every pose in one Undo step." : `Joint adjustments affect pose ${selectedFrame + 1} only.`}</p></fieldset>
              <div className="flex flex-wrap gap-2"><label className="text-sm">Copy pose to<select aria-label="Copy pose destination" value={copyTarget} onChange={event => setCopyTarget(Number(event.target.value))} className={inputClass}>{scene.keyframes.map((frame, index) => <option key={index} value={index}>Pose {index + 1} · {label(frame.timeMs)}</option>)}</select></label><button type="button" onClick={() => update(copyWorkshopPose(scene, selectedFrame, copyTarget))} className={buttonClass}>Copy to chosen pose</button><button type="button" onClick={() => update(copyWorkshopPose(scene, selectedFrame, "all"))} className={buttonClass}>Copy to all poses</button><button type="button" onClick={() => update(mirrorWorkshopPose(scene, selectedFrame))} className={buttonClass}>Mirror sides</button><button type="button" onClick={() => update(matchWorkshopLoop(scene))} className={buttonClass}>Match loop end to start</button></div>
              {selectedFrame > 0 && selectedFrame < scene.keyframes.length - 1 ? <form key={`${selectedFrame}-${current.timeMs}`} onSubmit={event => { event.preventDefault(); changeFrameTime(String(new FormData(event.currentTarget).get("frameTime") ?? "")); }} className="flex flex-wrap items-end gap-2">
                <label className="text-xs font-semibold">Frame time · seconds<input name="frameTime" aria-label="Keyframe time seconds" type="number" step="0.001" required defaultValue={current.timeMs / 1000} disabled={dragging} className={`${inputClass} max-w-36`} /></label>
                <button type="submit" disabled={dragging} className={buttonClass}>Update time</button>
              </form> : <p className="text-xs text-muted-foreground">Start stays at 0; End stays at Duration. Deleting either uses the next surviving pose. Keep at least two frames.</p>}
              <p className="text-xs text-muted-foreground">Edit the selected pose or equipment controls. Use Undo to restore changes.</p>
              {frameError && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{frameError}</p>}
            </section>
            <details className="mt-3 text-xs"><summary className="cursor-pointer text-muted-foreground">Timeline settings</summary><div className="mt-3 flex flex-wrap items-center gap-3">
              <label>Duration<select value={scene.durationMs} onChange={event => changeDuration(Number(event.target.value))} className="ml-2 rounded border bg-card p-2">{Array.from(new Set([1600, 2400, 3200, 4800, 6400, 8000, scene.durationMs])).sort((a, b) => a - b).map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
            </div></details>
          </div>
        </details>
      </div>
      {mode === "quick" && <WorkshopQuickCreate scene={scene} step={step} onStep={changeStep} onChange={update} onExample={chooseExample} onAdd={() => setAdding(true)} onPreviewTime={previewTime} onMouseEdit={enableMouseMovement} name={name} onName={setName} onSave={() => save()} saving={pending} savedId={savedId} currentConfirmed={draft.currentConfirmed} confirmedName={draft.lastSaved.name} onDetails={() => save(true)} language={language} onAdvanced={() => { setMode("advanced"); setPosing(true); setInteractionMode("edit"); }} reachWarning={Object.values(gripReach).some(value => !value)} machineReach={machineReach} />}
      <aside hidden={mode !== "advanced"} aria-label="Workshop controls" className="min-w-0 space-y-5 border-t border-border p-4 lg:border-l lg:border-t-0" inert={dragging}>
        <section><h2 className="text-sm font-semibold">In your scene</h2><div className="mt-2 max-h-40 space-y-1 overflow-y-auto" aria-label="Scene objects">
          <button type="button" onClick={() => selectObject({ kind: "body" })} aria-pressed={selection?.kind === "body"} className={`${buttonClass} w-full justify-start border-transparent ${selection?.kind === "body" ? "bg-primary/10 text-primary" : ""}`}><UserRound size={15} />Anatomical figure</button>
          {studio.objects.map(item => <button key={item.id} type="button" onClick={() => { selectObject({ kind: "object", id: item.id }); setPosing(false); }} aria-pressed={object?.id === item.id} className={`${buttonClass} w-full justify-start border-transparent ${object?.id === item.id ? "bg-primary/10 text-primary" : ""}`}><Box size={14} /><span className="truncate" data-workshop-translate="false">{item.name}</span></button>)}
        </div></section>
        {posing && <WorkshopJointPicker selected={selectedJoint} onSelect={slug => selectObject({ kind: "joint", slug })} />}
        <section aria-label="Selected item" data-grip-reachable={object && gripReach[object.id] === false ? "false" : "true"}>
          <h2 className="text-base font-semibold">{selectedJoint ? jointNames[selectedJoint] : object ? <span data-workshop-translate="false">{object.name}</span> : "Anatomical figure"}</h2>
          {object && isStudioMachine(object.slug) && <div className="mt-4 space-y-3 rounded-xl bg-primary/5 p-3">
            {object.slug === "pec-deck" && <label className="block text-xs font-semibold">Pec deck mode<select aria-label="Pec deck mode" value={object.machineMode ?? "regular"} onChange={event => {
              const machineMode = event.target.value as "regular" | "reverse";
              update(setPecDeckMode(scene, object.id, machineMode)); setPlaying(false);
            }} className={inputClass}>
              <option value="regular">Regular · chest fly</option><option value="reverse">Reverse · rear delt fly</option>
            </select></label>}
            {object.slug === "lat-pulldown-machine" && <label className="block text-xs font-semibold">Pulldown grip<select aria-label="Pulldown grip" value={object.machineGrip ?? "supinated"} onChange={event => updateObject(object.id, { machineGrip: event.target.value as "supinated" | "pronated" })} className={inputClass}>
              <option value="supinated">Supinated · palms toward you</option><option value="pronated">Pronated · frontal pulldown</option>
            </select></label>}
            <button type="button" aria-pressed={!!object.machineUse} onClick={() => {
              update({ ...scene, motionStyle: "free", equipment: null, studio: { ...studio, seating: undefined, objects: studio.objects.map(item => ({ ...item,
                machineUse: item.id === object.id ? !object.machineUse : item.machineUse === undefined ? undefined : false,
                attachment: "none", elbowLocks: undefined })) } });
              setPlaying(false);
            }} className={`${buttonClass} ${object.machineUse ? "bg-primary text-primary-foreground" : "bg-card"}`}>{object.machineUse ? "Stop using machine" : "Use this machine"}</button>
            <p className="text-xs text-muted-foreground">{object.machineMode === "reverse" ? "Face the pad with your chest supported and feet planted. Open both arms outward, then return with control." : machineContactDescriptions[object.slug]}</p>
            <fieldset className="block text-base font-semibold"><legend>{object.machineMode === "reverse" ? "Arm opening" : machineTravelLabels[object.slug]}</legend>
              <input aria-label={object.machineMode === "reverse" ? "Arm opening" : machineTravelLabels[object.slug]} type="range" min={0} max={1} step={0.01} value={object.machinePosition ?? 0.5} onChange={event => {
                updateObject(object.id, setMachinePosition(rawObject!, Number(event.target.value), current.timeMs)); setPlaying(false); setTimeMs(current.timeMs);
              }} className="mt-2 w-full accent-primary" />
              <WorkshopNumberField label={`${object.machineMode === "reverse" ? "Arm opening" : machineTravelLabels[object.slug]} percent`} min={0} max={100} step={1} value={Math.round((object.machinePosition ?? 0.5) * 100)} onChange={value => {
                updateObject(object.id, setMachinePosition(rawObject!, value / 100, current.timeMs)); setPlaying(false); setTimeMs(current.timeMs);
              }} />
            </fieldset>
            {object.slug === "cable-row-machine" && <div className="space-y-2"><WorkshopNumberField label="Handle height meters" min={rowHandleHeight.min * object.scale} max={rowHandleHeight.max * object.scale} step={.05 * object.scale} value={Math.round((object.machineHandleHeight ?? rowHandleHeight.standard) * object.scale * 100) / 100} onChange={height => {
              updateObject(object.id, setMachineHandleHeight(rawObject!, height / object.scale, current.timeMs)); setPlaying(false); setTimeMs(current.timeMs);
            }} /><p className="text-sm text-muted-foreground">Changes handle height at the editing moment. The seat, footplates and pulley stay in place.</p></div>}
            <WorkshopGripControls object={object} onChange={choices => updateObject(object.id, choices)} onPreviewPose={pose => previewTime(pose === "start" ? 0 : scene.durationMs / 2)} reach={machineReach} />
            <p className="text-xs text-muted-foreground">Animate selected item creates editable moments for moving parts. The frame stays in place.</p>
          </div>}
          {selectedJoint ? <div className="mt-3 space-y-3">
            {controllingWeight && <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
              <p>{controllingWeight.machineUse ? `${controllingWeight.name} keeps the hands and feet in contact. Select the machine to change travel.` : `${controllingWeight.name} controls this arm. Move the weight to pose the arm; wrist controls remain available.`}</p>
              <button type="button" onClick={() => { updateObject(controllingWeight.id, controllingWeight.machineUse ? { machineUse: false } : { attachment: "none", elbowLocks: undefined }); setCaptureElbow(null); }} className={`${buttonClass} mt-2`}>{controllingWeight.machineUse ? "Stop using machine to pose freely" : "Release weight to pose arm"}</button>
              <button type="button" onClick={() => selectObject({ kind: "object", id: controllingWeight.id })} className={`${buttonClass} mt-2`}>{controllingWeight.machineUse ? "Select machine" : "Select held weight"}</button>
            </div>}
            <p className="text-xs text-muted-foreground">{controllingWeight?.machineUse ? "The machine controls contact. Select the machine to edit its travel, or stop using it to pose freely." : controllingWeight ? "These joint controls are paused while the weight is held." : isWrist ? "Turn the palm, bend the wrist, or tilt it sideways." : isKnee ? "0° is straight. Positive bends the knee backward; extension is limited to 5°." : isAnkle ? "Raise or point the toes, turn the foot, or tilt it sideways." : "Drag a rotation ring, or use these sliders."}{timelineOpen ? ` Editing ${label(current.timeMs)}.` : ""}</p>
            {isWrist && <div className="flex flex-wrap gap-1">{[{ label: "Palm up", turn: -90 }, { label: "Neutral", turn: 0 }, { label: "Palm down", turn: 90 }].map(preset => <button type="button" key={preset.label} disabled={!!controllingWeight} title={preset.turn === -90 ? "Supinated" : preset.turn === 90 ? "Pronated" : "Neutral grip"} aria-pressed={jointAngles.x === preset.turn} onClick={() => setPose(selectedJoint, { ...jointAngles, x: preset.turn })} className={`${buttonClass} ${jointAngles.x === preset.turn ? "bg-primary/10 text-primary" : ""}`}>{preset.label}</button>)}</div>}
            {frontalShoulder && <p className="text-xs text-muted-foreground">Frontal-plane lock applies to both shoulders across all keyframes. Edit side-to-side motion below.</p>}
            {(["x", "y", "z"] as const).filter(axis => (!isKnee || axis === "x") && (!frontalShoulder || axis === "z")).map(axis => {
              const range = jointControlRange(selectedJoint, axis);
              const value = jointControlValue(selectedJoint, axis, jointAngles[axis]);
              const changeAngle = (value: number) => setPose(selectedJoint, { ...jointAngles, [axis]: jointControlValue(selectedJoint, axis, clamp(value, ...range)) });
              const action = isWrist ? axis === "x" ? "Palm turn" : axis === "y" ? "Wrist bend" : "Wrist tilt" : isAnkle ? axis === "x" ? "Toes up / down" : axis === "y" ? "Foot turn" : "Foot tilt" : axis === "x" ? "Bend" : axis === "y" ? "Turn" : "Side to side";
              return <fieldset key={axis} className="space-y-2"><legend className="text-base font-semibold">{action}</legend><input aria-label={`${action} ${jointNames[selectedJoint]} degrees`} disabled={!!controllingWeight} type="range" min={range[0]} max={range[1]} value={value} onChange={event => changeAngle(Number(event.target.value))} className="w-full accent-primary disabled:opacity-40" /><WorkshopNumberField label={`${action} ${jointNames[selectedJoint]} degrees`} disabled={!!controllingWeight} min={range[0]} max={range[1]} value={value} onChange={changeAngle} /></fieldset>;
            })}
            <button type="button" disabled={!!controllingWeight} onClick={() => setPose(selectedJoint, { x: 0, y: 0, z: 0 })} className={buttonClass}>Reset joint</button>
          </div> : bodyLocked && activeMachine ? <div className="mt-3 space-y-3 text-xs">
            <p>The figure follows {activeMachine.name}. Select the machine to move it or change travel.</p>
            <button type="button" onClick={() => selectObject({ kind: "object", id: activeMachine.id })} className={buttonClass}>Select machine</button>
            <button type="button" onClick={() => updateObject(activeMachine.id, { machineUse: false })} className={buttonClass}>Stop using machine to pose freely</button>
          </div> : <>
            <p className="mb-3 mt-1 text-xs text-muted-foreground">{placementLocked ? "Placement is locked while editing travel. Use Stop animation and edit placement to reposition the machine." : `Place ${object ? "this item" : "the figure"} using the buttons or coordinates.`}</p>
            <div className="flex gap-2"><button type="button" aria-pressed={tool === "select"} onClick={() => chooseTool("select")} className={`${buttonClass} ${tool === "select" ? "bg-primary/10 text-primary" : ""}`}><Hand size={14} />Move</button><button type="button" aria-pressed={tool === "rotate"} onClick={() => chooseTool("rotate")} className={`${buttonClass} ${tool === "rotate" ? "bg-primary/10 text-primary" : ""}`}><Rotate3D size={14} />Rotate</button></div>
            <div className="mt-2 flex gap-2"><button type="button" disabled={placementLocked} onClick={() => nudgeHeight(0.1)} className={buttonClass}><ArrowUp size={14} />Up</button><button type="button" disabled={placementLocked} onClick={() => nudgeHeight(-0.1)} className={buttonClass}><ArrowDown size={14} />Down</button></div>
            <div className="mt-4"><TransformFields value={selectedTransform} onChange={changeTransform} positionOnly disabled={placementLocked} /></div>
          </>}
          {object && <div className="mt-4 space-y-2 rounded-lg border p-3 text-sm">
            <button type="button" aria-pressed={!!rawObject?.frames?.length} className={buttonClass} onClick={() => {
              const enabled = !rawObject?.frames?.length;
              const animated = setStudioObjectAnimated(rawObject!, enabled, current.timeMs, scene.keyframes.map(frame => frame.timeMs));
              updateObject(object.id, animated); setPlaying(false); setTimeMs(current.timeMs);
              setTimelineOpen(enabled);
            }}>{rawObject?.frames?.length ? "Stop animation and edit placement" : "Animate selected item"}</button>
            <p>{rawObject?.frames?.length ? `Editing ${label(current.timeMs)}. Changes affect this moment only.` : "Static placement. Changes apply to the whole scene."}</p>
          </div>}
          {object?.slug === "bench" && <div className="mt-4 space-y-3"><fieldset className="block text-base font-semibold"><legend>Bench pad angle · degrees</legend>
            <input aria-label="Bench pad angle" type="range" min={0} max={85} value={object.benchAngle ?? 45} onChange={event => updateObject(object.id, { benchAngle: Number(event.target.value) })} className="mt-2 w-full accent-primary" />
            <WorkshopNumberField label="Bench pad angle degrees" min={0} max={85} value={object.benchAngle ?? 45} onChange={benchAngle => updateObject(object.id, { benchAngle })} />
            <span className="mt-1 block font-normal text-muted-foreground">0° is flat. Adjusts the pad and support frame for the whole scene.</span>
          </fieldset>
            <p className="text-xs font-semibold">Sit on this bench</p>
            <div className="flex flex-wrap gap-2">{(Object.keys(benchFacingNames) as BenchFacing[]).map(facing => <button key={facing} type="button" aria-pressed={studio.seating?.benchId === object.id && studio.seating.facing === facing} onClick={() => update({ ...scene, motionStyle: "free", studio: { ...studio, objects: studio.objects.map(item => item.machineUse ? { ...item, machineUse: false } : item), seating: { benchId: object.id, facing } } })} className={`${buttonClass} ${studio.seating?.benchId === object.id && studio.seating.facing === facing ? "bg-primary text-primary-foreground" : "bg-card"}`}>{benchFacingNames[facing]}</button>)}</div>
            {studio.seating && <><p className="text-xs text-muted-foreground">The figure follows the bench. Stand up to move the figure freely.</p><button type="button" onClick={() => update({ ...scene, studio: { ...studio, seating: undefined } })} className={buttonClass}>Stand up</button></>}
          </div>}
          {canHold && <div className="mt-4 rounded-xl bg-primary/5 p-3">
            <p className="mb-2 text-sm">Holding or attaching replaces contacts in the chosen hand and clears their elbow locks. An engaged machine is released. One Undo restores the scene.</p><h3 className="text-sm font-semibold">{isCuff ? "Attach cuff" : object.slug === "cable-machine" ? "Hold cable handle" : "Hold this weight"}</h3>
            <div className="mt-2 flex flex-wrap gap-2">{(["left", "right", ...(canHoldBoth ? ["both"] : [])] as ("left" | "right" | "both")[]).map(hand => <button key={hand} type="button" aria-pressed={object.attachment === hand} onClick={() => holdObject(hand)} className={`${buttonClass} ${object.attachment === hand ? "bg-primary text-primary-foreground" : "bg-card"}`}>{isCuff ? `Cuff ${hand} arm` : `Hold with ${hand === "both" ? "both hands" : `${hand} hand`}`}</button>)}</div>
            {held && <><p className="mt-3 flex items-center gap-1 text-xs font-semibold"><Check size={13} />{isCuff ? `Cuffed ${object.attachment} ${object.cuffPosition === "upper-arm" ? "above elbow" : "wrist"}` : object.attachment === "both" ? "Held with both hands" : `Held with ${object.attachment} hand`}</p>
              <p className="mt-1 text-xs text-muted-foreground">{isCuff ? "The cuff follows the arm. Pose the shoulder and elbow freely." : object.slug === "cable-machine" ? "The cable follows the hand as you pose the body." : "Move the weight to move the arms with it."}</p>
              {gripReach[object.id] === false && <p role="alert" className="mt-2 text-xs text-amber-700">{object.slug === "cable-machine" ? "Attachment outside reach. Bring the hands closer together or adjust the arm poses." : Object.keys(object.elbowLocks ?? {}).length ? "Outside the locked elbow’s reach. Move the weight along the curl arc, or unlock the elbow." : "Too far to reach. Move the weight closer to the figure."}</p>}
              <button type="button" onClick={() => holdObject("none")} className={`${buttonClass} mt-2 bg-card`}>Release</button>
              <div className="mt-2 flex flex-wrap gap-1">{(["left", "right"] as const).filter(side => object.attachment === side || object.attachment === "both").flatMap(side => (isCuff && object.cuffPosition === "upper-arm" ? ["shoulder", "elbow"] as const : ["wrist"] as const).map(joint => <button key={`${side}-${joint}`} type="button" onClick={() => selectObject({ kind: "joint", slug: `${side}-${joint}` })} className={`${buttonClass} bg-card`}>{side === "left" ? "Left" : "Right"} {joint}</button>))}</div>
              {object.slug !== "cable-machine" && <div className="mt-3 space-y-2 border-t pt-3">
                <p className="text-xs text-muted-foreground">Lock an elbow at its current position relative to the figure. Position the arm on the pad first, then keep the weight within reach.</p>
                {(["left", "right"] as const).filter(side => object.attachment === side || object.attachment === "both").map(side => <button key={side} type="button" disabled={!!captureElbow || playing || dragging} aria-pressed={!!object.elbowLocks?.[side]} onClick={() => {
                  if (object.elbowLocks?.[side]) { const locks = { ...object.elbowLocks }; delete locks[side]; updateObject(object.id, { elbowLocks: locks }); }
                  else { setPlaying(false); setTimeMs(current.timeMs); setCaptureElbow({ objectId: object.id, side }); }
                }} className={`${buttonClass} bg-card`}>{object.elbowLocks?.[side] ? "Unlock" : "Lock"} {side} elbow</button>)}
              </div>}
            </>}
          </div>}
          {object?.slug === "cable-machine" && <div className="mt-4 space-y-3">
            <fieldset className="space-y-2"><legend className="text-xs font-semibold">Align pulley beside shoulder</legend>
              <div className="flex flex-wrap gap-2">{(["left", "right"] as const).map(side => <button key={side} type="button" aria-pressed={object.shoulderAlignment === side} onClick={() => updateObject(object.id, { shoulderAlignment: side })} className={`${buttonClass} ${object.shoulderAlignment === side ? "bg-primary/10 text-primary" : ""}`}>Beside {side} shoulder</button>)}</div>
              {object.shoulderAlignment && <><p className="text-xs text-muted-foreground">Follows the shoulder when the figure or bench moves. Pulley height stays adjustable.</p><button type="button" onClick={() => transformObject(object.id, object)} className={buttonClass}>Use manual placement</button></>}
            </fieldset>
            <p className="text-sm">Changing the attachment or cuff position replaces competing hand contacts and clears their locks. One Undo restores the scene.</p><label className="block text-xs font-semibold">Cable attachment<select aria-label="Cable attachment" value={object.cableAttachment ?? "d-handle"} onChange={event => {
              const cableAttachment = event.target.value as CableAttachment;
              const changes = setCableAttachment(rawObject!, cableAttachment);
              const slots = studioAttachmentSlots(changes);
              update({ ...scene, studio: { ...studio, objects: studio.objects.map(item => item.id === object.id ? changes : studioAttachmentSlots(item).some(slot => slots.includes(slot)) ? { ...item, attachment: "none", elbowLocks: undefined } : item) } });
            }} className={inputClass}>{cableAttachmentSlugs.map(kind => <option key={kind} value={kind}>{cableAttachmentNames[kind]}</option>)}</select></label>
            {isCuff && <label className="block text-xs font-semibold">Cuff placement<select aria-label="Cuff placement" value={object.cuffPosition ?? "wrist"} onChange={event => {
              const changes = { ...rawObject!, cuffPosition: event.target.value as "wrist" | "upper-arm" };
              const slots = studioAttachmentSlots(changes);
              update({ ...scene, studio: { ...studio, objects: studio.objects.map(item => item.id === object.id ? changes : studioAttachmentSlots(item).some(slot => slots.includes(slot)) ? { ...item, attachment: "none", elbowLocks: undefined } : item) } });
            }} className={inputClass}><option value="wrist">At wrist</option><option value="upper-arm">Above elbow</option></select></label>}
            <fieldset className="block text-base font-semibold"><legend>Pulley height · meters</legend><input aria-label="Pulley height meters" type="range" min={0.2} max={maxPulleyHeight} step={0.05} value={object.pulleyHeight} onChange={event => updateObject(object.id, { pulleyHeight: Number(event.target.value) })} className="mt-2 w-full accent-primary" />
              <WorkshopNumberField label="Pulley height meters" min={0.2} max={maxPulleyHeight} step={0.05} value={object.pulleyHeight} onChange={pulleyHeight => updateObject(object.id, { pulleyHeight })} /></fieldset>
            <div className="flex flex-wrap gap-2">{[["Near feet", .3], ["Near waist", 1.3], ["Near shoulders", 2.2], ["Above head", 2.8]].map(([label, height]) => <button key={label} type="button" onClick={() => updateObject(object.id, { pulleyHeight: clamp((studio.body.y + Number(height) * studio.body.scale - object.y) / object.scale, .2, maxPulleyHeight) })} className={buttonClass}>{label}</button>)}</div>
          </div>}
          {object && <button type="button" onClick={removeObject} className={`${buttonClass} mt-4`}><Trash2 size={14} />Remove item</button>}
        </section>
        {scene.equipment && <section className="rounded-xl border p-3 text-xs"><p className="font-semibold">{equipmentOptions.find(item => item.slug === scene.equipment?.slug)?.label ?? scene.equipment.slug} · demo equipment</p><button type="button" onClick={() => update({ ...scene, equipment: null })} className={`${buttonClass} mt-2`}>Remove demo equipment</button></section>}
        <details className="border-t border-border pt-3"><summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Advanced settings</summary><div className="mt-4 space-y-4">
          {!selectedJoint && !bodyLocked && <>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={snap} onChange={event => setSnap(event.target.checked)} />Snap to grid</label>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={() => chooseTool("translate")} className={buttonClass}><Move3D size={14} />3D arrows</button><button type="button" onClick={() => chooseTool("scale")} className={buttonClass}>Resize</button></div>
            {object && <label className="block text-xs font-semibold">Item name<input aria-label="Item name" value={object.name} maxLength={60} onChange={event => updateObject(object.id, { name: event.target.value })} className={inputClass} /></label>}
            <TransformFields value={selectedTransform} onChange={changeTransform} disabled={placementLocked} />
            {object && <button type="button" onClick={duplicate} disabled={studio.objects.length >= 20} className={buttonClass}>Duplicate</button>}
          </>}
          <label className="block text-xs font-semibold">Movement setup<select value={scene.motionStyle ?? "free"} onChange={event => update({ ...scene, studio: { ...studio, seating: undefined }, motionStyle: event.target.value as WorkshopScene["motionStyle"] })} className={inputClass}>
            <option value="free">Free posing</option><option value="squat">Squat — feet planted</option><option value="hinge">Hip hinge — feet planted</option><option value="row">Bent-over row</option><option value="split-squat">Stationary lunge</option><option value="bench-press">Incline bench press</option><option value="seated-curl">Seated biceps curl</option><option value="incline-curl">Incline dumbbell curl</option>
          </select></label>
          {!!equipmentOptions.length && <label className="block text-xs font-semibold">Legacy demo equipment<select value={scene.equipment?.slug ?? ""} onChange={event => {
            const next = { ...scene, equipment: event.target.value ? { slug: event.target.value as NonNullable<WorkshopScene["equipment"]>["slug"], x: 0, y: 0, z: 0, scale: 1 } : null };
            update(makeLegacyBarbellEditable(next, crypto.randomUUID()));
          }} className={inputClass}><option value="">None</option>{equipmentOptions.map(item => <option key={item.slug} value={item.slug}>{item.label}</option>)}</select></label>}
          <AnnotationFields annotations={scene.annotations ?? []} durationMs={scene.durationMs} actions={jointActions} onChange={annotations => update({ ...scene, annotations })} />
        </div></details>
      </aside>
    </div>
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground"><p role="status">{status ?? "Choose equipment → adjust start and finish → preview → name and save"}</p>{status?.startsWith("Removed") && <button type="button" onClick={undo} disabled={!past.length} className={buttonClass}>Undo removal</button>}<span>Camera looks around · Edit changes the scene</span></div>
  </div>, language)}</WorkshopLanguageProvider>;
}
