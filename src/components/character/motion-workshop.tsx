"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveWorkshopScene } from "@/app/my-exercises/[id]/workshop/actions";
import { jointLimits, jointSlugs, sampleWorkshopPose, type JointSlug, type WorkshopScene } from "@/lib/motion/workshop";
import { MotionCanvas } from "./motion-canvas";

const jointNames: Record<JointSlug, string> = {
  torso: "Torso", "left-shoulder": "Left shoulder", "right-shoulder": "Right shoulder",
  "left-elbow": "Left elbow", "right-elbow": "Right elbow", "left-hip": "Left hip",
  "right-hip": "Right hip", "left-knee": "Left knee", "right-knee": "Right knee",
};
const label = (milliseconds: number) => `${(milliseconds / 1000).toFixed(2)}s`;

export function MotionWorkshop({ privateId, initialScene }: { privateId: string; initialScene: WorkshopScene }) {
  const [scene, setScene] = useState(initialScene);
  const [selected, setSelected] = useState(0);
  const [timeMs, setTimeMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const startedAt = useRef(0);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    startedAt.current = performance.now() - timeMs;
    const tick = (now: number) => {
      const next = (now - startedAt.current) % scene.durationMs;
      setTimeMs(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // Playback starts from the selected position; subsequent frames use the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, scene.durationMs]);

  const update = (next: WorkshopScene) => { setScene(next); setStatus("Unsaved changes"); };
  const selectFrame = (index: number) => {
    setPlaying(false);
    setSelected(index);
    setTimeMs(scene.keyframes[index].timeMs);
  };
  const setAngle = (slug: JointSlug, axis: "x" | "y" | "z", value: number) => {
    const keyframes = scene.keyframes.map((frame, index) => {
      if (index !== selected) return frame;
      return { ...frame, poses: { ...frame.poses, [slug]: { x: 0, y: 0, z: 0, ...frame.poses[slug], [axis]: value } } };
    });
    update({ ...scene, keyframes });
  };
  const addFrame = () => {
    if (scene.keyframes.length >= 24) return;
    const next = scene.keyframes.findIndex((frame) => frame.timeMs > timeMs);
    const insertAt = next <= 0 ? 1 : next;
    const before = scene.keyframes[insertAt - 1].timeMs;
    const after = scene.keyframes[insertAt].timeMs;
    if (after - before < 2) return;
    const at = Math.max(before + 1, Math.min(after - 1, Math.round(timeMs)));
    const poses = sampleWorkshopPose(scene.keyframes, at);
    update({ ...scene, keyframes: [
      ...scene.keyframes.slice(0, insertAt), { timeMs: at, poses }, ...scene.keyframes.slice(insertAt),
    ] });
    setSelected(insertAt);
    setTimeMs(at);
    setPlaying(false);
  };
  const removeFrame = () => {
    if (selected === 0 || selected === scene.keyframes.length - 1) return;
    const keyframes = scene.keyframes.filter((_, index) => index !== selected);
    update({ ...scene, keyframes });
    setSelected(selected - 1);
    setTimeMs(keyframes[selected - 1].timeMs);
  };
  const changeDuration = (durationMs: number) => {
    const ratio = durationMs / scene.durationMs;
    const keyframes = scene.keyframes.map((frame, index) => ({
      ...frame,
      timeMs: index === scene.keyframes.length - 1 ? durationMs : Math.round(frame.timeMs * ratio),
    }));
    update({ ...scene, durationMs, keyframes });
    setTimeMs(keyframes[selected].timeMs);
  };
  const save = () => {
    setPlaying(false);
    startTransition(async () => {
      const result = await saveWorkshopScene(privateId, scene);
      setStatus(result.error ?? "Scene saved privately.");
    });
  };
  const current = scene.keyframes[selected];

  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
    <div className="space-y-5">
      <div className="relative">
        <MotionCanvas scene={scene} timeMs={timeMs} className="h-[440px] sm:h-[560px]" />
        <span className="pointer-events-none absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[#315f4c]">Original anatomical rig · v1</span>
        <span className="pointer-events-none absolute bottom-4 left-4 rounded-xl bg-white/90 px-3 py-2 text-xs text-[#53695b]">Drag to orbit · scroll to zoom</span>
      </div>
      <section className="rounded-2xl border border-[#dce5de] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Timeline</h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPlaying(!playing)} className="rounded-lg bg-[#174a3e] px-4 py-2 text-sm font-semibold text-white">{playing ? "Pause" : "Play"}</button>
            <button type="button" onClick={addFrame} disabled={scene.keyframes.length >= 24} className="rounded-lg border border-[#bad0c1] px-3 py-2 text-sm font-semibold disabled:opacity-50">Add keyframe</button>
          </div>
        </div>
        <input aria-label="Scrub timeline" type="range" min={0} max={scene.durationMs} step={1} value={Math.round(timeMs)}
          onChange={(event) => { setPlaying(false); setTimeMs(Number(event.target.value)); }}
          className="mt-5 w-full accent-[#26775b]" />
        <div className="mt-3 flex flex-wrap gap-2">
          {scene.keyframes.map((frame, index) => <button key={`${frame.timeMs}-${index}`} type="button" onClick={() => selectFrame(index)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold ${selected === index ? "bg-[#d8eee0] text-[#1d644b]" : "bg-[#f1f4ef] text-[#64786b]"}`}>
            {index === 0 ? "Start" : index === scene.keyframes.length - 1 ? "End" : `Keyframe ${index + 1}`} · {label(frame.timeMs)}
          </button>)}
        </div>
        <p className="mt-3 text-xs text-[#748578]">Select a keyframe to edit its pose. Add one at the current playhead position.</p>
      </section>
    </div>

    <div className="space-y-5">
      <section className="rounded-2xl border border-[#dce5de] bg-white p-5">
        <h2 className="text-lg font-semibold">Scene setup</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <label className="text-sm font-semibold">Duration
            <select value={scene.durationMs} onChange={(event) => changeDuration(Number(event.target.value))} className="mt-2 w-full rounded-lg border border-[#cfdbd2] bg-white p-2.5">
              {[1600, 2400, 3200, 4800, 6400, 8000].map((value) => <option key={value} value={value}>{label(value)}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">Camera
            <select value={scene.cameraAngle} onChange={(event) => update({ ...scene, cameraAngle: event.target.value as WorkshopScene["cameraAngle"] })} className="mt-2 w-full rounded-lg border border-[#cfdbd2] bg-white p-2.5">
              <option value="three_quarter">Three quarter</option><option value="front">Front</option><option value="side">Side</option>
            </select>
          </label>
          <label className="text-sm font-semibold">Equipment asset
            <select value={scene.equipment?.slug ?? ""} onChange={(event) => update({ ...scene, equipment: event.target.value ? {
              slug: event.target.value as NonNullable<WorkshopScene["equipment"]>["slug"], x: 0, y: 0, z: 0, scale: 1,
            } : null })} className="mt-2 w-full rounded-lg border border-[#cfdbd2] bg-white p-2.5">
              <option value="">None</option><option value="dumbbell-pair">Dumbbell pair</option><option value="barbell">Barbell</option><option value="single-cable">Single cable</option>
            </select>
          </label>
        </div>
        {scene.equipment && scene.equipment.slug !== "dumbbell-pair" && <div className="mt-4 grid grid-cols-3 gap-3">
          {(["x", "y", "z"] as const).map((axis) => <label key={axis} className="text-xs font-semibold uppercase">Asset {axis}
            <input type="number" min={-3} max={3} step={0.1} value={scene.equipment?.[axis] ?? 0}
              onChange={(event) => update({ ...scene, equipment: { ...scene.equipment!, [axis]: Number(event.target.value) } })}
              className="mt-1 w-full rounded-lg border border-[#cfdbd2] p-2" />
          </label>)}
        </div>}
      </section>
      <section className="rounded-2xl border border-[#dce5de] bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-lg font-semibold">Pose at {label(current.timeMs)}</h2><p className="mt-1 text-xs text-[#748578]">Angles in degrees</p></div>
          <button type="button" onClick={removeFrame} disabled={selected === 0 || selected === scene.keyframes.length - 1}
            className="text-xs font-semibold text-red-700 disabled:opacity-40">Remove keyframe</button>
        </div>
        <div className="mt-4 max-h-[570px] space-y-3 overflow-y-auto pr-1">
          {jointSlugs.map((slug) => <fieldset key={slug} className="rounded-xl bg-[#f7faf6] p-3">
            <legend className="mb-2 text-sm font-semibold">{jointNames[slug]}</legend>
            <div className="grid grid-cols-3 gap-2">
              {(["x", "y", "z"] as const).map((axis) => <label key={axis} className="text-xs font-semibold uppercase text-[#64786b]">{axis}
                <input type="number" value={current.poses[slug]?.[axis] ?? 0} min={jointLimits[slug][axis][0]} max={jointLimits[slug][axis][1]} step={1}
                  onChange={(event) => setAngle(slug, axis, Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-[#cfdbd2] bg-white p-2 text-sm text-[#172a27]" />
              </label>)}
            </div>
          </fieldset>)}
        </div>
      </section>
      <div className="flex items-center gap-4">
        <button type="button" onClick={save} disabled={pending} className="rounded-xl bg-[#174a3e] px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Saving…" : "Save scene"}</button>
        {status && <p role="status" className="text-sm text-[#476c54]">{status}</p>}
      </div>
    </div>
  </div>;
}
