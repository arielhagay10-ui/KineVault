import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { blankWorkshopScene } from "../../src/lib/motion/workshop";
import { cleanupLocalFixture } from "../helpers/local-fixtures";

async function withLibraryAccount(page: Page, role: "user" | "reviewer" | "admin", run: (owner: SupabaseClient) => Promise<void>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("Library fixtures require local Supabase");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `library-navigation-${randomUUID()}@example.test`, password = `Library-${randomUUID()}!`;
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  const userId = account.data.user.id;
  const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const setRole = (value: "user" | "reviewer" | "admin") => execFileSync("docker", ["exec", "supabase_db_kinevault", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c",
    `begin; select set_config('app.audit_comment','Disposable local navigation regression fixture.',true); update public.roles set role='${value}',assigned_by=${value === "user" ? "null" : "user_id"} where user_id='${userId}'; commit;`], { stdio: "pipe" });
  try {
    if (role !== "user") setRole(role);
    const signedIn = await owner.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw signedIn.error;
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await run(owner);
  } finally {
    if (role !== "user") setRole("user");
    await cleanupLocalFixture({ admin, userId, email, password, owner });
  }
}

test("library navigation keeps its current page and draft actions work on mobile", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 375, height: 812 });
  await withLibraryAccount(page, "user", async (owner) => {
    await expect(page.getByRole("heading", { name: "Save exercises for later" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Start here" })).toHaveCount(0);
    const navigation = page.getByRole("navigation", { name: "Your library", exact: true });
    for (const [label, path] of [["Saved", "/dashboard"], ["My exercises", "/my-exercises"], ["Submissions", "/submissions"], ["Updates", "/notifications"]]) {
      await navigation.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
      await expect(navigation.getByRole("link", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    const draft = await owner.rpc("save_workshop_draft", { p_scene: blankWorkshopScene, p_name: "Navigation draft" });
    if (draft.error) throw draft.error;
    await page.goto("/my-exercises");
    const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Navigation draft" }) });
    await expect(card.getByRole("link", { name: "Resume draft" })).toBeVisible();
    await expect(card.getByRole("link", { name: "Optional details", exact: true })).toBeHidden();
    await card.getByText("More actions", { exact: true }).click();
    await expect(card.getByRole("link", { name: "Optional details", exact: true })).toBeVisible();
    await expect(card.getByRole("link", { name: "Publish exercise", exact: true })).toBeVisible();
    await expect(card.getByRole("button", { name: "Duplicate / use as template", exact: true })).toBeVisible();
    await card.getByRole("link", { name: "Share exercise", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/my-exercises/${draft.data}/edit#sharing$`));
    await expect(navigation.getByRole("link", { name: "My exercises", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "Share with friends" })).toBeInViewport();
    await page.getByRole("link", { name: "Publish exercise", exact: true }).click();
    await expect(navigation.getByRole("link", { name: "My exercises", exact: true })).toHaveAttribute("aria-current", "page");
  });
});

for (const role of ["reviewer", "admin"] as const) {
  test(`${role} review navigation shows its permitted destinations`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 375, height: 812 });
    await withLibraryAccount(page, role, async () => {
      await page.goto("/admin");
      const navigation = page.getByRole("navigation", { name: "Review workspace", exact: true });
      await expect(navigation.getByRole("link")).toHaveCount(role === "admin" ? 7 : 4);
      for (const label of ["Taxonomies", "Assets", "Roles"]) {
        await expect(navigation.getByRole("link", { name: label, exact: true })).toHaveCount(role === "admin" ? 1 : 0);
      }
      for (const label of ["Submissions", "Exercises", "Candidates", "Overview"]) {
        await navigation.getByRole("link", { name: label, exact: true }).click();
        await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
        await expect(navigation.getByRole("link", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    });
  });
}
