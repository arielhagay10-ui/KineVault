import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLoadOptions, summarizeLoad } from "./catalog-load-metrics.mjs";

test("load options reject unsafe or unbounded work before database creation", () => {
  assert.throws(() => parseLoadOptions(["--clients=0"]), /clients/);
  assert.throws(() => parseLoadOptions(["--rows=1000001"]), /rows/);
  assert.throws(() => parseLoadOptions(["--requests=Infinity"]), /requests/);
  assert.throws(() => parseLoadOptions(["--p95-ms=NaN"]), /p95/);
  assert.throws(() => parseLoadOptions(["--output=report.json"]), /Unknown/);
  assert.equal(parseLoadOptions(["--clients=2", "--rows=1000"]).clients, 2);
});

test("microsecond logs produce nearest-rank percentiles without treating failures as zero latency", () => {
  const report = summarizeLoad("0 0 1000 0 1 0\n0 1 2000 0 1 1\n1 0 9000 0 1 2\n1 1 failed 0 1 3\n", 4,
    { p50Ms: 5, p95Ms: 10, p99Ms: 10, errorRate: 0.25 });
  assert.equal(report.p50Ms, 2);
  assert.equal(report.p95Ms, 9);
  assert.equal(report.p99Ms, 9);
  assert.equal(report.errors, 1);
  assert.equal(report.errorRate, 0.25);
  assert.equal(report.passed, true);
});

test("missing requests, malformed logs and failed processes cannot pass the latency gate", () => {
  const thresholds = { p50Ms: 5, p95Ms: 10, p99Ms: 10, errorRate: 0 };
  assert.equal(summarizeLoad("0 0 1000 0 1 0\n", 2, thresholds).passed, false);
  assert.equal(summarizeLoad("", 2, thresholds).p99Ms, null);
  assert.throws(() => summarizeLoad("0 0 nope 0 1 0", 1, thresholds), /Malformed/);
  assert.throws(() => summarizeLoad("0 0 1000 0 1 0\n0 1 1000 0 1 0", 1, thresholds), /expected/);
  assert.equal(summarizeLoad("0 0 1000 0 1 0", 1, thresholds, false).passed, false);
});

test("latency limits fail independently even when every request succeeds", () => {
  const report = summarizeLoad("0 0 1000000 0 1 0", 1,
    { p50Ms: 250, p95Ms: 500, p99Ms: 1000, errorRate: 0 });
  assert.equal(report.passed, false);
  assert.deepEqual(report.violations, ["p50Ms", "p95Ms"]);
});

test("p95 and p99 remain distinct across a full latency distribution", () => {
  const log = Array.from({ length: 100 }, (_, index) => `0 ${index} ${(index + 1) * 1000} 0 1 0`).join("\n");
  const report = summarizeLoad(log, 100, { p50Ms: 50, p95Ms: 95, p99Ms: 99, errorRate: 0 });
  assert.equal(report.p50Ms, 50);
  assert.equal(report.p95Ms, 95);
  assert.equal(report.p99Ms, 99);
  assert.equal(report.passed, true);
});
