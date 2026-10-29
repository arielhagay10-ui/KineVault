import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), taxonomy: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/taxonomy-options", () => ({ loadTaxonomyOptions: mocks.taxonomy }));
import ExplorePage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.taxonomy.mockResolvedValue({});
});

it("offers a full-page retry at the current filtered URL when the catalog fails", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: "private database details" } });
  const html = renderToStaticMarkup(await ExplorePage({ searchParams: Promise.resolve({ equipment: "cable", q: "raise" }) }));
  expect(html).toContain('role="alert"');
  expect(html).toMatch(/<a href=""[^>]*>Try again<\/a>/);
  expect(html).not.toContain("private database details");
});

it("keeps malformed search URLs resettable without fetching catalog data", async () => {
  const html = renderToStaticMarkup(await ExplorePage({ searchParams: Promise.resolve({ q: "x".repeat(101) }) }));
  expect(html).toContain("Invalid search filters");
  expect(html).toMatch(/<a[^>]*href="\/exercises"[^>]*>Reset filters<\/a>/);
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.taxonomy).not.toHaveBeenCalled();
});
