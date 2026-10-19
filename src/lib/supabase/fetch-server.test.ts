import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookies = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: cookies.set }) }));
import { fetchSupabase } from "./fetch-server";
import { createAnonymousClient } from "./anonymous";
import { createClient } from "./server";

describe("Supabase server transport", () => {
  const transport = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:15421");
    vi.stubEnv("SUPABASE_URL_INTERNAL", "http://host.docker.internal:15421");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");
    vi.stubGlobal("fetch", transport);
    transport.mockReset();
    cookies.set.mockReset();
    transport.mockResolvedValue(Response.json({}));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("routes API requests internally and preserves methods, headers and bodies", async () => {
    const request = new Request("http://127.0.0.1:15421/rest/v1/items?select=id", {
      method: "POST", headers: { authorization: "Bearer test-token" }, body: "payload",
    });
    await fetchSupabase(request);
    const forwarded = transport.mock.calls[0][0] as Request;
    expect(forwarded.url).toBe("http://host.docker.internal:15421/rest/v1/items?select=id");
    expect(forwarded.method).toBe("POST");
    expect(forwarded.headers.get("authorization")).toBe("Bearer test-token");
    expect(await forwarded.text()).toBe("payload");
  });

  it("uses the public endpoint when the optional internal URL is empty", async () => {
    vi.stubEnv("SUPABASE_URL_INTERNAL", "");
    const url = "http://127.0.0.1:15421/auth/v1/user";
    await fetchSupabase(url);
    expect(transport).toHaveBeenCalledWith(url, undefined);
  });

  it("does not forward other origins or credentials to the internal service", async () => {
    const url = "http://127.0.0.1:15421.example.com/rest/v1/items";
    await fetchSupabase(url);
    expect(transport).toHaveBeenCalledWith(url, undefined);
  });

  it("keeps signed media URLs on the public origin", async () => {
    transport.mockResolvedValue(Response.json([{ path: "poster.webp", signedURL: "/object/sign/exercise-public/poster.webp?token=test" }]));
    const client = createAnonymousClient();
    const { data, error } = await client.storage.from("exercise-public").createSignedUrls(["poster.webp"], 900);
    expect(error).toBeNull();
    expect(data?.[0].signedUrl).toBe("http://127.0.0.1:15421/storage/v1/object/sign/exercise-public/poster.webp?token=test");
    expect(transport.mock.calls[0][0]).toContain("http://host.docker.internal:15421/storage/v1/");
  });

  it("uses the browser's auth cookie name when signing in through the internal endpoint", async () => {
    const accessToken = [
      { alg: "HS256", typ: "JWT" },
      { sub: "a87e4547-9626-4a13-af4f-73d6bd31859b", exp: Math.floor(Date.now() / 1000) + 3600 },
    ].map(value => Buffer.from(JSON.stringify(value)).toString("base64url")).join(".") + ".c2lnbmF0dXJl";
    transport.mockImplementation(async () => Response.json({
      access_token: accessToken, refresh_token: "test-refresh-token", expires_in: 3600,
      token_type: "bearer", user: { id: "a87e4547-9626-4a13-af4f-73d6bd31859b" },
    }));
    const client = await createClient();
    const { error } = await client.auth.signInWithPassword({ email: "test@example.com", password: "test-password" });
    expect(error).toBeNull();
    expect(cookies.set.mock.calls.some(([name]) => name === "sb-127-auth-token")).toBe(true);
    expect(transport.mock.calls[0][0]).toContain("http://host.docker.internal:15421/auth/v1/token");
  });
});
