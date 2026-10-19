"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { attachmentAssets, createEquipmentAssetInstance, disposeEquipmentAsset, equipmentAssets, updateEquipmentAsset, type EquipmentAssetDefinition, type EquipmentAssetInstance } from "@/lib/motion/equipment-assets";
import type { CableAttachment, StudioObject } from "@/lib/motion/workshop";

// Let the existing scene material owner reapply comparison/selection styling
// when an asynchronous asset replaces its procedural fallback.
export const EquipmentAssetReadyContext = createContext<() => void>(() => undefined);
export const EquipmentReadinessContext = createContext<(key: string, settled: boolean) => void>(() => undefined);

export function EquipmentAsset({ object, currentObject, fallback }: {
  object: StudioObject; currentObject?: React.RefObject<StudioObject>; fallback: ReactNode;
}) {
  const definition = equipmentAssets[object.slug];
  return <LoadedAsset key={definition.url} definition={definition} assetKey={object.id} object={object} currentObject={currentObject} fallback={fallback} />;
}

export function CableAttachmentAsset({ kind, objectId, side = "primary", fallback }: {
  kind: CableAttachment; objectId: string; side?: "primary" | "left" | "right"; fallback: ReactNode;
}) {
  const definition = attachmentAssets[kind];
  return <group scale={kind === "rope" && side === "right" ? [-1, 1, 1] : 1}>
    <LoadedAsset key={definition.url} definition={definition} assetKey={`attachment:${objectId}:${side}`} fallback={fallback} />
  </group>;
}

function LoadedAsset({ definition, assetKey, object, currentObject, fallback }: {
  definition: EquipmentAssetDefinition; assetKey: string; object?: StudioObject; currentObject?: React.RefObject<StudioObject>; fallback: ReactNode;
}) {
  const [instance, setInstance] = useState<EquipmentAssetInstance | null>(null);
  const authoredObject = useRef(object);
  useLayoutEffect(() => { authoredObject.current = object; }, [object]);
  const invalidate = useThree(state => state.invalidate);
  const onReady = useContext(EquipmentAssetReadyContext);
  const reportReadiness = useContext(EquipmentReadinessContext);
  useEffect(() => {
    reportReadiness(assetKey, false);
    let cancelled = false;
    let owned: EquipmentAssetInstance | undefined;
    new GLTFLoader().loadAsync(definition.url).then(gltf => {
      try {
        if (cancelled) return;
        owned = createEquipmentAssetInstance(gltf.scene, definition);
        const live = currentObject?.current ?? authoredObject.current;
        if (live) updateEquipmentAsset(owned, live);
        setInstance(owned);
      } finally { disposeEquipmentAsset(gltf.scene); }
    }).catch(() => {
      // Loading/validation failure leaves the complete teaching model usable.
      if (!cancelled) { reportReadiness(assetKey, true); invalidate(); }
    });
    return () => { cancelled = true; if (owned) disposeEquipmentAsset(owned.root); };
    // Each object owns one load, independent meshes/materials and its cleanup.
    // Current authored transforms are consumed through the live ref below.
  }, [definition, assetKey, currentObject, invalidate, reportReadiness]);
  useEffect(() => {
    if (instance) { onReady(); reportReadiness(assetKey, true); invalidate(); }
  }, [instance, onReady, invalidate, assetKey, reportReadiness]);
  // The shared solve runs at -2, equipment sampling at -1, consumers at 0.
  useFrame(() => {
    const live = currentObject?.current ?? authoredObject.current;
    if (instance && live) updateEquipmentAsset(instance, live);
  });
  return instance ? <primitive object={instance.root} dispose={null} /> : fallback;
}
