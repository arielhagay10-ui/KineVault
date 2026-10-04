"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Group, Mesh, Quaternion, Vector3 } from "three";
import { machineCarriagePoint, machineHandlePoint, rowFootplate, rowPulleyPoint, reversePecDeckSeatZ } from "@/lib/motion/studio-machines";
import type { StudioObject } from "@/lib/motion/workshop";
import type { StudioEditor } from "./studio-controls";
import { StudioMachineDrag } from "./studio-machine-drag";

const steel = "#697d83", dark = "#243439", chrome = "#bdc9cc", pad = "#18282b";
type Point = { x: number; y: number; z: number };
function MovingGroup({ getPosition, children }: { getPosition: () => Point; children: React.ReactNode }) {
  const group = useRef<Group>(null);
  useFrame(() => { const point = getPosition(); group.current?.position.set(point.x, point.y, point.z); });
  return <group ref={group}>{children}</group>;
}
function MovingBlock({ getAt, size, color = dark }: { getAt: () => number[]; size: [number, number, number]; color?: string }) {
  const mesh = useRef<Mesh>(null);
  useFrame(() => { const at = getAt(); mesh.current?.position.set(at[0], at[1], at[2]); });
  return <mesh ref={mesh} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} metalness={.45} roughness={.4} /></mesh>;
}
function MovingBeam({ getEndpoints, radius = .035, color = steel }: { getEndpoints: () => { from: number[]; to: number[] }; radius?: number; color?: string }) {
  const mesh = useRef<Mesh>(null);
  const scratch = useRef({ from: new Vector3(), to: new Vector3(), direction: new Vector3(), up: new Vector3(0, 1, 0) });
  useFrame(() => {
    if (!mesh.current) return;
    const ends = getEndpoints(), { from, to, direction, up } = scratch.current;
    from.fromArray(ends.from); to.fromArray(ends.to); direction.copy(to).sub(from);
    mesh.current.position.copy(from).add(to).multiplyScalar(.5);
    mesh.current.scale.y = direction.length();
    mesh.current.quaternion.setFromUnitVectors(up, direction.normalize());
  });
  return <mesh ref={mesh} castShadow><cylinderGeometry args={[radius, radius, 1, 20]} /><meshStandardMaterial color={color} metalness={.75} roughness={.27} /></mesh>;
}
function Beam({ from, to, radius = 0.035, color = steel }: { from: number[]; to: number[]; radius?: number; color?: string }) {
  const a = new Vector3(...from), b = new Vector3(...to), direction = b.clone().sub(a);
  return <mesh position={a.add(b).multiplyScalar(0.5)} quaternion={new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize())} castShadow>
    <cylinderGeometry args={[radius, radius, direction.length(), 20]} /><meshStandardMaterial color={color} metalness={0.75} roughness={0.27} />
  </mesh>;
}
function Block({ at, size, color = dark, rotation = 0 }: { at: [number, number, number]; size: [number, number, number]; color?: string; rotation?: number }) {
  return <mesh position={at} rotation={[rotation, 0, 0]} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} metalness={color === pad ? 0 : 0.45} roughness={color === pad ? 0.85 : 0.4} /></mesh>;
}
function Plate({ x, y, z, radius = 0.23 }: { x: number; y: number; z: number; radius?: number }) {
  return <group position={[x, y, z]}>
    <mesh rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[radius, radius, 0.065, 40]} /><meshStandardMaterial color={dark} metalness={0.4} roughness={0.5} /></mesh>
    <mesh rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[radius * 0.7, 0.009, 8, 40]} /><meshStandardMaterial color={steel} /></mesh>
    <Beam from={[-0.043, 0, 0]} to={[0.043, 0, 0]} radius={0.045} color={chrome} />
  </group>;
}
function Feet({ width, front, back }: { width: number; front: number; back: number }) {
  return [-width, width].map(x => <group key={x}>
    <Block at={[x, 0.055, (front + back) / 2]} size={[0.13, 0.11, front - back]} color={steel} />
    {[front, back].map(z => <Block key={z} at={[x, 0.045, z]} size={[0.2, 0.09, 0.22]} />)}
  </group>);
}

export function StudioMachine({ object, currentObject, editor }: { object: StudioObject; currentObject?: React.RefObject<StudioObject>; editor?: StudioEditor }) {
  return <><MachineGeometry object={object} currentObject={currentObject} />{editor?.interactionEnabled !== false && editor && !editor.playing && editor.tool === "select" && editor.onMachineHandleChange && <>
    <StudioMachineDrag object={object} currentObject={currentObject} editor={editor} />
    {object.slug === "pec-deck" && <StudioMachineDrag object={object} currentObject={currentObject} editor={editor} side="right" />}
  </>}</>;
}

function MachineGeometry({ object, currentObject }: { object: StudioObject; currentObject?: React.RefObject<StudioObject> }) {
  const getObject = () => currentObject?.current ?? object;
  const getPoint = () => machineCarriagePoint(getObject());
  const getTravel = () => getObject().machinePosition ?? .5;
  if (object.slug === "cable-row-machine") return <>
    <Feet width={0.46} front={1.75} back={-0.85} />
    {[-0.65, 0.22].map(z => <Beam key={z} from={[0, 0.1, z]} to={[0, 0.52, z]} radius={0.055} />)}
    <Block at={[0, 0.612, -0.22]} size={[0.5, 0.13, 1.05]} color={pad} />
    {[-0.17, 0.17].map(x => <group key={x}>
      <Beam from={[x, 0.12, 0.88]} to={[x, rowFootplate.y, rowFootplate.z]} radius={0.035} />
      <Block at={[x, rowFootplate.y, rowFootplate.z]} size={[rowFootplate.width, rowFootplate.thickness, rowFootplate.length]} rotation={rowFootplate.angle} />
    </group>)}
    {[-0.32, 0.32].map(x => <Beam key={x} from={[x, 0.1, 1.6]} to={[x, 2.4, 1.6]} radius={0.05} />)}
    <Beam from={[-0.32, 2.4, 1.6]} to={[0.32, 2.4, 1.6]} radius={0.05} />
    {[-0.18, 0.18].map(x => <Beam key={x} from={[x, 0.12, 1.6]} to={[x, 2.32, 1.6]} radius={0.014} color={chrome} />)}
    {Array.from({ length: 10 }, (_, index) => <MovingBlock key={index} size={[0.46, 0.05, 0.24]}  getAt={() => [0, 0.2 + index * 0.063 + getTravel() * 0.66, 1.6]} />)}
    <MovingBeam radius={0.008} color={dark}  getEndpoints={() => ({ from: [0, 0.82 + getTravel() * 0.66, 1.6], to: [0, 2.4, 1.6] })} />
    <Beam from={[0, 2.4, 1.6]} to={[0, rowPulleyPoint.y, rowPulleyPoint.z]} radius={0.008} color={dark} />
    <MovingBeam radius={0.008} color={dark}  getEndpoints={() => ({ from: [0, rowPulleyPoint.y, rowPulleyPoint.z], to: [0, getPoint().y, getPoint().z + 0.08] })} />
    {[1.6, rowPulleyPoint.z].map(z => <mesh key={z} position={[0, z === 1.6 ? 2.4 : rowPulleyPoint.y, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.075, 0.075, 0.04, 32]} /><meshStandardMaterial color={dark} /></mesh>)}
    <MovingGroup getPosition={getPoint}>
      <Beam from={[-0.15, -0.14, 0]} to={[0, 0, 0.08]} radius={0.017} color={chrome} />
      <Beam from={[0.15, -0.14, 0]} to={[0, 0, 0.08]} radius={0.017} color={chrome} />
      {[-0.15, 0.15].map(x => <Beam key={x} from={[x, -0.14, 0]} to={[x, 0.14, 0]} radius={0.023} color={dark} />)}
    </MovingGroup>
  </>;
  if (object.slug === "pec-deck") return <>
    <Feet width={0.56} front={0.85} back={-1.4} />
    <Beam from={[0, 0.1, 0]} to={[0, 0.52, 0]} radius={0.065} />
    <Block at={[0, 0.59, 0]} size={[0.52, 0.13, 0.44]} color={pad} />
    <Block at={[0, 1.3, -0.2]} size={[0.49, 1.05, 0.14]} color={pad} />
    <Beam from={[0, 0.15, -1.32]} to={[0, 1.3, -0.28]} radius={0.04} />
    {[-0.38, 0.38].map(x => <Beam key={x} from={[x, 0.1, -1.32]} to={[x, 2.62, -1.32]} radius={0.055} />)}
    <Beam from={[-0.38, 2.62, -1.32]} to={[0.38, 2.62, -1.32]} radius={0.05} />
    {[-0.18, 0.18].map(x => <Beam key={x} from={[x, 0.14, -1.32]} to={[x, 2.5, -1.32]} radius={0.014} color={chrome} />)}
    {Array.from({ length: 10 }, (_, index) => <MovingBlock key={index} size={[0.46, 0.05, 0.23]}  getAt={() => [0, 0.2 + index * 0.063 + getTravel() * 0.4, -1.32]} />)}
    <MovingBeam radius={0.008} color={dark}  getEndpoints={() => ({ from: [0, 0.83 + getTravel() * 0.4, -1.32], to: [0, 2.62, -1.32] })} />
    <Beam from={[-0.38, 2.62, -1.32]} to={[-0.289, 2.62, reversePecDeckSeatZ]} radius={0.045} />
    <Beam from={[0.38, 2.62, -1.32]} to={[0.289, 2.62, reversePecDeckSeatZ]} radius={0.045} />
    {(["left", "right"] as const).map(side => {
      const handle = () => machineHandlePoint(getObject(), side), sign = (side === "left" ? 1 : -1) * (object.machineMode === "reverse" ? -1 : 1);
      const pivotZ = object.machineMode === "reverse" ? reversePecDeckSeatZ : 0;
      return <group key={side}>
        <MovingBeam radius={0.035}  getEndpoints={() => ({ from: [sign * 0.289, 2.62, pivotZ], to: [handle().x, 1.93, handle().z] })} />
        <MovingBeam radius={0.028} color={chrome}  getEndpoints={() => ({ from: [handle().x, 1.93, handle().z], to: [handle().x, 1.72, handle().z] })} />
        <MovingBeam radius={0.023} color={dark}  getEndpoints={() => ({ from: [handle().x, 1.72, handle().z], to: [handle().x, 1.35, handle().z] })} />
        <Beam from={[sign * 0.289, 2.62, pivotZ]} to={[sign * 0.289, 2.76, pivotZ]} radius={0.04} color={chrome} />
        <mesh position={[sign * 0.289, 2.76, pivotZ]}><cylinderGeometry args={[0.15, 0.15, 0.055, 40]} /><meshStandardMaterial color={dark} /></mesh>
      </group>;
    })}
  </>;
  if (object.slug === "lat-pulldown-machine") return <>
    <Feet width={0.5} front={0.76} back={-0.73} />
    {[-0.43, 0.43].map(x => <group key={x}><Beam from={[x, 0.1, -0.55]} to={[x, 2.75, -0.55]} radius={0.055} /><Beam from={[x, 2.75, -0.55]} to={[x, 2.75, 0.25]} radius={0.045} /></group>)}
    <Beam from={[-0.43, 2.75, -0.55]} to={[0.43, 2.75, -0.55]} radius={0.045} />
    <Beam from={[-0.43, 2.75, 0.22]} to={[0.43, 2.75, 0.22]} />
    {[-0.18, 0.18].map(x => <Beam key={x} from={[x, 0.16, -0.55]} to={[x, 2.55, -0.55]} radius={0.014} color={chrome} />)}
    <Block at={[0, 1.23, -0.68]} size={[0.62, 2.08, 0.06]} color={steel} />
    {Array.from({ length: 10 }, (_, index) => <MovingBlock key={index} size={[0.46, 0.05, 0.24]}  getAt={() => [0, 0.24 + index * 0.063 + getTravel() * 0.98, -0.52]} />)}
    <Beam from={[0, 0.1, 0]} to={[0, 0.66, 0]} radius={0.065} />
    <Block at={[0, 0.74, 0]} size={[0.52, 0.13, 0.44]} color={pad} />
    <Beam from={[0, 0.2, 0.5]} to={[0, 0.84, 0.5]} />
    <Beam from={[-0.36, 0.88, 0.49]} to={[0.36, 0.88, 0.49]} radius={0.085} color={pad} />
    <Beam from={[0, 2.75, -0.55]} to={[0, 2.75, 0.22]} radius={0.008} color={dark} />
    <MovingBeam radius={0.008} color={dark}  getEndpoints={() => ({ from: [0, 2.75, -0.55], to: [0, 0.86 + getTravel() * 0.98, -0.55] })} />
    <MovingBeam radius={0.008} color={dark}  getEndpoints={() => ({ from: [0, 2.75, 0.22], to: [getPoint().x, getPoint().y + 0.07, getPoint().z] })} />
    <MovingGroup getPosition={getPoint}>
      <Beam from={[-0.48, 0, 0]} to={[0.48, 0, 0]} radius={0.023} color={chrome} />
      <Beam from={[-0.72, -0.1, 0]} to={[-0.48, 0, 0]} radius={0.025} color={dark} /><Beam from={[0.48, 0, 0]} to={[0.72, -0.1, 0]} radius={0.025} color={dark} />
      <Beam from={[0, 0, 0]} to={[0, 0.07, 0]} radius={0.014} />
    </MovingGroup>
    {[-0.55, 0.22].map(z => <mesh key={z} position={[0, 2.75, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.09, 0.09, 0.045, 32]} /><meshStandardMaterial color={dark} /></mesh>)}
  </>;
  if (object.slug === "smith-machine") return <>
    <Feet width={1.02} front={0.7} back={-0.7} />
    {[-1.02, 1.02].map(x => <group key={x}>
      <Beam from={[x, 0.1, -0.4]} to={[x, 3.25, -0.4]} radius={0.065} />
      <Beam from={[Math.sign(x) * 0.83, 0.16, -0.12]} to={[Math.sign(x) * 0.83, 3.13, -0.12]} radius={0.022} color={chrome} />
      <Beam from={[x, 0.15, -0.6]} to={[x, 1.5, -0.4]} radius={0.03} />
      {Array.from({ length: 13 }, (_, index) => <Block key={index} at={[Math.sign(x) * 0.96, 0.48 + index * 0.14, -0.25]} size={[0.07, 0.035, 0.15]} color={chrome} />)}
      <Block at={[Math.sign(x) * 0.83, 0.86, -0.12]} size={[0.12, 0.1, 0.2]} color={dark} />
      {[0.45, 0.8].map(y => <group key={y}><Beam from={[x, y, -0.4]} to={[Math.sign(x) * 1.26, y, -0.4]} radius={0.023} color={chrome} /><Plate x={Math.sign(x) * 1.14} y={y} z={-0.4} radius={0.17} /></group>)}
    </group>)}
    <Beam from={[-1.02, 3.25, -0.4]} to={[1.02, 3.25, -0.4]} radius={0.06} />
    <MovingGroup getPosition={getPoint}>
      <Beam from={[-1.4, 0, 0]} to={[1.4, 0, 0]} radius={0.025} color={chrome} />
      {[-0.83, 0.83].map(x => <group key={x}><Beam from={[x, -0.12, 0]} to={[x, 0.12, 0]} radius={0.055} /><Beam from={[x, 0, 0]} to={[Math.sign(x) * 0.96, 0, -0.15]} radius={0.017} /></group>)}
      {[-1.23, -1.15, 1.15, 1.23].map(x => <Plate key={x} x={x} y={0} z={0} />)}
    </MovingGroup>
  </>;
  return <>
    <Feet width={0.64} front={1.05} back={-1.25} />
    {[-0.64, 0.64].map(x => <group key={x}>
      <Beam from={[x, 0.64, -0.24]} to={[x, 1.85, 0.97]} radius={0.035} color={chrome} />
      <Beam from={[x, 0.1, 0.97]} to={[x, 1.85, 0.97]} radius={0.05} />
      <Beam from={[x, 0.1, -0.5]} to={[x, 0.64, -0.24]} radius={0.05} />
    </group>)}
    <Beam from={[-0.64, 1.85, 0.97]} to={[0.64, 1.85, 0.97]} />
    <Block at={[0, 0.52, -0.48]} size={[0.56, 0.14, 0.48]} color={pad} />
    <Block at={[0, 1.0, -0.98]} size={[0.55, 1.12, 0.14]} color={pad} rotation={-Math.PI / 4} />
    <Beam from={[0, 0.1, -1.1]} to={[0, 0.85, -1.1]} radius={0.07} />
    {[-0.36, 0.36].map(x => <Beam key={x} from={[x, 0.74, -0.53]} to={[x, 0.74, -0.17]} radius={0.022} color={chrome} />)}
    <MovingGroup getPosition={getPoint}>
      <Block at={[0, 0, 0]} size={[1.03, 0.09, 0.68]} rotation={Math.PI / 4} />
      {[-0.24, -0.12, 0, 0.12, 0.24].map(z => <Block key={z} at={[0, -z * Math.SQRT1_2 + 0.034, z * Math.SQRT1_2 - 0.034]} size={[0.98, 0.008, 0.012]} rotation={Math.PI / 4} color={steel} />)}
      <Beam from={[-1.05, 0.08, 0.08]} to={[1.05, 0.08, 0.08]} radius={0.026} color={chrome} />
      {[-0.83, -0.91, 0.83, 0.91].map(x => <Plate key={x} x={x} y={0.08} z={0.08} />)}
      {[-0.64, 0.64].map(x => <Beam key={x} from={[x, -0.1, -0.1]} to={[x, 0.1, 0.1]} radius={0.06} />)}
    </MovingGroup>
  </>;
}

