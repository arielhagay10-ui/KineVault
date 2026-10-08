import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { parseHttpLoadOptions, validateHttpRows, summarizeHttpSamples, runHttpCase } from "./catalog-http-load-metrics.mjs";
import { buildHttpDatabaseUri } from "./catalog-http-load.mjs";

test("database URI preserves libpq option spaces instead of form-encoding plus signs", () => {
  const uri = new URL(buildHttpDatabaseUri("postgres://authenticator:test@db:5432/postgres", "supabase_db_kinevault",
    "kinevault_checks_01234567890123456789012345678901", 5000, "catalog_http"));
  const options = decodeURIComponent(uri.search.slice("?options=".length));
  assert.equal(options, "-c statement_timeout=5000 -c application_name=catalog_http");
  assert.equal(uri.pathname, "/kinevault_checks_01234567890123456789012345678901");
});

test("HTTP options bound pool size and reject accidental SQL/HTTP combinations", () => {
  assert.equal(parseHttpLoadOptions(["--http", "--http-pool=2", "--clients=8"]).pool, 2);
  assert.throws(() => parseHttpLoadOptions(["--http", "--load"]));
  assert.throws(() => parseHttpLoadOptions(["--http", "--http-pool=0"]));
  assert.throws(() => parseHttpLoadOptions(["--http", "--http-pool=2", "--http-pool=3"]));
});

test("response checks reject malformed JSON rows, duplicates and a changed page", () => {
  const expected = [{ exercise_id: "a", name: "Cable raise" }, { exercise_id: "b", name: "Cable press" }];
  assert.equal(validateHttpRows(expected, expected), true);
  assert.equal(validateHttpRows({ code: "PGRST001" }, expected), false);
  assert.equal(validateHttpRows([expected[0], expected[0]], expected), false);
  assert.equal(validateHttpRows(expected.slice(0, 1), expected), false);
  assert.equal(validateHttpRows([...expected].reverse(), expected), false);
  assert.equal(validateHttpRows([{ ...expected[0], name: "Hidden pending row" }, expected[1]], expected), false);
  assert.equal(validateHttpRows([], []), true);
});

test("HTTP metrics count missing, transport and correctness failures outside latency samples", () => {
  const result = summarizeHttpSamples([
    { elapsedMs: 10, ok: true }, { elapsedMs: 20, ok: true },
    { elapsedMs: 4000, ok: false, status: 503 }, { elapsedMs: 2, ok: false, status: 200 },
  ], 5, { p50Ms: 15, p95Ms: 25, p99Ms: 25, errorRate: 0 });
  assert.equal(result.p50Ms, 10);
  assert.equal(result.p95Ms, 20);
  assert.equal(result.errors, 3);
  assert.equal(result.errorRate, 0.6);
  assert.equal(result.passed, false);
  assert.deepEqual(result.violations, ["errorRate"]);
  assert.throws(() => summarizeHttpSamples([{ elapsedMs: -1, ok: true }], 1, {}));
  assert.throws(() => summarizeHttpSamples([], 0, {}));
});

test("successful HTTP requests still fail a latency budget breach", () => {
  const result = summarizeHttpSamples([{ elapsedMs: 251, ok: true }], 1,
    { p50Ms: 250, p95Ms: 500, p99Ms: 1000, errorRate: 0 });
  assert.equal(result.errors, 0);
  assert.equal(result.passed, false);
  assert.deepEqual(result.violations, ["p50Ms"]);
});

test("closed-loop HTTP requests preserve bodies, cap concurrency and count non-JSON failures", async () => {
  let active = 0;
  let peak = 0;
  let received = 0;
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks));
    assert.equal(request.method, "POST");
    assert.equal(body.page_size, 24);
    active++;
    peak = Math.max(peak, active);
    const ordinal = ++received;
    await new Promise(resolve => setTimeout(resolve, 15));
    active--;
    response.writeHead(ordinal % 2 ? 503 : 200, { "content-type": "application/json" });
    response.end(ordinal % 2 ? "unavailable" : JSON.stringify([{ exercise_id: "a" }]));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const samples = await runHttpCase({ url: `http://127.0.0.1:${server.address().port}/rpc/explore_exercises`,
      body: { page_size: 24 }, expected: [{ exercise_id: "a" }], clients: 2, requests: 3,
      timeoutMs: 1000, deadline: Date.now() + 5000 });
    assert.equal(samples.length, 6);
    assert.equal(received, 6);
    assert.equal(peak, 2);
    assert.ok(samples.some(sample => !sample.ok));
    assert.ok(samples.some(sample => sample.ok));
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test("HTTP deadline omissions and request timeouts fail the gate", async () => {
  const server = createServer((request, response) => {
    request.resume();
    response.writeHead(200, { "content-type": "application/json" });
    response.write("[");
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const config = { url: `http://127.0.0.1:${server.address().port}/rpc/explore_exercises`, body: {}, expected: [],
    clients: 1, requests: 1, timeoutMs: 20, deadline: Date.now() + 2000 };
  try {
    const samples = await runHttpCase(config);
    assert.equal(samples.length, 1);
    assert.equal(samples[0].ok, false);
    assert.equal(summarizeHttpSamples(samples, 1, { errorRate: 0 }).passed, false);
    const absent = await runHttpCase({ ...config, deadline: Date.now() - 1 });
    assert.equal(absent.length, 0);
    assert.equal(summarizeHttpSamples(absent, 1, { errorRate: 0 }).errors, 1);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
