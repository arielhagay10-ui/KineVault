"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Object3D, Vector3 } from "three";
import type { AnatomyRig } from "@/lib/motion/anatomy";
import { poseLimbs, solveLimbPose, type PoseLimb } from "@/lib/motion/limb-pose";
import { studioConstrainDelta } from "@/lib/motion/workshop-mouse";
import type { RigPose } from "@/lib/motion/workshop";
import { canUseStudioLimbNudge } from "@/lib/motion/workshop-interaction";
import type { StudioEditor } from "./studio-controls";
import { StudioTransformHandles } from "./studio-transform-handles";

export function StudioLimbHandles({ rig, editor }: { rig: AnatomyRig; editor: StudioEditor }) {
  const { invalidate } = useThree();
  const target = useMemo(() => new Object3D(), []);
  const consumed = useRef<number | null>(null);
  const gesture = useRef<{ pose: RigPose } | null>(null);
  const selected = editor.selection?.kind === "joint" ? editor.selection.slug : null;
  const limb = poseLimbs.find(item => `${item.startsWith("left") ? "left" : "right"}-${item.endsWith("hand") ? "wrist" : "ankle"}` === selected);
  const canSolve = !!limb && canUseStudioLimbNudge(editor, limb);
  const showArrows = canSolve && editor.tool === "translate";
  const point = (item: PoseLimb) => rig.bones[`${item.startsWith("left") ? "left" : "right"}-${item.endsWith("hand") ? "wrist" : "ankle"}`].getWorldPosition(new Vector3());
  const solve = (item: PoseLimb, position: Vector3, pose: RigPose) => {
    const result = solveLimbPose(rig, item, pose, position, editor.frontalPlane);
    editor.onLimbPoseChange?.(item, result.poses, result.error); invalidate();
    return { ...pose, ...result.poses };
  };
  useFrame(() => {
    if (!canSolve || !limb) return;
    if (!gesture.current) {
      const world = point(limb);
      target.position.copy(target.parent ? target.parent.worldToLocal(world) : world);
    }
    const request = editor.limbNudge;
    if (!request || request.id === consumed.current || request.limb !== limb || editor.dragging || gesture.current) return;
    consumed.current = request.id;
    editor.onLimbNudgeConsumed?.(request.id);
    if (!Number.isFinite(request.amount)) return;
    const delta = studioConstrainDelta(new Vector3().setComponent({ x: 0, y: 1, z: 2 }[request.axis], request.amount), editor.dragPlane ?? "view");
    if (delta.lengthSq() === 0) return;
    editor.onLimbDragStart?.();
    solve(limb, point(limb).add(delta), editor.limbPose ?? {});
    editor.onDragEnd();
  });
  if (!showArrows || !limb) return null;
  return <>
    <primitive object={target} />
    <StudioTransformHandles object={target} mode="translate"
      onStart={() => { gesture.current = { pose: editor.limbPose ?? {} }; editor.onLimbDragStart?.(); }}
      onChange={object => {
        if (gesture.current) gesture.current.pose = solve(limb, object.getWorldPosition(new Vector3()), gesture.current.pose);
      }} onCommit={() => { gesture.current = null; }}
      // Cancellation ends the solver session as well as restoring scene history.
      editor={{ ...editor, onDragEnd: cancelled => { gesture.current = null; editor.onDragEnd(cancelled); } }} />
  </>;
}
