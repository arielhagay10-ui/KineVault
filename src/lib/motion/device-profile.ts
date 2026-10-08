import { z } from "zod";

export const deviceCaptureSchema = z.object({
  device: z.string().trim().min(1).max(120),
  scenario: z.enum(["playback", "comparison", "camera", "selection"]),
  workload: z.string().trim().min(1).max(120),
  physical: z.boolean(),
  build: z.string().trim().min(1).max(120),
  durationMs: z.number().int().min(12_000).max(60_000).default(15_000),
});

export function summarizeDeviceFrames(timestamps: number[]) {
  if (timestamps.length < 2 || timestamps.some((value, index) => !Number.isFinite(value)
    || (index > 0 && value <= timestamps[index - 1]))) throw new Error("Invalid rendered-frame capture");
  const intervals = timestamps.slice(1).map((value, index) => value - timestamps[index]).sort((a, b) => a - b);
  const percentile = (fraction: number) => intervals[Math.ceil(intervals.length * fraction) - 1];
  return { frames: intervals.length, elapsedMs: timestamps.at(-1)! - timestamps[0],
    medianMs: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99), maximumMs: intervals.at(-1)! };
}

const measuredRunSchema = z.object({
  device: z.string().trim().min(1), scenario: deviceCaptureSchema.shape.scenario, workload: deviceCaptureSchema.shape.workload, physical: z.literal(true),
  renderer: z.string().trim().min(1), p95Ms: z.number().positive().finite(),
});

/** These are proposals requiring review, never automatic runtime quality changes. */
export function proposeDeviceBudget(input: unknown[]) {
  const runs = z.array(measuredRunSchema).min(3).parse(input);
  const first = runs[0];
  if (runs.some(run => run.device !== first.device || run.scenario !== first.scenario || run.workload !== first.workload || run.renderer !== first.renderer)) {
    throw new Error("Budget runs must use the same physical device, GPU and scenario");
  }
  if (/swiftshader|llvmpipe|software|unknown|webkit webgl|^webgl/i.test(first.renderer)) {
    throw new Error("A reported hardware GPU is required");
  }
  const observedP95 = Math.max(...runs.map(run => run.p95Ms));
  return { device: first.device, scenario: first.scenario, workload: first.workload, renderer: first.renderer, runs: runs.length,
    observedP95Ms: observedP95, p95Ms: Math.ceil(observedP95 * 1.2), needsLodEvaluation: observedP95 > 1000 / 30, status: "proposed" as const };
}

const completedCaptureSchema = measuredRunSchema.omit({ p95Ms: true }).extend({
  valid: z.literal(true), captureId: z.uuid(), measuredAt: z.iso.datetime(), build: z.string().trim().min(1),
  userAgent: z.string().trim().min(1),
  viewport: z.object({ width: z.number().int().positive(), height: z.number().int().positive(), pixelRatio: z.number().positive().finite() }),
  canvas: z.object({ width: z.number().int().positive(), height: z.number().int().positive(), pixelRatio: z.number().positive().finite() }),
  frames: z.object({ frames: z.number().int().min(120), elapsedMs: z.number().min(10_000).finite(), p95Ms: z.number().positive().finite() }),
});

export function calibrateDeviceCaptures(input: unknown[]) {
  const captures = z.array(completedCaptureSchema).min(3).parse(input);
  if (new Set(captures.map(capture => capture.captureId)).size !== captures.length
    || new Set(captures.map(capture => capture.measuredAt)).size !== captures.length) {
    throw new Error("Three distinct captures are required");
  }
  const first = captures[0];
  if (captures.some(capture => capture.build !== first.build || capture.userAgent !== first.userAgent
    || capture.viewport.width !== first.viewport.width || capture.viewport.height !== first.viewport.height
    || capture.viewport.pixelRatio !== first.viewport.pixelRatio
    || capture.canvas.width !== first.canvas.width || capture.canvas.height !== first.canvas.height
    || capture.canvas.pixelRatio !== first.canvas.pixelRatio)) {
    throw new Error("Use the same build, browser and render dimensions for calibration");
  }
  return { ...proposeDeviceBudget(captures.map(capture => ({ ...capture, p95Ms: capture.frames.p95Ms }))),
    build: first.build, userAgent: first.userAgent, viewport: first.viewport, canvas: first.canvas };
}

const budgetScopeSchema = completedCaptureSchema.pick({ device: true, scenario: true, workload: true, renderer: true, userAgent: true, viewport: true, canvas: true });
const approvedBudgetSchema = budgetScopeSchema.extend({ status: z.literal("approved"), p95Ms: z.number().positive().finite() });

export function checkDeviceBudget(input: unknown[], budgetInput: unknown) {
  const measured = calibrateDeviceCaptures(input);
  const budget = approvedBudgetSchema.parse(budgetInput);
  if (JSON.stringify(budgetScopeSchema.parse(measured)) !== JSON.stringify(budgetScopeSchema.parse(budget))) {
    throw new Error("Budget hardware, browser and render dimensions must match the captures");
  }
  return { passed: measured.observedP95Ms <= budget.p95Ms, observedP95Ms: measured.observedP95Ms,
    budgetP95Ms: budget.p95Ms, build: measured.build };
}
