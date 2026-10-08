"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import { deviceCaptureSchema, summarizeDeviceFrames } from "@/lib/motion/device-profile";

export type MotionRenderMetrics = { calls: number; geometries: number; textures: number; poseSolves: number };
/** Opt-in profiling, sampled after rendering without adding React commits. */
export function MotionMetrics({ wrapper, solvesRef, onMetrics }: { wrapper: RefObject<HTMLDivElement | null>; solvesRef: RefObject<number>; onMetrics?: (sample: MotionRenderMetrics) => void }) {
  const gl = useThree(state => state.gl);
  const camera = useThree(state => state.camera);
  const enabled = useRef(false), pending = useRef(0), last = useRef(-Infinity);
  const capture = useRef<{ timestamps: number[]; hidden: boolean; resized: boolean; triangles: number; calls: number;
    canvas: { width: number; height: number; pixelRatio: number } } | null>(null);
  useEffect(() => {
    enabled.current = !!onMetrics || new URLSearchParams(window.location.search).get("metrics") === "1";
    return () => cancelAnimationFrame(pending.current);
  }, [onMetrics]);
  useEffect(() => {
    const target = wrapper.current;
    if (!target || new URLSearchParams(window.location.search).get("metrics") !== "1") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const visibility = () => { if (capture.current && document.hidden) capture.current.hidden = true; };
    const start = (event: Event) => {
      const parsed = deviceCaptureSchema.safeParse((event as CustomEvent).detail);
      if (!parsed.success || capture.current) return;
      const metadata = parsed.data;
      capture.current = { timestamps: [], hidden: document.hidden, resized: false, triangles: 0, calls: 0,
        canvas: { width: gl.domElement.width, height: gl.domElement.height, pixelRatio: gl.getPixelRatio() } };
      delete target.dataset.deviceProfile;
      timer = setTimeout(() => {
        const recorded = capture.current;
        capture.current = null;
        if (!recorded) return;
        const context = gl.getContext();
        const debug = context.getExtension("WEBGL_debug_renderer_info");
        const renderer = String(context.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : context.RENDERER));
        const frames = recorded.timestamps.length > 1 ? summarizeDeviceFrames(recorded.timestamps) : null;
        const valid = !recorded.hidden && !recorded.resized && !!frames && frames.frames >= 120 && frames.elapsedMs >= 10_000;
        const result = { ...metadata, captureId: crypto.randomUUID(), measuredAt: new Date().toISOString(), renderer, userAgent: navigator.userAgent,
          viewport: { width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio },
          canvas: recorded.canvas,
          hardwareConcurrency: navigator.hardwareConcurrency, frameTiming: "rendered-frame cadence, not GPU execution time",
          frames, maximumTriangles: recorded.triangles, maximumCalls: recorded.calls,
          valid, reason: valid ? null : "Requires stable render dimensions and foreground rendering for 10 seconds and at least 120 intervals" };
        target.dataset.deviceProfile = JSON.stringify(result);
        target.dispatchEvent(new CustomEvent("kinevault:profile-result", { detail: result }));
        const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }));
        const link = document.createElement("a");
        link.href = blobUrl; link.download = `kinevault-device-${Date.now()}.json`; link.click();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      }, metadata.durationMs);
    };
    target.addEventListener("kinevault:profile", start);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearTimeout(timer); capture.current = null;
      target.removeEventListener("kinevault:profile", start);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [gl, wrapper]);
  useFrame(() => {
    if (capture.current) {
      const canvas = capture.current.canvas;
      if (gl.domElement.width !== canvas.width || gl.domElement.height !== canvas.height
        || gl.getPixelRatio() !== canvas.pixelRatio) capture.current.resized = true;
      capture.current.timestamps.push(performance.now());
      capture.current.triangles = Math.max(capture.current.triangles, gl.info.render.triangles);
      capture.current.calls = Math.max(capture.current.calls, gl.info.render.calls);
    }
    if (!enabled.current || pending.current || performance.now() - last.current < 250) return;
    pending.current = requestAnimationFrame(() => {
      pending.current = 0; last.current = performance.now();
      const sample = { calls: gl.info.render.calls, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures, poseSolves: solvesRef.current };
      if (wrapper.current) {
        wrapper.current.dataset.renderCalls = String(sample.calls);
        wrapper.current.dataset.renderGeometries = String(sample.geometries);
        wrapper.current.dataset.renderTextures = String(sample.textures);
        wrapper.current.dataset.poseSolves = String(sample.poseSolves);
        wrapper.current.dataset.cameraPosition = JSON.stringify(camera.position.toArray());
      }
      onMetrics?.(sample);
    });
  });
  return null;
}
