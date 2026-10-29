"use client";

import { createPortal, useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import { Group } from "three";
import type { AnatomyRig } from "@/lib/motion/anatomy";
import type { JointSlug } from "@/lib/motion/workshop";
import { readJointAngles } from "@/lib/motion/studio";
import type { StudioEditor } from "./studio-controls";
import { StudioTransformHandles } from "./studio-transform-handles";

export function StudioJointRotation({ rig, slug, editor }: { rig: AnatomyRig; slug: JointSlug; editor: StudioEditor }) {
  const proxy = useRef<Group>(null!);
  const dragging = useRef(false);
  const bone = rig.bones[slug], linked = !!editor.jointPosePreview;
  const synchronize = () => {
    if (!proxy.current || dragging.current) return;
    proxy.current.position.copy(bone.position);
    proxy.current.quaternion.copy(bone.quaternion);
    proxy.current.scale.copy(bone.scale);
    proxy.current.updateWorldMatrix(true, true);
  };
  useLayoutEffect(synchronize, [bone, linked]);
  useFrame(() => { if (linked) synchronize(); }, -1.5);
  if (!linked) return <StudioTransformHandles object={bone} mode="rotate" editor={editor}
    onCommit={object => editor.onJointChange(slug, readJointAngles(slug, object))} />;
  // Keep the pointer target independent of the bone that the contact solver updates.
  return <>
    {createPortal(<group ref={proxy} />, bone.parent!)}
    <StudioTransformHandles object={proxy} mode="rotate" editor={{ ...editor, onDragEnd: cancelled => {
      dragging.current = false; editor.onDragEnd(cancelled);
    } }} onStart={() => { dragging.current = true; editor.onDragStart(); }} onCommit={object => {
      editor.onJointChange(slug, readJointAngles(slug, object));
    }} />
  </>;
}
