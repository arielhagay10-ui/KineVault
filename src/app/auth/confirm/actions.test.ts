import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ verify: vi.fn(), clear: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/auth-pending-email", () => ({ clearPendingEmail: mocks.clear }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { verifyOtp: mocks.verify } }) }));
import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { confirmEmail } from "./actions";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}
const initial = { error: null, notice: null };
const valid = { token_hash: "a".repeat(64), type: "email", next: "/exercises?equipment=cable" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verify.mockResolvedValue({ error: null });
});

it("does not send malformed confirmation tokens to the auth provider", async () => {
  const result = await confirmEmail(initial, form({ ...valid, token_hash: "invalid" }));
  expect(result.error).toBeTruthy();
  expect(mocks.verify).not.toHaveBeenCalled();
});

it("starts a cookie session and resumes the original page after confirmation", async () => {
  await expect(confirmEmail(initial, form(valid))).rejects.toThrow("redirect:/exercises?equipment=cable");
  expect(mocks.verify).toHaveBeenCalledWith({ token_hash: valid.token_hash, type: "email" });
  expect(mocks.clear).toHaveBeenCalledOnce();
});

it("accepts Supabase's opaque PKCE confirmation hashes", async () => {
  const token = `pkce_${"b".repeat(56)}`;
  await expect(confirmEmail(initial, form({ ...valid, token_hash: token }))).rejects.toThrow("redirect:/exercises?equipment=cable");
  expect(mocks.verify).toHaveBeenCalledWith({ token_hash: token, type: "email" });
});

it("always sends recovery through password update before resuming the original destination", async () => {
  await expect(confirmEmail(initial, form({ ...valid, type: "recovery" }))).rejects.toThrow("redirect:/reset-password/update?next=%2Fexercises%3Fequipment%3Dcable");
});

it("does not redirect outside the app after a valid confirmation", async () => {
  await expect(confirmEmail(initial, form({ ...valid, next: "//outside.example" }))).rejects.toThrow("redirect:/dashboard");
});

it.each([
  new AuthRetryableFetchError("sensitive outage details", 503),
  new AuthApiError("sensitive server details", 500, "unexpected_failure"),
])("keeps the same confirmation link retryable during an outage: %s", async error => {
  mocks.verify.mockResolvedValue({ error });
  const result = await confirmEmail(initial, form(valid));
  expect(result.error).toMatch(/try again in a moment/i);
  expect(result.error).not.toMatch(/expired|used|sensitive/i);
  expect(mocks.clear).not.toHaveBeenCalled();
});

it("asks rate-limited confirmation attempts to wait instead of replacing the link", async () => {
  mocks.verify.mockResolvedValue({ error: new AuthApiError("rate limited", 429, undefined) });
  const result = await confirmEmail(initial, form(valid));
  expect(result.error).toMatch(/wait|too many/i);
  expect(result.error).not.toMatch(/expired|used/i);
  expect(mocks.clear).not.toHaveBeenCalled();
});

it("offers recovery for expired or used links without returning provider messages", async () => {
  mocks.verify.mockResolvedValue({ error: { code: "otp_expired", message: "sensitive provider message" } });
  const result = await confirmEmail(initial, form(valid));
  expect(result.error).toMatch(/expired|used/i);
  expect(result.error).not.toContain("sensitive");
  expect(mocks.clear).not.toHaveBeenCalled();
});
