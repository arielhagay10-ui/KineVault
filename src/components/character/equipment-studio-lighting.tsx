"use client";

import { useThree } from "@react-three/fiber";
import { useContext, useEffect, useMemo } from "react";
import { DataTexture, PMREMGenerator, RGBAFormat, type WebGLRenderTarget } from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import type { StudioObject } from "@/lib/motion/workshop";
import { EquipmentReadinessContext } from "./equipment-asset";

const footprints: Partial<Record<StudioObject["slug"], readonly [number, number]>> = {
  "lat-pulldown-machine": [1.5, 1.9], "smith-machine": [2.1, 1.8],
  "leg-press": [1.8, 2.7], "cable-row-machine": [1.5, 2.4], "pec-deck": [1.7, 1.9],
  "cable-machine": [1.4, 1.5], bench: [1.1, 2], "squat-rack": [1.7, 1.8],
  "t-bar-row-machine": [1.6, 2.4],
};

/** Shared equipment reflections; anatomy-only previews make no HDR request. */
export function EquipmentStudioLighting({ objects }: { objects: StudioObject[] }) {
  const { gl, scene, invalidate } = useThree();
  const reportReadiness = useContext(EquipmentReadinessContext);
  const contactTexture = useMemo(() => {
    const size = 64, data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const distance = Math.hypot((x + .5) / size * 2 - 1, (y + .5) / size * 2 - 1);
      const offset = (y * size + x) * 4;
      data[offset] = data[offset + 1] = data[offset + 2] = 255;
      data[offset + 3] = Math.round(Math.max(0, 1 - distance) ** 2 * 110);
    }
    const texture = new DataTexture(data, size, size, RGBAFormat); texture.needsUpdate = true;
    return texture;
  }, []);
  useEffect(() => () => contactTexture.dispose(), [contactTexture]);
  useEffect(() => {
    reportReadiness("studio-lighting", false);
    let cancelled = false, target: WebGLRenderTarget | undefined;
    const previous = scene.environment, intensity = scene.environmentIntensity;
    const generator = new PMREMGenerator(gl);
    generator.compileEquirectangularShader();
    new HDRLoader().loadAsync("/models/equipment/lighting/studio-small-09-1k.hdr").then(texture => {
      try {
        if (cancelled) return;
        target = generator.fromEquirectangular(texture);
        scene.environment = target.texture; scene.environmentIntensity = .45; invalidate();
      } finally {
        texture.dispose(); generator.dispose();
        if (!cancelled) reportReadiness("studio-lighting", true);
      }
    }).catch(() => { generator.dispose(); if (!cancelled) reportReadiness("studio-lighting", true); });
    return () => {
      cancelled = true;
      if (target && scene.environment === target.texture) { scene.environment = previous; scene.environmentIntensity = intensity; }
      target?.dispose(); generator.dispose();
    };
  }, [gl, scene, invalidate, reportReadiness]);
  return objects.flatMap(object => {
    const footprint = footprints[object.slug];
    if (!footprint) return [];
    return <group key={object.id}
    position={[object.x, object.y + .002, object.z]} rotation={[0, object.rotationY * Math.PI / 180, 0]} scale={object.scale}>
    {/* Soft floor contact stays beneath stationary feet, never follows the bar. */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[...footprint, 1]} renderOrder={-1} raycast={() => undefined}>
      <planeGeometry args={[1, 1]} /><meshBasicMaterial color="#23383d" map={contactTexture} transparent opacity={.5} depthWrite={false} />
    </mesh>
  </group>;
  });
}
