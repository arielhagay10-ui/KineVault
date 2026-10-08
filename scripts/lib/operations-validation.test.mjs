import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { localOrigin, isolatedNames, migrationDifference, evaluateQueues, verifyBytes, requireStorageDenial } from "./operations-validation.mjs";

test("recovery names cannot select development or arbitrary databases", () => {
  const names = isolatedNames("11111111-1111-4111-8111-111111111111");
  assert.equal(names.source, "kinevault_recovery_source_11111111111141118111111111111111");
  assert.equal(names.restore, "kinevault_recovery_restore_11111111111141118111111111111111");
  for (const value of ["postgres", "kinevault_checks_abc", "../escape", "11111111-1111-4111-8111-111111111111;drop"]) {
    assert.throws(() => isolatedNames(value));
  }
});

test("local operations reject remote, credentials and non-origin URLs before mutation", () => {
  assert.equal(localOrigin("http://127.0.0.1:15421"), "http://127.0.0.1:15421");
  for (const value of ["https://project.supabase.co", "http://localhost.evil.test", "http://user:pass@localhost", "http://localhost/path", "http://localhost?secret=value"]) {
    assert.throws(() => localOrigin(value));
  }
});

test("migration audit fails missing and unexpected remote versions", () => {
  assert.deepEqual(migrationDifference(["202609270001", "20261005193722"], ["20261005150934"]), {
    passed: false, missing: ["202609270001", "20261005193722"], unexpected: ["20261005150934"], localCount: 2, remoteCount: 1,
  });
  assert.equal(migrationDifference(["202609270001"], ["202609270001"]).passed, true);
  assert.throws(() => migrationDifference(["202609270001"], ["202609270001", "202609270001"]));
});

test("queue gate catches stale leases, failures and due backlog without exposing jobs", () => {
  const clean = { render: { queued: 0, running: 0, failed: 0, stale: 0, oldestSeconds: 0 }, notification: { queued: 0, sending: 0, failed: 0, stale: 0, oldestSeconds: 0 } };
  assert.equal(evaluateQueues(clean).passed, true);
  assert.equal(evaluateQueues({ ...clean, render: { ...clean.render, queued: 2, oldestSeconds: 901 } }).passed, false);
  assert.equal(evaluateQueues({ ...clean, notification: { ...clean.notification, stale: 1 } }).passed, false);
  assert.equal(evaluateQueues({ ...clean, notification: { ...clean.notification, failed: 1 } }).passed, false);
  assert.throws(() => evaluateQueues({ render: { failed: -1 } }));
});

test("backup byte verification rejects corruption even when byte length matches", () => {
  const expected = Buffer.from("original");
  assert.equal(verifyBytes(expected, Buffer.from("original")).bytes, 8);
  assert.throws(() => verifyBytes(expected, Buffer.from("modified")));
});

test("Storage denials require authorization or missing-object status, never outages", () => {
  for (const status of [401, 403, 404]) assert.equal(requireStorageDenial({ status }), status);
  assert.equal(requireStorageDenial({ status: 400, statusCode: "404" }), 404);
  assert.equal(requireStorageDenial({ status: 400, statusCode: "403" }), 403);
  assert.equal(requireStorageDenial({ status: 400, error: "InvalidJWT" }), 401);
  assert.equal(requireStorageDenial({ status: 400, code: "NoSuchKey" }), 404);
  for (const result of [null, {}, new Error("network failure"), { status: 200 }, { status: 400 }, { status: 429 }, { status: 500 }, { status: 503 }, { status: 500, statusCode: "403" }, { status: 429, statusCode: "404" }, { status: 400, statusCode: "500" }, { status: 400, code: "InvalidRequest" }, { status: 400, code: "InternalError" }]) {
    assert.throws(() => requireStorageDenial(result));
  }
});

test("queue reports strip unknown private payload fields", () => {
  const value = { queued: 0, failed: 0, stale: 0, oldestSeconds: 0, recipient_email: "private@example.test", token: "private-token" };
  const output = JSON.stringify(evaluateQueues({ render: { ...value, running: 0 }, notification: { ...value, sending: 0 } }));
  assert.equal(output.includes("private@example.test"), false);
  assert.equal(output.includes("private-token"), false);
});

test("Storage drill fails a remote target with no credentials in diagnostics", () => {
  const result = spawnSync(process.execPath, ["scripts/drill-storage-recovery.mjs"], {
    cwd: process.cwd(), encoding: "utf8", timeout: 10000,
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "https://remote-project.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-value", SUPABASE_SERVICE_ROLE_KEY: "secret-must-not-appear" },
  });
  assert.equal(result.status, 1);
  const output = result.stdout + result.stderr;
  assert.equal(output.includes("secret-must-not-appear"), false);
  assert.equal(output.includes("remote-project"), false);
  assert.equal(JSON.parse(result.stdout).passed, false);
  assert.equal(JSON.parse(result.stdout).cleanupPassed, true);
});
