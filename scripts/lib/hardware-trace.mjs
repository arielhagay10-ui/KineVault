/** Complete-event wall times overlap; sampled CPU leaf time is a separate estimate. */
export function summarizeHardwareTrace(trace) {
  if (!Array.isArray(trace.traceEvents)) throw new Error("Chrome traceEvents array required");
  const threads = new Map(), groups = new Map(), profiles = new Map(), frames = new Map();
  for (const event of trace.traceEvents) {
    if (event.ph === "M" && event.name === "thread_name") threads.set(`${event.pid}:${event.tid}`, event.args?.name);
  }
  for (const event of trace.traceEvents) {
    if (event.ph === "X" && Number.isFinite(event.dur) && event.dur >= 0) {
      const thread = threads.get(`${event.pid}:${event.tid}`) ?? `${event.pid}:${event.tid}`;
      const key = `${thread}:${event.name}`;
      const group = groups.get(key) ?? { name: event.name, thread, durations: [] };
      group.durations.push(event.dur / 1000); groups.set(key, group);
    }
    if (event.name !== "ProfileChunk") continue;
    const data = event.args?.data;
    if (!data?.cpuProfile) continue;
    const key = `${event.pid}:${event.id}`;
    const nodes = profiles.get(key) ?? new Map();
    for (const node of data.cpuProfile.nodes ?? []) nodes.set(node.id, node.callFrame);
    profiles.set(key, nodes);
    for (const [index, sample] of (data.cpuProfile.samples ?? []).entries()) {
      const frame = nodes.get(sample), delta = data.timeDeltas?.[index];
      if (!frame || !Number.isFinite(delta) || delta < 0) continue;
      const frameKey = JSON.stringify([event.pid, frame.functionName, frame.url, frame.lineNumber, frame.columnNumber]);
      const entry = frames.get(frameKey) ?? { ...frame, pid: event.pid, sampledMs: 0, samples: 0 };
      entry.sampledMs += delta / 1000; entry.samples++; frames.set(frameKey, entry);
    }
  }
  const events = [...groups.values()].map(({ name, thread, durations }) => {
    durations.sort((a, b) => a - b);
    return { name, thread, count: durations.length, totalMs: durations.reduce((sum, value) => sum + value, 0),
      p95Ms: durations[Math.ceil(durations.length * .95) - 1], maximumMs: durations.at(-1) };
  }).sort((a, b) => b.totalMs - a.totalMs);
  return { note: "Event durations overlap and include scheduling/driver work. GPU thread wall time is not GPU execution time. CPU leaf sampling is diagnostic and has tracing overhead.",
    events, cpuSelfTime: [...frames.values()].sort((a, b) => b.sampledMs - a.sampledMs) };
}
