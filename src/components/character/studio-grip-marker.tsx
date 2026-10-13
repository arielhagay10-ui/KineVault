"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Mesh, Vector3 } from "three";
import { Html } from "@react-three/drei";
import { useWorkshopLanguage } from "./workshop-language";
import type { GripSide } from "@/lib/motion/grip-edit";

export function StudioGripMarker({ getPoint, side }: { getPoint: () => Vector3; side: GripSide }) {
  const mesh = useRef<Mesh>(null);
  const { t } = useWorkshopLanguage();
  useFrame(() => { mesh.current?.position.copy(getPoint()); });
  return <mesh ref={mesh} renderOrder={100} raycast={() => {}}>
    <sphereGeometry args={[.025, 16, 12]} /><meshBasicMaterial color="#ef971f" depthTest={false} transparent opacity={.85} />
    <Html center zIndexRange={[15, 10]} style={{ pointerEvents: "none" }}><span role="img" aria-label={t("{side} grip location", { side })} className="block -translate-y-7 whitespace-nowrap rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-950">{t("{side} grip", { side })}</span></Html>
  </mesh>;
}
