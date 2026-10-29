import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

type Favorite = { exercise_id: string; exercises: { slug: string; current_content_id: string } | null };
const mocks = vi.hoisted(() => ({ favorites: [] as Favorite[], total: 0 }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getIdentity: async () => ({ userId: "owner", role: "user" }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const result = table === "favorites" ? { data: mocks.favorites, count: mocks.total, error: null }
        : { data: table === "exercise_content" ? [{ id: "content", name: "Cable raise" }] : [], count: 0, error: null };
      const promise = Promise.resolve(result);
      return {
        select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
        then: promise.then.bind(promise),
      };
    },
  }),
}));
import DashboardPage from "./page";

beforeEach(() => {
  mocks.favorites = [];
  mocks.total = 0;
});

it("explains hidden saved exercises while preserving their count and pagination", async () => {
  mocks.favorites = [{ exercise_id: "hidden", exercises: null }];
  mocks.total = 25;
  const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));
  expect(html).toContain("Saved exercise unavailable");
  expect(html).toContain("This exercise is no longer public.");
  expect(html).toContain("25 saved exercises");
  expect(html).toContain('href="/dashboard?page=2"');
  expect(html).not.toContain("Save exercises for later");
});

it("keeps accessible favorites beside unavailable ones", async () => {
  mocks.favorites = [
    { exercise_id: "hidden", exercises: null },
    { exercise_id: "visible", exercises: { slug: "cable-raise", current_content_id: "content" } },
  ];
  mocks.total = 2;
  const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));
  expect(html).toContain("Saved exercise unavailable");
  expect(html).toContain('href="/exercises/cable-raise"');
  expect(html).toContain("Cable raise");
  expect(html).toContain("2 saved exercises");
  expect(html).not.toContain("Save exercises for later");
});
