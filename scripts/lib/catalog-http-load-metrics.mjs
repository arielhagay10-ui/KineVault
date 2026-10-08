import { isDeepStrictEqual } from "node:util";
import { parseLoadOptions } from "./catalog-load-metrics.mjs";

export function parseHttpLoadOptions(args) {
  if (args.includes("--load")) throw new Error("Choose --http or --load, not both");
  const poolArgs = args.filter(arg => arg.startsWith("--http-pool="));
  const pool = poolArgs.length ? Number(poolArgs[0].slice("--http-pool=".length)) : 4;
  if (poolArgs.length > 1 || !Number.isInteger(pool) || pool < 1 || pool > 32) {
    throw new Error("http-pool must be one integer in 1..32");
  }
  return { ...parseLoadOptions(args.filter(arg => arg !== "--http" && !arg.startsWith("--http-pool="))), pool };
}

export function validateHttpRows(rows, expected) {
  if (!Array.isArray(rows) || !Array.isArray(expected) || rows.length !== expected.length) return false;
  const ids = rows.map(row => row?.exercise_id ?? row?.id);
  return ids.every(id => typeof id === "string") && new Set(ids).size === ids.length && isDeepStrictEqual(rows, expected);
}

export function summarizeHttpSamples(samples, expected, thresholds) {
  if (!Number.isInteger(expected) || expected < 1 || samples.length > expected || samples.some(sample =>
    !Number.isFinite(sample.elapsedMs) || sample.elapsedMs < 0 || typeof sample.ok !== "boolean")) {
    throw new Error("Invalid HTTP load samples");
  }
  const latencies = samples.filter(sample => sample.ok).map(sample => sample.elapsedMs).sort((a, b) => a - b);
  const percentile = fraction => latencies.length ? latencies[Math.ceil(fraction * latencies.length) - 1] : null;
  const metrics = { expected, logged: samples.length, completed: latencies.length,
    errors: expected - latencies.length, errorRate: (expected - latencies.length) / expected,
    p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99), maxMs: latencies.at(-1) ?? null };
  const violations = Object.keys(thresholds).filter(key => metrics[key] === null || metrics[key] > thresholds[key]);
  return { ...metrics, violations, passed: violations.length === 0 };
}

// A worker waits for the complete body before issuing its next request. No retries.
export async function runHttpCase({ url, body, expected, clients, requests, timeoutMs, deadline, headers = {}, method = "POST" }) {
  if (!Number.isInteger(clients) || clients < 1 || clients > 32 || !Number.isInteger(requests) || requests < 1 || requests > 10000) {
    throw new Error("Invalid HTTP concurrency/request count");
  }
  const samples = [];
  await Promise.all(Array.from({ length: clients }, async (_, client) => {
    for (let request = 0; request < requests; request++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const started = performance.now();
      let status = null;
      let ok = false;
      let failure;
      try {
        const response = await fetch(url, { method, redirect: "error", headers: { "content-type": "application/json", ...headers },
          ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
          signal: AbortSignal.timeout(Math.max(1, Math.min(timeoutMs, remaining))) });
        status = response.status;
        const rows = await response.json();
        ok = response.ok && validateHttpRows(rows, expected);
        if (!ok) failure = response.ok ? "correctness" : "http";
      } catch {
        // Error messages and response bodies can include credentials or server detail.
        failure = status === null ? "transport_or_timeout" : "invalid_json";
      }
      samples.push({ client, request, elapsedMs: performance.now() - started, status, ok, ...(failure ? { failure } : {}) });
    }
  }));
  return samples;
}
