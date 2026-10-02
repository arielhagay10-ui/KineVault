"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BufferGeometry, Group, Quaternion, Vector3 } from "three";
import type { AnatomyRig } from "@/lib/motion/anatomy";
import { studioCableFrame } from "@/lib/motion/studio-cable";
import { maxPulleyHeight } from "@/lib/motion/studio";
import { alignedCableTransform } from "@/lib/motion/studio-constraints";
import type { RigPose, StudioObject } from "@/lib/motion/workshop";
import type { StudioEditor } from "./studio-controls";

function Shaft({ from, to, radius = 0.022, color = "#627479" }: { from: [number, number, number]; to: [number, number, number]; radius?: number; color?: string }) {
  const a = new Vector3(...from), b = new Vector3(...to), direction = b.clone().sub(a);
  return <mesh position={a.add(b).multiplyScalar(0.5)} quaternion={new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize())} castShadow>
    <cylinderGeometry args={[radius, radius, direction.length(), 16]} /><meshStandardMaterial color={color} metalness={0.55} roughness={0.35} />
  </mesh>;
}

export function StudioCable({ object, rig, group, pose, editor }: { object: StudioObject; rig: AnatomyRig; group: React.RefObject<Group>; pose: RigPose; editor?: StudioEditor }) {
  const end = useRef<Group>(null), left = useRef<Group>(null), right = useRef<Group>(null);
  const knot = useRef<Group>(null);
  const cuff = useRef<Group>(null);
  const wire = useMemo(() => new BufferGeometry(), []);
  const lastReach = useRef<boolean | null>(null);
  const kind = object.cableAttachment ?? "d-handle";
  useEffect(() => () => wire.dispose(), [wire]);
  useFrame(() => {
    if (!group.current || !end.current) return;
    const tower = group.current;
    if (object.shoulderAlignment && !editor?.dragging) {
      const transform = alignedCableTransform(rig, object);
      tower.position.set(transform.x, transform.y, transform.z);
      tower.rotation.set(0, transform.rotationY * Math.PI / 180, 0);
      tower.updateWorldMatrix(true, true);
    }
    const frame = studioCableFrame(rig, object, tower, pose);
    const inverse = tower.getWorldQuaternion(new Quaternion()).invert();
    end.current.position.copy(tower.worldToLocal(frame.center.clone()));
    end.current.quaternion.copy(inverse.clone().multiply(frame.rotation));
    knot.current?.position.copy(tower.worldToLocal(frame.connection.clone()));
    cuff.current?.scale.set(frame.cuffRadius, 0.22, frame.cuffRadius);
    const points = [tower.worldToLocal(frame.pulley.clone()), tower.worldToLocal(frame.connection.clone())];
    for (const side of ["left", "right"] as const) {
      const branch = side === "left" ? left.current : right.current;
      if (!branch) continue;
      const grip = frame.ropeGrips.find(item => item.side === side);
      branch.visible = !!grip;
      if (!grip) continue;
      branch.position.copy(tower.worldToLocal(grip.point.clone()));
      branch.quaternion.copy(inverse.clone().multiply(grip.rotation));
      const tip = new Vector3(side === "left" ? -0.08 : 0.08, 0, 0).multiplyScalar(frame.scale).applyQuaternion(grip.rotation).add(grip.point);
      points.push(tower.worldToLocal(frame.connection.clone()), tower.worldToLocal(tip));
    }
    wire.setFromPoints(points); wire.computeBoundingSphere();
    if (lastReach.current !== frame.reachable) { lastReach.current = frame.reachable; editor?.onGripReach(object.id, frame.reachable); }
  });
  return <>
    <mesh position={[0, (maxPulleyHeight + 0.15) / 2, 0]}><boxGeometry args={[0.14, maxPulleyHeight + 0.15, 0.18]} /><meshStandardMaterial color="#627479" metalness={0.55} /></mesh>
    <mesh position={[0, 0.08, 0]}><boxGeometry args={[0.8, 0.16, 0.8]} /><meshStandardMaterial color="#263b3b" /></mesh>
    {Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[0, 0.22 + i * 0.065, -0.17]}><boxGeometry args={[0.4, 0.05, 0.3]} /><meshStandardMaterial color="#263b3b" /></mesh>)}
    <mesh position={[0, object.pulleyHeight, 0.2]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.09, 0.09, 0.06, 24]} /><meshStandardMaterial color="#263b3b" /></mesh>
    <lineSegments geometry={wire}><lineBasicMaterial color="#34484b" /></lineSegments>
    {(kind === "rope" || kind === "cuff") && <group ref={knot}><mesh>{kind === "cuff" ? <torusGeometry args={[0.018, 0.005, 8, 20]} /> : <sphereGeometry args={[0.025, 12, 12]} />}<meshStandardMaterial color="#627479" metalness={0.6} /></mesh></group>}
    <group ref={end}>
      {kind === "cuff" ? <group ref={cuff}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1, 0.16, 10, 32]} /><meshStandardMaterial color="#263b3b" roughness={0.85} /></mesh>
      </group> : kind === "d-handle" ? <>
        <Shaft from={[-0.1, 0, 0]} to={[0.1, 0, 0]} color="#263b3b" />
        <Shaft from={[-0.1, 0, 0]} to={[-0.1, 0.1, 0]} radius={0.01} /><Shaft from={[0.1, 0, 0]} to={[0.1, 0.1, 0]} radius={0.01} />
        <mesh position={[0, 0.1, 0]}><torusGeometry args={[0.1, 0.01, 8, 24, Math.PI]} /><meshStandardMaterial color="#627479" metalness={0.55} /></mesh>
      </> : kind === "straight-bar" ? <Shaft from={[-0.34, 0, 0]} to={[0.34, 0, 0]} />
        : kind === "angled-bar" ? <>
          <Shaft from={[-0.12, -0.0163, 0]} to={[0.12, -0.0163, 0]} />
          <Shaft from={[-0.34, -0.0964, 0]} to={[-0.12, -0.0163, 0]} /><Shaft from={[0.12, -0.0163, 0]} to={[0.34, -0.0964, 0]} />
        </> : kind === "v-bar" ? <><Shaft from={[-0.2, -0.2, 0]} to={[0, 0, 0]} /><Shaft from={[0, 0, 0]} to={[0.2, -0.2, 0]} /></> : null}
      {kind !== "rope" && kind !== "cuff" && <Shaft from={[0, kind === "d-handle" ? 0.2 : kind === "angled-bar" ? -0.0163 : 0, 0]} to={[0, kind === "d-handle" ? 0.21 : 0.08, 0]} radius={0.01} />}
    </group>
    {kind === "rope" && (["left", "right"] as const).map(side => <group key={side} ref={side === "left" ? left : right}>
      <Shaft from={[-0.09, 0, 0]} to={[0.09, 0, 0]} radius={0.018} color="#343d3b" />
      <mesh position={[side === "left" ? 0.11 : -0.11, 0, 0]}><sphereGeometry args={[0.04, 16, 12]} /><meshStandardMaterial color="#263b3b" /></mesh>
    </group>)}
  </>;
}
