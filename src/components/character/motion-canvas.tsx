"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { ReactNode } from "react";
import type { RigPose, WorkshopScene } from "@/lib/motion/workshop";
import { sampleWorkshopPose } from "@/lib/motion/workshop";

const body = "#b9c9c3";
const joint = "#3d5c57";
const muscle = "#54d6ac";
const metal = "#778b8b";
const rad = Math.PI / 180;
const rotation = (pose: RigPose, slug: keyof RigPose): [number, number, number] => {
  const angle = pose[slug];
  return angle ? [angle.x * rad, angle.y * rad, angle.z * rad] : [0, 0, 0];
};

function Segment({ children, position, size, color = body }: {
  children?: ReactNode; position: [number, number, number]; size: [number, number, number]; color?: string;
}) {
  return <mesh position={position} castShadow><capsuleGeometry args={[size[0], size[1], 6, 12]} /><meshStandardMaterial color={color} roughness={0.72} />{children}</mesh>;
}

function Dumbbell() {
  return <group position={[0, -0.58, 0]} rotation={[0, 0, Math.PI / 2]}>
    <mesh castShadow><cylinderGeometry args={[0.035, 0.035, 0.4, 12]} /><meshStandardMaterial color={metal} metalness={0.6} roughness={0.3} /></mesh>
    {[-0.15, 0.15].map((offset) => <mesh key={offset} position={[0, offset, 0]} castShadow>
      <cylinderGeometry args={[0.1, 0.1, 0.08, 14]} /><meshStandardMaterial color="#263b3b" metalness={0.3} roughness={0.5} />
    </mesh>)}
  </group>;
}

function Arm({ side, pose, dumbbell }: { side: -1 | 1; pose: RigPose; dumbbell: boolean }) {
  const prefix = side < 0 ? "left" : "right";
  return <group position={[side * 0.45, 1.77, 0]} rotation={rotation(pose, `${prefix}-shoulder`)}>
    <mesh castShadow><sphereGeometry args={[0.16, 20, 16]} /><meshStandardMaterial color={muscle} /></mesh>
    <Segment position={[0, -0.32, 0]} size={[0.105, 0.38, 0]} />
    <group position={[0, -0.65, 0]} rotation={rotation(pose, `${prefix}-elbow`)}>
      <mesh castShadow><sphereGeometry args={[0.095, 16, 12]} /><meshStandardMaterial color={joint} /></mesh>
      <Segment position={[0, -0.28, 0]} size={[0.085, 0.32, 0]} />
      <mesh position={[0, -0.53, 0]} castShadow><sphereGeometry args={[0.085, 16, 12]} /><meshStandardMaterial color={joint} /></mesh>
      {dumbbell && <Dumbbell />}
    </group>
  </group>;
}

function Leg({ side, pose }: { side: -1 | 1; pose: RigPose }) {
  const prefix = side < 0 ? "left" : "right";
  return <group position={[side * 0.2, 0.96, 0]} rotation={rotation(pose, `${prefix}-hip`)}>
    <Segment position={[0, -0.3, 0]} size={[0.14, 0.36, 0]} />
    <group position={[0, -0.7, 0]} rotation={rotation(pose, `${prefix}-knee`)}>
      <mesh castShadow><sphereGeometry args={[0.11, 16, 12]} /><meshStandardMaterial color={joint} /></mesh>
      <Segment position={[0, -0.28, 0]} size={[0.1, 0.32, 0]} />
      <mesh position={[0, -0.58, 0.1]} castShadow><boxGeometry args={[0.2, 0.1, 0.36]} /><meshStandardMaterial color={joint} /></mesh>
    </group>
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

function Figure({ pose, scene }: { pose: RigPose; scene: WorkshopScene }) {
  return <>
    <group position={[0, 0.36, 0]}>
      <group position={[0, 0.98, 0]} rotation={rotation(pose, "torso")}>
        <Segment position={[0, 0.54, 0]} size={[0.32, 0.58, 0]} />
        <mesh castShadow><sphereGeometry args={[0.28, 20, 16]} /><meshStandardMaterial color={joint} /></mesh>
        <mesh position={[0, 1.24, 0]} castShadow><sphereGeometry args={[0.23, 24, 20]} /><meshStandardMaterial color={body} /></mesh>
        <group position={[0, -0.98, 0]}>
          <Arm side={-1} pose={pose} dumbbell={scene.equipment?.slug === "dumbbell-pair"} />
          <Arm side={1} pose={pose} dumbbell={scene.equipment?.slug === "dumbbell-pair"} />
        </group>
      </group>
      <Leg side={-1} pose={pose} />
      <Leg side={1} pose={pose} />
    </group>
    <Equipment scene={scene} />
  </>;
}

export function MotionCanvas({ scene, timeMs, className = "h-[430px]" }: {
  scene: WorkshopScene; timeMs: number; className?: string;
}) {
  const camera = scene.cameraAngle === "front" ? [0, 2.4, 5] as const
    : scene.cameraAngle === "side" ? [5, 2.4, 0] as const : [3.4, 2.8, 5.5] as const;
  const pose = sampleWorkshopPose(scene.keyframes, timeMs);
  return <div className={`overflow-hidden rounded-2xl bg-[#e9efea] ${className}`}>
    <Canvas key={scene.cameraAngle} camera={{ position: [...camera], fov: 33 }} shadows dpr={[1, 1.75]}>
      <color attach="background" args={["#e9efea"]} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[3, 6, 4]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} />
      <mesh position={[0, -1.03, 0]} receiveShadow><cylinderGeometry args={[2.1, 2.1, 0.08, 64]} /><meshStandardMaterial color="#d6e3d9" roughness={1} /></mesh>
      <Figure pose={pose} scene={scene} />
      <OrbitControls target={[0, 1.2, 0]} enablePan={false} minDistance={4} maxDistance={8} maxPolarAngle={Math.PI / 2.05} />
    </Canvas>
  </div>;
}
