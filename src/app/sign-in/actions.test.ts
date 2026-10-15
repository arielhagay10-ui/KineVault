import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(), signUp: vi.fn(), oauth: vi.fn(), resend: vi.fn(), reset: vi.fn(), update: vi.fn(),
  cookies: new Map<string, string>(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: (name: string) => { const value = mocks.cookies.get(name); return value ? { value } : undefined; },
  set: (name: string, value: string) => mocks.cookies.set(name, value),
  delete: (name: string) => mocks.cookies.delete(name),
}) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: {
  signInWithPassword: mocks.signIn, signUp: mocks.signUp, signInWithOAuth: mocks.oauth,
  resend: mocks.resend, resetPasswordForEmail: mocks.reset, updateUser: mocks.update,
} }) }));

import * as actions from "./actions";

const initial = { error: null, notice: null };
function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}
const credentials = { email: "person@example.com", password: "LongEnoughPassword!", next: "/exercises?equipment=cable" };

describe("authentication actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mocks.cookies.clear();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://127.0.0.1:3000");
    mocks.signIn.mockResolvedValue({ error: null });
    mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
    mocks.resend.mockResolvedValue({ error: null });
    mocks.reset.mockResolvedValue({ error: null });
    mocks.oauth.mockResolvedValue({ data: { url: "https://accounts.google.com/o/oauth2/auth" }, error: null });
  });

  it("continues to the original destination after immediate local registration", async () => {
    mocks.signUp.mockResolvedValue({ data: { session: {} }, error: null });
    await expect(actions.signUp(initial, form(credentials))).rejects.toThrow("redirect:/exercises?equipment=cable");
  });

  it("opens the check-email screen for pending registration without putting the email in its URL", async () => {
    await expect(actions.signUp(initial, form(credentials))).rejects.toThrow("redirect:/check-email");
    const saved = [...mocks.cookies.values()].map(value => JSON.parse(value));
    expect(saved).toContainEqual(expect.objectContaining({ email: credentials.email, next: credentials.next, kind: "signup" }));
  });

  it("offers confirmation recovery when login is blocked by an unconfirmed email", async () => {
    mocks.signIn.mockResolvedValue({ error: { code: "email_not_confirmed" } });
    await expect(actions.signIn(initial, form(credentials))).rejects.toThrow("redirect:/check-email");
  });

  it("does not expose account existence for incorrect login details", async () => {
    mocks.signIn.mockResolvedValue({ error: { code: "invalid_credentials", message: "No such account" } });
    const result = await actions.signIn(initial, form(credentials));
    expect(result.error).toMatch(/email|password|sign-in/i);
    expect(result.error).not.toContain("No such account");
  });

  it("does not claim a reset email was sent when the provider is unavailable", async () => {
    mocks.reset.mockResolvedValue({ error: { code: "unexpected_failure" } });
    const result = await actions.requestPasswordReset(initial, form(credentials));
    expect(result.error).toBeTruthy();
    expect(result.notice).toBeNull();
  });

  it("keeps repeated resends inside the browser cooldown", async () => {
    const data = form({ ...credentials, kind: "signup" });
    await actions.resendAuthEmail(initial, data);
    const result = await actions.resendAuthEmail(initial, data);
    expect(result.retryAt).toBeGreaterThan(Date.now());
    expect(mocks.resend).toHaveBeenCalledTimes(1);
  });

  it("cannot bypass the browser cooldown by changing the submitted address", async () => {
    await actions.resendAuthEmail(initial, form({ ...credentials, kind: "signup" }));
    await actions.resendAuthEmail(initial, form({ ...credentials, email: "other@example.com", kind: "signup" }));
    expect(mocks.resend).toHaveBeenCalledTimes(1);
  });

  it("keeps resend responses generic when the provider reports an unknown address", async () => {
    mocks.resend.mockResolvedValue({ error: { code: "user_not_found" } });
    const result = await actions.resendAuthEmail(initial, form({ ...credentials, kind: "signup" }));
    expect(result.error).toBeNull();
    expect(result.notice).toBeTruthy();
  });

  it("does not start Google OAuth while it is disabled", async () => {
    vi.stubEnv("AUTH_GOOGLE_ENABLED", "false");
    const result = await actions.signInWithGoogle(initial, form({ next: credentials.next }));
    expect(result.error).toBeTruthy();
    expect(mocks.oauth).not.toHaveBeenCalled();
  });

  it("starts Google OAuth with the safe destination in its callback", async () => {
    vi.stubEnv("AUTH_GOOGLE_ENABLED", "true");
    await expect(actions.signInWithGoogle(initial, form({ next: credentials.next }))).rejects.toThrow("redirect:https://accounts.google.com");
    const { options } = mocks.oauth.mock.calls[0][0];
    expect(new URL(options.redirectTo).origin).toBe("http://127.0.0.1:3000");
    expect(new URL(options.redirectTo).searchParams.get("next")).toBe(credentials.next);
  });
});
