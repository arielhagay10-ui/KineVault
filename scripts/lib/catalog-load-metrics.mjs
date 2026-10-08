const numericOptions = {
  rows: [50000, 1000, 1000000, true],
  clients: [8, 1, 32, true],
  requests: [100, 1, 10000, true],
  warmup: [5, 0, 100, true],
  "statement-timeout-ms": [5000, 100, 60000, true],
  "timeout-seconds": [600, 10, 1800, true],
  "p50-ms": [250, 1, 60000, false],
  "p95-ms": [500, 1, 60000, false],
  "p99-ms": [1000, 1, 60000, false],
  "error-rate": [0, 0, 1, false],
};

export function parseLoadOptions(args) {
  const values = Object.fromEntries(Object.entries(numericOptions).map(([key, rule]) => [key, rule[0]]));
  const seen = new Set();
  for (const arg of args) {
    if (["--load", "--migrations"].includes(arg)) continue;
    const match = /^--([a-z0-9-]+)=(.+)$/.exec(arg);
    if (!match || !Object.hasOwn(numericOptions, match[1])) throw new Error(`Unknown load option: ${arg}`);
    const [, key, text] = match;
    if (seen.has(key)) throw new Error(`Duplicate load option: ${key}`);
    seen.add(key);
    const value = Number(text);
    const [, min, max, integer] = numericOptions[key];
    if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      throw new Error(`Invalid ${key}; expected ${integer ? "integer " : ""}${min}..${max}`);
    }
    values[key] = value;
  }
  if (values["p50-ms"] > values["p95-ms"] || values["p95-ms"] > values["p99-ms"]) {
    throw new Error("Latency thresholds must satisfy p50 <= p95 <= p99");
  }
  return {
    rows: values.rows, clients: values.clients, requests: values.requests, warmup: values.warmup,
    statementTimeoutMs: values["statement-timeout-ms"], timeoutSeconds: values["timeout-seconds"],
    thresholds: { p50Ms: values["p50-ms"], p95Ms: values["p95-ms"], p99Ms: values["p99-ms"], errorRate: values["error-rate"] },
  };
}

// pgbench raw logs contain microseconds in field 3. Failed/absent transactions
// count against the error budget and never enter the successful latency sample.
export function summarizeLoad(log, expected, thresholds, processSucceeded = true) {
  const latencies = [];
  let logged = 0;
  for (const line of log.split(/\r?\n/).filter(line => line.trim())) {
    const fields = line.trim().split(/\s+/);
    const time = fields[2];
    if (fields.length < 6 || !/^\d+$/.test(fields[0]) || !/^\d+$/.test(fields[1]) ||
        (!/^\d+$/.test(time) && !["failed", "serialization", "deadlock", "skipped"].includes(time))) {
      throw new Error(`Malformed pgbench log: ${line.slice(0, 120)}`);
    }
    logged++;
    if (/^\d+$/.test(time)) latencies.push(Number(time) / 1000);
  }
  if (logged > expected) throw new Error(`pgbench logged ${logged} requests; expected ${expected}`);
  latencies.sort((left, right) => left - right);
  const percentile = fraction => latencies.length ? latencies[Math.ceil(fraction * latencies.length) - 1] : null;
  const errors = expected - latencies.length;
  const metrics = {
    expected, logged, completed: latencies.length, errors, errorRate: errors / expected,
    p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99),
    maxMs: latencies.at(-1) ?? null,
  };
  const violations = Object.keys(thresholds).filter(key => metrics[key] === null || metrics[key] > thresholds[key]);
  if (!processSucceeded) violations.push("process");
  return { ...metrics, passed: violations.length === 0, violations };
}
