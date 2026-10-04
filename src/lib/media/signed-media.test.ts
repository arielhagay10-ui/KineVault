import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), sign: vi.fn(), bucket: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./render-replacements", () => ({ resolveRenderReplacements: mocks.resolve }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ storage: { from: mocks.bucket } }) }));
import { signMediaObjects, signResolvedMediaObjects } from "./signed-media";

describe("media signing", () => {
  beforeEach(() => {
    mocks.resolve.mockClear();
    mocks.sign.mockClear();
    mocks.bucket.mockClear();
    mocks.bucket.mockReturnValue({ createSignedUrls: mocks.sign });
    mocks.sign.mockImplementation(async (paths: string[]) => ({ data: paths.map(path => ({ path, signedUrl: `signed:${path}` })), error: null }));
  });
  it("signs resolved records without repeating the replacement lookup", async () => {
    const urls = await signResolvedMediaObjects([{ storage_bucket: "public", storage_path: "current.mp4" }]);
    expect(mocks.resolve).not.toHaveBeenCalled();
    expect(urls.get("public/current.mp4")).toBe("signed:current.mp4");
  });
  it("keeps every original mapping when replacements share a file", async () => {
    mocks.resolve.mockResolvedValue([
      { storage_bucket: "public", storage_path: "current.mp4" },
      { storage_bucket: "public", storage_path: "current.mp4" },
    ]);
    const urls = await signMediaObjects([
      { storage_bucket: "public", storage_path: "old-a.mp4" },
      { storage_bucket: "public", storage_path: "old-b.mp4" },
    ]);
    expect(mocks.resolve).toHaveBeenCalledOnce();
    expect(mocks.sign).toHaveBeenCalledWith(["current.mp4"], 900);
    expect([...urls]).toEqual([["public/old-a.mp4", "signed:current.mp4"], ["public/old-b.mp4", "signed:current.mp4"]]);
  });
  it("does no storage work for empty media and does not invent URLs after signing errors", async () => {
    expect((await signResolvedMediaObjects([])).size).toBe(0);
    expect(mocks.bucket).not.toHaveBeenCalled();
    mocks.sign.mockResolvedValue({ data: null, error: { message: "No access" } });
    expect((await signResolvedMediaObjects([{ storage_bucket: "private", storage_path: "a" }])).size).toBe(0);
  });
});
