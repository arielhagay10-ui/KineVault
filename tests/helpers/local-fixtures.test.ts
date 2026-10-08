import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanupLocalFixture } from "./local-fixtures";

const userId = "d1d24aa7-6084-4823-9b14-a9d52abc89c4";
const email = "cleanup-qa-123@example.test";
const password = "FixtureCleanup2026!";

afterEach(() => vi.unstubAllGlobals());

describe("local fixture cleanup", () => {
  it("rejects a remote client before issuing any request", async () => {
    const admin = createClient("https://project.supabase.co", "test-key");
    await expect(cleanupLocalFixture({ admin, userId, email, password })).rejects.toThrow("local Supabase");
  });

  it("rejects an ordinary email before issuing any request", async () => {
    const admin = createClient("http://127.0.0.1:54321", "test-key");
    await expect(cleanupLocalFixture({ admin, userId, email: "person@example.com", password })).rejects.toThrow("fixture email");
  });

  it("rejects an ID whose account email differs from the named fixture", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ id: userId, email: "another@example.test" }));
    const admin = createClient("http://127.0.0.1:54321", "test-key");
    await expect(cleanupLocalFixture({ admin, userId, email, password })).rejects.toThrow("does not match");
  });
});
