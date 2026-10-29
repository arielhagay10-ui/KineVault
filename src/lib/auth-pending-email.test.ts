import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ values: new Map<string, string>(), set: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: (name: string) => { const value = mocks.values.get(name); return value ? { value } : undefined; },
  set: mocks.set,
  delete: (name: string) => mocks.values.delete(name),
}) }));
import { NextResponse } from "next/server";
import { clearPendingEmail, getPendingEmail, rememberPendingEmail } from "./auth-pending-email";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-15T10:00:00Z"));
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://kinevault.example");
  mocks.values.clear();
  mocks.set.mockReset().mockImplementation((name: string, value: string) => mocks.values.set(name, value));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

it("stores only expiring presentation data in an HttpOnly cookie", async () => {
  await rememberPendingEmail({ email: "person@example.com", kind: "signup", next: "//outside.example" });
  const [name, , options] = mocks.set.mock.calls[0];
  expect(options).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", maxAge: 3600 });
  expect((await getPendingEmail())?.next).toBe("/dashboard");
  expect((await getPendingEmail())?.remainingSeconds).toBe(60);
  vi.advanceTimersByTime(61_000);
  expect((await getPendingEmail())?.remainingSeconds).toBe(0);
  vi.advanceTimersByTime(3600_000);
  expect(await getPendingEmail()).toBeNull();
  expect(name).toBe("kv-auth-email");
});

it("keeps long valid continuations within browser cookie limits", async () => {
  const next = "/exercises?q=" + "?".repeat(2000);
  await rememberPendingEmail({ email: "person@example.com", kind: "signup", next });
  const [name, value, options] = mocks.set.mock.calls[0];
  const response = new NextResponse();
  response.cookies.set(name, value, options);
  expect(Buffer.byteLength(response.headers.get("set-cookie")!)).toBeLessThanOrEqual(4096);
  expect((await getPendingEmail())?.next).toBe(next);
});

it("continues reading pending email cookies issued before compact encoding", async () => {
  mocks.values.set("kv-auth-email", JSON.stringify({ email: "person@example.com", kind: "recovery", next: "/my-exercises", retryAt: 0, expiresAt: Date.now() + 3600_000 }));
  expect(await getPendingEmail()).toMatchObject({ kind: "recovery", next: "/my-exercises", remainingSeconds: 0 });
});

it("ignores malformed and implausible cooldown cookies", async () => {
  mocks.values.set("kv-auth-email", "invalid-json");
  expect(await getPendingEmail()).toBeNull();
  mocks.values.set("kv-auth-email", JSON.stringify({ email: "person@example.com", kind: "signup", next: "/dashboard", retryAt: Date.now() + 300_000, expiresAt: Date.now() + 3600_000 }));
  expect(await getPendingEmail()).toBeNull();
});

it("does not invent a send cooldown for an unconfirmed sign-in", async () => {
  await rememberPendingEmail({ email: "person@example.com", kind: "signup", next: "/my-exercises" }, false);
  expect((await getPendingEmail())?.remainingSeconds).toBe(0);
  await clearPendingEmail();
  expect(await getPendingEmail()).toBeNull();
});
