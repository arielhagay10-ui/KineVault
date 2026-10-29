"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Group, Quaternion, Vector3 } from "three";
import type { AnatomyRig } from "@/lib/motion/anatomy";
import type { StudioLayout, StudioObject } from "@/lib/motion/workshop";
import { createBandGeometry, defaultBand, resolveBandAnchor, updateBandGeometry } from "@/lib/motion/studio-band";
import { EquipmentAsset } from "./equipment-asset";
import { useMotionFrame } from "./motion-frame";

export function StudioResistanceBand({ object, currentObject, studio, rig, group, equipmentRoots }: {
  object: StudioObject; currentObject: React.RefObject<StudioObject>; studio: StudioLayout; rig: AnatomyRig; group: React.RefObject<Group>; equipmentRoots: React.RefObject<Map<string, Group>>;
}) {
  const frame = useMotionFrame();
  const geometry = useMemo(() => createBandGeometry(), []);
  const scratch = useMemo(() => ({ start: new Vector3(), end: new Vector3(), down: new Vector3(), lastStart: new Vector3(Infinity, 0, 0), lastEnd: new Vector3(), lastDown: new Vector3(), rotation: new Quaternion(), defaults: defaultBand() }), []);
  const lastLength = useRef(-1);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    if (!group.current) return;
    const live = currentObject.current, band = live.band ?? scratch.defaults;
    const layout = frame?.current.scene?.studio ?? studio, time = frame?.current.timeMs ?? 0;
    group.current.worldToLocal(resolveBandAnchor(band.start, live, layout, time, rig, scratch.start, equipmentRoots.current.get(band.start.objectId ?? "")));
    group.current.worldToLocal(resolveBandAnchor(band.end, live, layout, time, rig, scratch.end, equipmentRoots.current.get(band.end.objectId ?? "")));
    scratch.down.set(0, -1, 0).applyQuaternion(group.current.getWorldQuaternion(scratch.rotation).invert());
    if (scratch.start.equals(scratch.lastStart) && scratch.end.equals(scratch.lastEnd) && scratch.down.equals(scratch.lastDown) && band.length === lastLength.current) return;
    updateBandGeometry(geometry, scratch.start, scratch.end, band.length, scratch.down);
    scratch.lastStart.copy(scratch.start); scratch.lastEnd.copy(scratch.end); scratch.lastDown.copy(scratch.down); lastLength.current = band.length;
  });
  return <group userData={{ workshopSupportExcluded: true }}>
    <EquipmentAsset object={object} currentObject={currentObject} fallback={null} />
    <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial color="#758b45" roughness={.65} metalness={0} /></mesh>
  </group>;
}
