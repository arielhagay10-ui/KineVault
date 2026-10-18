import assert from "node:assert/strict";
import { test } from "node:test";
import { withPublishedCableRaise } from "../../tests/helpers/published-catalog.ts";

test("published fixtures reject remote applications before creating records", async () => {
  let used = false;
  for (const origin of ["https://example.com", "http://localhost.evil.test", "http://user:pass@localhost:3001", "http://localhost:3001/path", "file://localhost"]) {
    await assert.rejects(withPublishedCableRaise(origin, async () => { used = true; }), /loopback/);
  }
  assert.equal(used, false);
});

test("published fixtures reject remote Supabase before creating records", async () => {
  const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    for (const origin of ["https://example.supabase.co", "http://key@localhost:54321", "http://localhost:54321/path", "file://localhost"]) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = origin;
      await assert.rejects(withPublishedCableRaise("http://127.0.0.1:3001", async () => {}), /local Supabase/);
    }
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
  }
});
