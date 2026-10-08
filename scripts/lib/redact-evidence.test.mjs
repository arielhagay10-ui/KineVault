import assert from "node:assert/strict";
import { test } from "node:test";
import { redactEvidence } from "./redact-evidence.mjs";

test("evidence removes query credentials from nested URLs and HTML without removing useful fields", () => {
  const report = { nodes: [{ html: '<video poster="https://storage.test/object?path=video&amp;token=posterSecret&amp;access_token=accessSecret">' }],
    url: "https://app.test/confirm?code=codeSecret&refresh_token=refreshSecret&token_hash=hashSecret&sort=alphabetical",
    status: 200, failure: null };
  const serialized = redactEvidence(report);
  for (const secret of ["posterSecret", "accessSecret", "codeSecret", "refreshSecret", "hashSecret"]) {
    assert.ok(!serialized.includes(secret));
  }
  const result = JSON.parse(serialized);
  assert.equal(result.status, 200);
  assert.equal(result.failure, null);
  assert.ok(result.url.includes("sort=alphabetical"));
  assert.ok(result.nodes[0].html.includes("path=video"));
  assert.equal(report.status, 200);
  assert.ok(report.url.includes("codeSecret"), "Source evidence is not mutated");
});

test("shared bearer paths are removed from page URLs and HTML links", () => {
  const serialized = redactEvidence({ url: "http://localhost/shared/privateShareToken?plain=visible",
    html: '<a href="/shared/anotherShareToken">Shared exercise</a>' });
  assert.ok(!serialized.includes("privateShareToken"));
  assert.ok(!serialized.includes("anotherShareToken"));
  assert.ok(serialized.includes("plain=visible"));
  assert.ok(serialized.includes("Shared exercise"));
});
