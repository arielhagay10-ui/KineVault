import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ claims: vi.fn(), role: vi.fn(), from: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getClaims: mocks.claims }, from: mocks.from,
}) }));
import { getIdentity, requireRole } from "./auth";

describe("request identity and mutation authorization", () => {
  beforeEach(() => {
    mocks.from.mockClear();
    mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ single: mocks.role }) }) });
    mocks.claims.mockResolvedValue({ data: { claims: { sub: "account-id" } }, error: null });
    mocks.role.mockResolvedValue({ data: { role: "admin" }, error: null });
  });
  it("does not look up roles for visitors or invalid claims", async () => {
    mocks.claims.mockResolvedValue({ data: null, error: { message: "Invalid" } });
    expect(await getIdentity()).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("rejects authenticated accounts missing an application role", async () => {
    mocks.role.mockResolvedValue({ data: null, error: null });
    await expect(getIdentity()).rejects.toThrow("no application role");
  });
  it("rechecks the database role for every authorized mutation", async () => {
    await expect(requireRole(["admin"])).resolves.toEqual({ userId: "account-id", role: "admin" });
    mocks.role.mockResolvedValue({ data: { role: "user" }, error: null });
    await expect(requireRole(["admin"])).rejects.toThrow("Forbidden");
    mocks.claims.mockResolvedValue({ data: null, error: null });
    await expect(requireRole(["user"])).rejects.toThrow("Forbidden");
  });
});
