"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Group, Mesh, Quaternion, Vector3 } from "three";
import { machineCarriagePoint, machineHandlePoint, machineLever, rowFootplate, rowPulleyPoint, reversePecDeckSeatZ } from "@/lib/motion/studio-machines";
import type { RigPose, StudioObject } from "@/lib/motion/workshop";
import type { AnatomyRig } from "@/lib/motion/anatomy";
import type { StudioEditor } from "./studio-controls";
import { StudioMachineDrag } from "./studio-machine-drag";
import { StudioCable } from "./studio-cable";
import { canUseStudioMachineHandle } from "@/lib/motion/workshop-interaction";
import { EquipmentAsset } from "./equipment-asset";
import { plateRow } from "@/lib/motion/plate-row";
import { shoulderPress, shoulderPressGripSegment, shoulderPressLever } from "@/lib/motion/shoulder-press";
import { tBarRow } from "@/lib/motion/t-bar-row";
import { legPress } from "@/lib/motion/leg-press";
import { chestPress, chestPressLever } from "@/lib/motion/chest-press";

const steel = "#697d83", dark = "#243439", chrome = "#bdc9cc", pad = "#18282b";
type Point = { x: number; y: number; z: number };
function MovingGroup({ getPosition, children }: { getPosition: () => Point; children: React.ReactNode }) {
  const group = useRef<Group>(null);
  useFrame(() => { const point = getPosition(); group.current?.position.set(point.x, point.y, point.z); });
  return <group ref={group} userData={{ workshopSupportExcluded: true }}>{children}</group>;
}
function MovingBlock({ getAt, size, color = dark }: { getAt: () => number[]; size: [number, number, number]; color?: string }) {
  const mesh = useRef<Mesh>(null);
  useFrame(() => { const at = getAt(); mesh.current?.position.set(at[0], at[1], at[2]); });
  return <mesh ref={mesh} userData={{ workshopSupportExcluded: true }} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} metalness={.45} roughness={.4} /></mesh>;
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
  return <mesh ref={mesh} userData={{ workshopSupportExcluded: true }} castShadow><cylinderGeometry args={[radius, radius, 1, 20]} /><meshStandardMaterial color={color} metalness={.75} roughness={.27} /></mesh>;
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

function ShoulderPressGrip({ getObject, side }: { getObject: () => StudioObject; side: "left" | "right" }) {
  const group = useRef<Group>(null);
  const wide = shoulderPressGripSegment(side, "wide"), neutral = shoulderPressGripSegment(side, "neutral");
  const { axis } = shoulderPressLever(getObject(), side);
  const [, y, z] = shoulderPress.wide.center;
  const local = (point: number[]) => [point[0], point[1] - y, point[2] - z];
  useFrame(() => {
    const lever = shoulderPressLever(getObject(), side);
    if (group.current) group.current.quaternion.setFromAxisAngle(lever.axis, -lever.angle);
  });
  return <group ref={group} position={[0, y, z]}>
    <Beam from={axis.clone().multiplyScalar(-.05).toArray()} to={axis.clone().multiplyScalar(.05).toArray()} radius={.04} color={chrome} />
    <Beam from={local(wide.from)} to={local(wide.to)} radius={.026} color={pad} />
    <Beam from={local(neutral.from)} to={local(neutral.to)} radius={.026} color={pad} />
  </group>;
}

function Lever({ getObject, side }: { getObject: () => StudioObject; side: "left" | "right" }) {
  const group = useRef<Group>(null);
  const row = getObject().slug === "row-machine", sign = side === "left" ? 1 : -1;
  useFrame(() => {
    const lever = machineLever(getObject(), side);
    if (group.current) {
      group.current.position.copy(lever.pivot);
      if (row) group.current.rotation.x = lever.angle;
      else group.current.quaternion.setFromAxisAngle(shoulderPressLever(getObject(), side).axis, lever.angle);
    }
  });
  return <group ref={group} userData={{ workshopSupportExcluded: true }}>
    <Beam from={[0, 0, 0]} to={row ? [0, .76, .12] : [...shoulderPress.arm]} radius={row ? .055 : .04} color={row ? "#994334" : chrome} />
    {row ? <>
      <Beam from={[0, .76, .12]} to={[-sign * .25, .80, .08]} radius={.025} color={chrome} />
      <Beam from={[-sign * .25, .67, .08]} to={[-sign * .25, .91, .08]} radius={.026} color={pad} />
      <Beam from={[-sign * .25, .94, .02]} to={[sign * .1, .94, .02]} radius={.026} color={pad} />
      <Beam from={[0, .76, .12]} to={[sign * .1, .94, .02]} radius={.025} color={chrome} />
      <Beam from={[0, 0, 0]} to={[0, plateRow.load.y, plateRow.load.z]} radius={.065} color="#994334" />
    </> : <>
      <Beam from={[0, 0, 0]} to={[0, shoulderPress.load.y, shoulderPress.load.z]} radius={.04} color={chrome} />
      <ShoulderPressGrip getObject={getObject} side={side} />
    </>}
    <Beam from={[0, row ? plateRow.load.y : shoulderPress.load.y, row ? plateRow.load.z : shoulderPress.load.z]} to={[sign * (row ? plateRow.load.hornLength : shoulderPress.load.hornLength), row ? plateRow.load.y : shoulderPress.load.y, row ? plateRow.load.z : shoulderPress.load.z]} radius={.025} color={chrome} />
    <Plate x={sign * .16} y={row ? plateRow.load.y : shoulderPress.load.y} z={row ? plateRow.load.z : shoulderPress.load.z} radius={row ? plateRow.load.radius : shoulderPress.load.radius} />
  </group>;
}

export function StudioMachine({ object, currentObject, editor, rig, group, pose }: { object: StudioObject; currentObject?: React.RefObject<StudioObject>; editor?: StudioEditor; rig: AnatomyRig; group: React.RefObject<Group>; pose: RigPose }) {
  return <><EquipmentAsset object={object} currentObject={currentObject} fallback={<MachineGeometry object={object} currentObject={currentObject} />} />
    <group userData={{ workshopSupportExcluded: true }}><MachineCables object={object} currentObject={currentObject} /></group>
    {object.slug === "cable-row-machine" && object.cableAttachment && <StudioCable object={object} currentObject={currentObject} rig={rig} group={group} pose={pose} editor={editor} showTower={false} />}
    {object.slug !== "row-machine" && canUseStudioMachineHandle(editor) && editor?.onMachineHandleChange && (object.slug !== "cable-row-machine" || object.machineUse) && <>
    <StudioMachineDrag object={object} currentObject={currentObject} editor={editor} />
    {["pec-deck", "chest-press-machine"].includes(object.slug) && <StudioMachineDrag object={object} currentObject={currentObject} editor={editor} side="right" />}
  </>}</>;
}

function MachineCables({ object, currentObject }: { object: StudioObject; currentObject?: React.RefObject<StudioObject> }) {
  const getObject = () => currentObject?.current ?? object;
  const getPoint = () => machineCarriagePoint(getObject());
  const getTravel = () => getObject().machinePosition ?? .5;
  if (object.slug === "chest-press-machine") return <>
    {(["left", "right"] as const).map(side => {
      const sign = side === "left" ? 1 : -1;
      return <group key={side}>
        <MovingBeam radius={.005} color={dark} getEndpoints={() => {
          const lever = chestPressLever(getObject(), side);
          const start = new Vector3(0, .18, 0).applyAxisAngle(lever.axis, lever.angle).add(lever.pivot);
          return { from: start.toArray(), to: [sign * .7, .14, -.46] };
        }} />
        <Beam from={[sign * .7, .14, -.46]} to={[-1.05 + sign * .035, .14, -.46]} radius={.005} color={dark} />
        <Beam from={[-1.05 + sign * .035, .14, -.46]} to={[-1.05 + sign * .035, 1.96, -.46]} radius={.005} color={dark} />
        <MovingBeam radius={.005} color={dark} getEndpoints={() => ({ from: [-1.05 + sign * .035, 1.96, -.46], to: [-1.05 + sign * .035, .90 + Math.max(getObject().machinePositionLeft ?? getTravel(), getObject().machinePositionRight ?? getTravel()) * .26, -.46] })} />
      </group>;
    })}
  </>;
  if (object.slug === "lat-pulldown-machine") return <>
    <Beam from={[0, 2.75, -.55]} to={[0, 2.75, .22]} radius={.008} color={dark} />
    <MovingBeam radius={.008} color={dark} getEndpoints={() => ({ from: [0, 2.75, -.55], to: [0, .86 + getTravel() * .98, -.55] })} />
    <MovingBeam radius={.008} color={dark} getEndpoints={() => ({ from: [0, 2.75, .22], to: [getPoint().x, getPoint().y + .07, getPoint().z] })} />
  </>;
  if (object.slug === "cable-row-machine") return <>
    <MovingBeam radius={.008} color={dark} getEndpoints={() => ({ from: [0, .82 + getTravel() * .66, 1.6], to: [0, 2.4, 1.6] })} />
    <Beam from={[0, 2.4, 1.6]} to={[0, rowPulleyPoint.y, rowPulleyPoint.z]} radius={.008} color={dark} />
    {!object.cableAttachment && <MovingBeam radius={.008} color={dark} getEndpoints={() => ({ from: [0, rowPulleyPoint.y, rowPulleyPoint.z], to: [0, getPoint().y, getPoint().z + .08] })} />}
  </>;
  if (object.slug === "pec-deck") return <MovingBeam radius={.008} color={dark} getEndpoints={() => ({ from: [0, .83 + getTravel() * .4, -1.32], to: [0, 2.62, -1.32] })} />;
  return null;
}

function TBarRowGeometry({ getObject }: { getObject: () => StudioObject }) {
  const lever = useRef<Group>(null);
  useFrame(() => {
    const sampled = machineLever(getObject(), "left");
    if (lever.current) { lever.current.position.copy(sampled.pivot); lever.current.rotation.x = sampled.angle; }
  });
  return <>
    {[-1, 1].map(sign => <group key={sign}>
      <Block at={[sign * .59, .025, .76]} size={[.30, .05, .22]} />
      <Block at={[sign * .29, .025, -.94]} size={[.22, .05, .25]} />
      <Beam from={[sign * .59, .07, .76]} to={[sign * .20, 1.18, .18]} radius={.05} />
      <Beam from={[sign * .20, 1.18, .18]} to={[sign * .29, .18, -.94]} radius={.045} />
      <Block at={[sign * .24, .26, -.79]} size={[.33, .04, .48]} rotation={tBarRow.foot.angle} color={chrome} />
    </group>)}
    <Block at={tBarRow.pad.toArray()} size={[.43, .57, .14]} rotation={tBarRow.padAngle} color={pad} />
    <Beam from={[-.29, .35, -.85]} to={[.29, .35, -.85]} radius={.04} />
    <group ref={lever} userData={{ workshopSupportExcluded: true }}>
      <Beam from={[0, 0, 0]} to={[0, .04, 1.78]} radius={.043} />
      <Beam from={[-.36, .04, 1.40]} to={[.36, .04, 1.40]} />
      {[-1, 1].map(sign => <group key={sign}>
        <Beam from={[sign * .36, .04, 1.40]} to={[sign * .28, .34, 1.40]} radius={.035} />
        <Beam from={[sign * .28, .292, 1.218]} to={[sign * .28, .388, 1.482]} radius={.025} color={chrome} />
        <Beam from={[sign * .28, .38, 1.40]} to={[sign * .53, .38, 1.40]} radius={.025} color={chrome} />
      </group>)}
      <Beam from={[0, .04, 1.78]} to={[0, .04, 2.07]} radius={.025} color={chrome} />
    </group>
  </>;
}

function ChestPressArm({ getObject, side }: { getObject: () => StudioObject; side: "left" | "right" }) {
  const lever = useRef<Group>(null), handle = useRef<Group>(null), sign = side === "left" ? 1 : -1;
  useFrame(() => {
    const frame = chestPressLever(getObject(), side);
    if (lever.current) { lever.current.position.copy(frame.pivot); lever.current.quaternion.setFromAxisAngle(frame.axis, frame.angle); }
    if (handle.current) handle.current.quaternion.setFromAxisAngle(frame.axis, -frame.angle);
  });
  const points = [[0, 0, 0], [sign * .08, .34, .02], [sign * .04, .68, .01], [-sign * .28, 1.02, 0]];
  return <group ref={lever} userData={{ workshopSupportExcluded: true }}>
    {points.slice(1).map((point, index) => <Beam key={index} from={points[index]} to={point} radius={.047} color={dark} />)}
    <group ref={handle} position={[sign * chestPress.arm[0], chestPress.arm[1], chestPress.arm[2]]}>
      {chestPress.handle.slice(1).map((point, index) => {
        const previous = chestPress.handle[index];
        return <Beam key={index} from={[sign * previous[0], previous[1], previous[2]]} to={[sign * point[0], point[1], point[2]]} radius={.024} color={pad} />;
      })}
    </group>
  </group>;
}

function ChestPressGeometry({ getObject }: { getObject: () => StudioObject }) {
  return <>
    <Feet width={.63} front={.85} back={-.64} />
    <Beam from={[0, .1, 0]} to={[0, .53, 0]} radius={.055} />
    <Block at={[...chestPress.seat.center]} size={[...chestPress.seat.size]} color={pad} />
    <Beam from={[0, .1, -.30]} to={[0, 1.78, -.36]} radius={.043} />
    <Block at={[...chestPress.back.center]} size={[...chestPress.back.size]} rotation={chestPress.back.degrees * Math.PI / 180} color={pad} />
    <Block at={[0, 1.84, -.31]} size={[.28, .20, .12]} color={pad} />
    <Beam from={[-1.05, .12, -.46]} to={[.63, .12, -.46]} radius={.05} />
    <Block at={[-1.05, 1.07, -.62]} size={[.35, 1.88, .08]} />
    {[-1.23, -.87].map(x => <Beam key={x} from={[x, .14, -.46]} to={[x, 2.03, -.46]} radius={.038} />)}
    <Block at={[-1.05, 2.04, -.46]} size={[.42, .10, .43]} />
    {Array.from({ length: 13 }, (_, index) => <MovingBlock key={index} getAt={() => [-1.05, .24 + index * .052 + Math.max((getObject().machinePositionLeft ?? getObject().machinePosition ?? 0), (getObject().machinePositionRight ?? getObject().machinePosition ?? 0)) * .26, -.46]} size={[.29, .042, .25]} />)}
    {(["left", "right"] as const).map(side => <group key={side}>
      <Beam from={[side === "left" ? chestPress.pivot[0] : -chestPress.pivot[0], .12, chestPress.pivot[2]]} to={chestPressLever(getObject(), side).pivot.toArray()} radius={.05} />
      <ChestPressArm getObject={getObject} side={side} />
    </group>)}
  </>;
}

function MachineGeometry({ object, currentObject }: { object: StudioObject; currentObject?: React.RefObject<StudioObject> }) {
  const getObject = () => currentObject?.current ?? object;
  const getPoint = () => machineCarriagePoint(getObject());
  const getTravel = () => getObject().machinePosition ?? .5;
  if (object.slug === "chest-press-machine") return <ChestPressGeometry getObject={getObject} />;
  if (object.slug === "t-bar-row-machine") return <TBarRowGeometry getObject={getObject} />;
  if (object.slug === "row-machine") return <>
    <Feet width={.70} front={1.14} back={-.83} />
    <Beam from={[0, .1, -.17]} to={[0, .49, -.17]} radius={.06} />
    <MovingBlock getAt={() => [0, (getObject().rowSeatHeight ?? plateRow.seat.standard) - .055, plateRow.seat.z]} size={[.48, .11, .50]} color={pad} />
    <MovingBeam getEndpoints={() => ({ from: [0, .4, -.17], to: [0, (getObject().rowSeatHeight ?? plateRow.seat.standard) - .06, -.17] })} radius={.0375} color={chrome} />
    <Beam from={[0, .1, .42]} to={[0, plateRow.pad.y, .37]} radius={.043} />
    <Block at={[0, plateRow.pad.y, plateRow.pad.z]} size={[.34, .45, .14]} color={pad} />
    {[-1, 1].map(sign => <Block key={sign} at={[sign * plateRow.foot.x, plateRow.foot.y, plateRow.foot.z]} size={[plateRow.foot.width, plateRow.foot.thickness, plateRow.foot.depth]} rotation={plateRow.foot.angle} color={pad} />)}
    {(["left", "right"] as const).map(side => {
      const pivot = machineLever(object, side).pivot;
      return <group key={side}><Beam from={[pivot.x, .1, .98]} to={pivot.toArray()} radius={.055} /><Lever getObject={getObject} side={side} /></group>;
    })}
  </>;
  if (object.slug === "shoulder-press-machine") return <>
    <Feet width={shoulderPress.base.width} front={shoulderPress.base.front} back={shoulderPress.base.back} />
    <Beam from={[-shoulderPress.base.width, .1, shoulderPress.base.back + .18]} to={[shoulderPress.base.width, .1, shoulderPress.base.back + .18]} color={chrome} />
    <Beam from={[-shoulderPress.base.width, .1, 0]} to={[shoulderPress.base.width, .1, 0]} color={chrome} />
    <Beam from={[0, .1, 0]} to={[0, .51, 0]} radius={.05} color={chrome} />
    <Beam from={[0, .5, -.30]} to={[0, .5, .24]} radius={.0425} color={chrome} />
    <Block at={[...shoulderPress.seat.center]} size={[...shoulderPress.seat.size]} color={pad} />
    <Block at={[...shoulderPress.back.center]} size={[...shoulderPress.back.size]} rotation={shoulderPress.back.degrees * Math.PI / 180} color={pad} />
    <Beam from={[0, .1, -.31]} to={[0, 1.76, -.37]} radius={.045} color={chrome} />
    <Beam from={[0, 1.22, -.35]} to={[0, 1.22, -.28]} radius={.035} color={chrome} />
    <Beam from={[0, .1, -.65]} to={[0, 1.2, -.32]} radius={.0375} color={chrome} />
    {(["left", "right"] as const).map(side => {
      const { pivot, axis } = shoulderPressLever(object, side);
      return <group key={side}><Beam from={[Math.sign(pivot.x) * shoulderPress.base.width, .1, -.54]} to={pivot.toArray()} radius={.045} color={chrome} /><Beam from={[0, .1, -.54]} to={[Math.sign(pivot.x) * shoulderPress.base.width, .1, -.54]} color={chrome} /><Beam from={pivot.clone().addScaledVector(axis, -.06).toArray()} to={pivot.clone().addScaledVector(axis, .06).toArray()} radius={.075} color={dark} /><Lever getObject={getObject} side={side} /></group>;
    })}
  </>;
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
    <group userData={{ workshopSupportExcluded: true }}><Beam from={[0, 2.4, 1.6]} to={[0, rowPulleyPoint.y, rowPulleyPoint.z]} radius={0.008} color={dark} /></group>
    {!object.cableAttachment && <MovingBeam radius={0.008} color={dark} getEndpoints={() => ({ from: [0, rowPulleyPoint.y, rowPulleyPoint.z], to: [0, getPoint().y, getPoint().z + 0.08] })} />}
    {[1.6, rowPulleyPoint.z].map(z => <mesh key={z} position={[0, z === 1.6 ? 2.4 : rowPulleyPoint.y, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.075, 0.075, 0.04, 32]} /><meshStandardMaterial color={dark} /></mesh>)}
    {!object.cableAttachment && <MovingGroup getPosition={getPoint}>
      <Beam from={[-0.15, -0.14, 0]} to={[0, 0, 0.08]} radius={0.017} color={chrome} />
      <Beam from={[0.15, -0.14, 0]} to={[0, 0, 0.08]} radius={0.017} color={chrome} />
      {[-0.15, 0.15].map(x => <Beam key={x} from={[x, -0.14, 0]} to={[x, 0.14, 0]} radius={0.023} color={dark} />)}
    </MovingGroup>}
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
    <Block at={[...legPress.back.center]} size={[...legPress.back.size]} color={pad} rotation={legPress.back.degrees * Math.PI / 180} />
    <Beam from={[0, legPress.back.center[1] - .46, legPress.back.center[2] + .46]} to={[0, legPress.back.center[1] + .35, legPress.back.center[2] - .35]} radius={.045} />
    <Beam from={[0, .1, -1.07]} to={[0, legPress.back.center[1] - .07, legPress.back.center[2] - .07]} radius={.045} />
    <Beam from={[0, legPress.back.center[1] - .07, legPress.back.center[2] - .07]} to={[0, legPress.back.center[1] - .07, legPress.back.center[2] + .07]} radius={.045} />
    {[-0.36, 0.36].map(x => <Beam key={x} from={[x, 0.74, -0.53]} to={[x, 0.74, -0.17]} radius={0.022} color={chrome} />)}
    <MovingGroup getPosition={getPoint}>
      <Block at={[...legPress.plateCenter]} size={[...legPress.plateSize]} rotation={legPress.plateDegrees * Math.PI / 180} />
      <Beam from={[-1.05, 0.08, 0.08]} to={[1.05, 0.08, 0.08]} radius={0.026} color={chrome} />
      {[-0.83, -0.91, 0.83, 0.91].map(x => <Plate key={x} x={x} y={0.08} z={0.08} />)}
      {[-0.64, 0.64].map(x => <Beam key={x} from={[x, -0.1, -0.1]} to={[x, 0.1, 0.1]} radius={0.06} />)}
    </MovingGroup>
  </>;
}
