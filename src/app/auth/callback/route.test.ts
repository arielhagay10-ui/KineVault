import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ exchange: vi.fn(), clear: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth-pending-email", () => ({ clearPendingEmail: mocks.clear }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { exchangeCodeForSession: mocks.exchange } }) }));
import { GET } from "./route";

beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://kinevault.example"); });

it("returns Google cancellations to the configured site without reflecting provider descriptions", async () => {
  const response = await GET(new NextRequest("http://internal-container/auth/callback?error=access_denied&error_description=untrusted&next=%2Fexercises"));
  const destination = new URL(response.headers.get("location")!);
  expect(destination.origin).toBe("https://kinevault.example");
  expect(destination.searchParams.get("callback")).toBe("canceled");
  expect(destination.searchParams.get("next")).toBe("/exercises");
  expect(destination.searchParams.has("error_description")).toBe(false);
  expect(mocks.exchange).not.toHaveBeenCalled();
});

it("handles a rejected OAuth code without claiming login succeeded", async () => {
  mocks.exchange.mockResolvedValue({ error: { code: "bad_code" } });
  const response = await GET(new NextRequest("http://internal-container/auth/callback?code=invalid&next=//outside.example"));
  const destination = new URL(response.headers.get("location")!);
  expect(destination.searchParams.get("callback")).toBe("failed");
  expect(destination.searchParams.get("next")).toBe("/dashboard");
  expect(mocks.clear).not.toHaveBeenCalled();
});
