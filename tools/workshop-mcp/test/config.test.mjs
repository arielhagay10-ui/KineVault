import assert from "node:assert/strict";
import { test } from "node:test";
import { configuration } from "../dist/browser.js";

test("only local HTTP origins can receive browser sessions", () => {
  for (const url of ["https://127.0.0.1:3000", "http://localhost.example.com", "http://example.com", "http://user:pass@localhost:3000", "http://localhost:3000/admin", "http://localhost:3000/?token=private", "http://localhost:3000/#fragment"]) {
    assert.throws(() => configuration({ KV_WORKSHOP_URL: url }));
  }
  for (const url of ["http://localhost:3000", "http://127.0.0.1:1234", "http://[::1]:3000"]) {
    assert.equal(configuration({ KV_WORKSHOP_URL: url }).origin, url);
  }
  assert.equal(configuration({ KV_WORKSHOP_AUTH: "" }).auth, undefined);
});
