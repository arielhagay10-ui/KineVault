"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";

export type MotionRenderMetrics = { calls: number; geometries: number; textures: number; poseSolves: number };
/** Opt-in profiling, sampled after rendering without adding React commits. */
export function MotionMetrics({ wrapper, solvesRef, onMetrics }: { wrapper: RefObject<HTMLDivElement | null>; solvesRef: RefObject<number>; onMetrics?: (sample: MotionRenderMetrics) => void }) {
  const gl = useThree(state => state.gl);
  const enabled = useRef(false), pending = useRef(0), last = useRef(-Infinity);
  useEffect(() => {
    enabled.current = !!onMetrics || new URLSearchParams(window.location.search).get("metrics") === "1";
    return () => cancelAnimationFrame(pending.current);
  }, [onMetrics]);
  useFrame(() => {
    if (!enabled.current || pending.current || performance.now() - last.current < 250) return;
    pending.current = requestAnimationFrame(() => {
      pending.current = 0; last.current = performance.now();
      const sample = { calls: gl.info.render.calls, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures, poseSolves: solvesRef.current };
      if (wrapper.current) {
        wrapper.current.dataset.renderCalls = String(sample.calls);
        wrapper.current.dataset.renderGeometries = String(sample.geometries);
        wrapper.current.dataset.renderTextures = String(sample.textures);
        wrapper.current.dataset.poseSolves = String(sample.poseSolves);
      }
      onMetrics?.(sample);
    });
  });
  return null;
}
