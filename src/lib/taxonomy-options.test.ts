import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ cacheArguments: [] as unknown[], from: vi.fn(), create: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (...args: unknown[]) => {
  mocks.cacheArguments = args;
  return args[0];
} }));
vi.mock("@/lib/supabase/anonymous", () => ({ createAnonymousClient: mocks.create }));
import { loadTaxonomyOptions, TAXONOMY_CACHE_TAG } from "./taxonomy-options";

describe("public taxonomy options", () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.create.mockReturnValue({ from: mocks.from });
    mocks.from.mockImplementation(table => ({ select: () => ({ order: async () => ({
      data: table === "joint_actions" ? [{ slug: "shoulder-abduction", name: "Abduction", joints: { name: "Shoulder" } }] : [{ slug: "sample", name: "Sample" }], error: null,
    }) }) }));
  });
  it("caches only anonymous public options with a shared invalidation tag", async () => {
    const result = await loadTaxonomyOptions();
    expect(mocks.create).toHaveBeenCalled();
    expect(mocks.cacheArguments).toEqual([expect.any(Function), ["public-taxonomy-options-v1"], { tags: [TAXONOMY_CACHE_TAG], revalidate: 3600 }]);
    expect(result.jointActions).toEqual([{ slug: "shoulder-abduction", name: "Shoulder Abduction" }]);
    expect(mocks.from.mock.calls.flat()).not.toContain("roles");
  });
  it("rejects failed option reads instead of caching an incomplete classification list", async () => {
    mocks.from.mockReturnValue({ select: () => ({ order: async () => ({ data: null, error: { message: "Unavailable" } }) }) });
    await expect(loadTaxonomyOptions()).rejects.toThrow("classifications could not be loaded");
  });
});
