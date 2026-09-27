"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef } from "react";
import type { Group } from "three";
import { lateralRaiseMotion, sampleShoulderMotion } from "@/lib/motion/keyframes";

const body = "#b9c9c3";
const joint = "#3d5c57";
const muscle = "#54d6ac";
const metal = "#778b8b";

function Dumbbell() {
  return (
    <group position={[0, -0.57, 0]} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.42, 12]} />
        <meshStandardMaterial color={metal} metalness={0.65} roughness={0.3} />
      </mesh>
      {[-0.16, 0.16].map((offset) => (
        <mesh key={offset} position={[0, offset, 0]} castShadow>
          <cylinderGeometry args={[0.105, 0.105, 0.09, 16]} />
          <meshStandardMaterial color="#263b3b" metalness={0.35} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function Arm({ side, shoulderRef }: { side: -1 | 1; shoulderRef: React.RefObject<Group | null> }) {
  return (
    <group ref={shoulderRef} position={[side * 0.45, 1.77, 0]}>
      <mesh castShadow>
        <sphereGeometry args={[0.16, 20, 16]} />
        <meshStandardMaterial color={muscle} roughness={0.55} />
      </mesh>
      <mesh position={[0, -0.32, 0]} castShadow>
        <capsuleGeometry args={[0.105, 0.38, 6, 12]} />
        <meshStandardMaterial color={body} roughness={0.7} />
      </mesh>
      <group position={[0, -0.65, 0]} rotation={[0, 0, side * 0.08]}>
        <mesh castShadow>
          <sphereGeometry args={[0.095, 16, 12]} />
          <meshStandardMaterial color={joint} roughness={0.65} />
        </mesh>
        <mesh position={[0, -0.28, 0]} castShadow>
          <capsuleGeometry args={[0.085, 0.32, 6, 12]} />
          <meshStandardMaterial color={body} roughness={0.7} />
        </mesh>
        <mesh position={[0, -0.53, 0]} castShadow>
          <sphereGeometry args={[0.085, 16, 12]} />
          <meshStandardMaterial color={joint} />
        </mesh>
        <Dumbbell />
      </group>
    </group>
  );
}

function Leg({ side }: { side: -1 | 1 }) {
  return (
    <group position={[side * 0.2, 0.96, 0]}>
      <mesh position={[0, -0.3, 0]} castShadow>
        <capsuleGeometry args={[0.14, 0.36, 6, 12]} />
        <meshStandardMaterial color={body} roughness={0.7} />
      </mesh>
      <mesh position={[0, -0.7, 0]} castShadow>
        <sphereGeometry args={[0.11, 16, 12]} />
        <meshStandardMaterial color={joint} />
      </mesh>
      <mesh position={[0, -0.98, 0]} castShadow>
        <capsuleGeometry args={[0.1, 0.32, 6, 12]} />
        <meshStandardMaterial color={body} roughness={0.7} />
      </mesh>
      <mesh position={[0, -1.28, 0.1]} castShadow>
        <boxGeometry args={[0.2, 0.1, 0.36]} />
        <meshStandardMaterial color={joint} roughness={0.7} />
      </mesh>
    </group>
  );
}

function Figure() {
  const leftShoulder = useRef<Group>(null);
  const rightShoulder = useRef<Group>(null);

  useFrame(({ clock }) => {
    const progress = (clock.elapsedTime % 3.2) / 3.2;
    const pose = sampleShoulderMotion(lateralRaiseMotion, progress);
    if (leftShoulder.current) leftShoulder.current.rotation.z = pose.leftShoulderZ;
    if (rightShoulder.current) rightShoulder.current.rotation.z = pose.rightShoulderZ;
  });

  return (
    <group position={[0, 0.36, 0]}>
      <mesh position={[0, 1.52, 0]} castShadow>
        <capsuleGeometry args={[0.32, 0.58, 8, 20]} />
        <meshStandardMaterial color={body} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.98, 0]} castShadow>
        <sphereGeometry args={[0.28, 20, 16]} />
        <meshStandardMaterial color={joint} roughness={0.7} />
      </mesh>
      <mesh position={[0, 2.22, 0]} castShadow>
        <sphereGeometry args={[0.23, 24, 20]} />
        <meshStandardMaterial color={body} roughness={0.7} />
      </mesh>
      <Arm side={-1} shoulderRef={leftShoulder} />
      <Arm side={1} shoulderRef={rightShoulder} />
      <Leg side={-1} />
      <Leg side={1} />
    </group>
  );
}

export function CharacterPreview() {
  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-3xl bg-[#e9efea] sm:h-[540px]">
      <Canvas camera={{ position: [3.4, 2.8, 5.5], fov: 33 }} shadows dpr={[1, 1.75]}>
        <color attach="background" args={["#e9efea"]} />
        <ambientLight intensity={1.5} />
        <directionalLight position={[3, 6, 4]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} />
        <mesh position={[0, -1.03, 0]} receiveShadow>
          <cylinderGeometry args={[2.1, 2.1, 0.08, 64]} />
          <meshStandardMaterial color="#d6e3d9" roughness={1} />
        </mesh>
        <Figure />
        <OrbitControls target={[0, 1.2, 0]} enablePan={false} minDistance={4} maxDistance={8} maxPolarAngle={Math.PI / 2.05} />
      </Canvas>
      <div className="pointer-events-none absolute left-5 top-5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-emerald-900 shadow-sm">
        Original motion study · lateral raise
      </div>
      <div className="pointer-events-none absolute bottom-5 left-5 rounded-xl bg-white/90 px-3 py-2 text-xs text-zinc-700 shadow-sm">
        Drag to change the camera angle
      </div>
    </div>
  );
}
