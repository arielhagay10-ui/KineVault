import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { parseFirefoxOptions, requireLoopbackOrigin, removeFirefoxProfile, redactFirefoxEvidence } from "../check-firefox.mjs";

test("Firefox fixture checks reject remote origins and arbitrary browser profiles", () => {
  assert.equal(parseFirefoxOptions(["--origin=http://127.0.0.1:3001"]).origin, "http://127.0.0.1:3001");
  for (const origin of ["https://example.com", "http://localhost.evil.test:3001", "http://user:pass@127.0.0.1:3001", "http://127.0.0.1:3001/path"]) {
    assert.throws(() => parseFirefoxOptions(["--origin=" + origin]));
  }
  assert.throws(() => parseFirefoxOptions(["--profile=C:/Users/profile"]));
  assert.throws(() => parseFirefoxOptions(["--timeout-seconds=0"]));
  assert.throws(() => parseFirefoxOptions(["--origin=http://localhost:3001", "--origin=http://localhost:3000"]));
});

test("fixture URL validation rejects credentials, paths and non-HTTP destinations", () => {
  assert.equal(requireLoopbackOrigin("http://localhost:54321"), "http://localhost:54321");
  for (const origin of ["https://remote.supabase.co", "file://localhost", "http://key@localhost:54321", "http://localhost:54321/remote"]) {
    assert.throws(() => requireLoopbackOrigin(origin));
  }
});

test("profile cleanup removes only its generated run profile and preserves evidence", () => {
  const directory = resolve(".local-artifacts", "firefox-installed", randomUUID());
  const profile = join(directory, "profile");
  mkdirSync(profile, { recursive: true });
  writeFileSync(join(profile, "prefs.js"), "temporary browser preferences");
  writeFileSync(join(directory, "results.json"), "evidence");
  try {
    removeFirefoxProfile(directory);
    assert.equal(readFileSync(join(directory, "results.json"), "utf8"), "evidence");
    assert.throws(() => readFileSync(join(profile, "prefs.js")));
    assert.throws(() => removeFirefoxProfile(resolve(".local-artifacts")));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("axe evidence hides signed media and authentication URL query credentials", () => {
  const cleaned = redactFirefoxEvidence({ html: '<img src="http://localhost/video?token=secretToken&amp;access_token=secretAccess">',
    url: "http://localhost/callback?code=secretCode&refresh_token=secretRefresh&token_hash=secretHash&plain=visible" });
  for (const secret of ["secretToken", "secretAccess", "secretCode", "secretRefresh", "secretHash"]) assert.ok(!cleaned.includes(secret));
  assert.ok(cleaned.includes("plain=visible"));
});
