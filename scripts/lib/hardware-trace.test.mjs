import assert from "node:assert/strict";
import test from "node:test";
import { summarizeHardwareTrace } from "./hardware-trace.mjs";

test("trace reports complete-event wall times separately from sampled CPU self time", () => {
  const summary = summarizeHardwareTrace({ traceEvents: [
    { ph: "M", name: "thread_name", pid: 1, tid: 2, args: { name: "CrRendererMain" } },
    { ph: "X", name: "EventDispatch", pid: 1, tid: 2, dur: 120_000 },
    { ph: "X", name: "EventDispatch", pid: 1, tid: 2, dur: 10_000 },
    { ph: "X", name: "FunctionCall", pid: 1, tid: 2, dur: 8_000 },
    { name: "ProfileChunk", pid: 1, id: "profile", args: { data: {
      cpuProfile: { nodes: [{ id: 1, callFrame: { functionName: "raycast", url: "chunk.js" } }], samples: [1, 1] },
      timeDeltas: [1_000, 2_000],
    } } },
  ] });
  assert.deepEqual(summary.events.find(event => event.name === "EventDispatch"), {
    name: "EventDispatch", thread: "CrRendererMain", count: 2, totalMs: 130, p95Ms: 120, maximumMs: 120,
  });
  assert.equal(summary.cpuSelfTime[0].functionName, "raycast");
  assert.equal(summary.cpuSelfTime[0].sampledMs, 3);
});

test("CPU node IDs remain scoped to each process and profile", () => {
  const chunks = [1, 2].map(pid => ({ name: "ProfileChunk", pid, id: "shared", args: { data: {
    cpuProfile: { nodes: [{ id: 1, callFrame: { functionName: pid === 1 ? "raycast" : "submitGpuCommands", url: "chunk.js" } }], samples: [1] },
    timeDeltas: [1_000],
  } } }));
  const summary = summarizeHardwareTrace({ traceEvents: chunks });
  assert.equal(summary.cpuSelfTime.length, 2);
  assert.deepEqual(summary.cpuSelfTime.map(frame => frame.sampledMs), [1, 1]);
  assert.throws(() => summarizeHardwareTrace({}), /traceEvents/);
});
