import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { blankWorkshopScene } from "../../src/lib/motion/workshop";

test("private library cards and saved previews fit narrow screens with long names", async ({ page }) => {
  test.setTimeout(90_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `library-layout-${Date.now()}@example.test`, password = "LibraryLayoutFixture2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;

  try {
    const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    await owner.auth.signInWithPassword({ email, password });
    const created = await owner.rpc("save_workshop_draft", { p_scene: blankWorkshopScene, p_name: "Reverse Pec Deck Rear Delt Fly" });
    if (created.error) throw created.error;
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/my-exercises");
    const card = page.getByRole("article");
    await expect(card.getByRole("heading", { name: "Reverse Pec Deck Rear Delt Fly" })).toBeVisible();
    const folder = ".local-artifacts/qa";
    mkdirSync(folder, { recursive: true });
    await page.screenshot({ path: `${folder}/private-library-before-or-after.png`, fullPage: true });
    const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    expect(await fits()).toBe(true);
    await card.getByRole("button", { name: "Preview saved motion", exact: true }).click();
    await expect(card.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    expect(await fits()).toBe(true);
    await page.screenshot({ path: `${folder}/private-library-fixed.png`, fullPage: true });
    await card.getByRole("button", { name: "Close preview", exact: true }).click();
    const updated = await owner.rpc("save_private_exercise", { p_private_id: created.data, p_name: "X".repeat(140) });
    if (updated.error) throw updated.error;
    await page.reload();
    await card.getByRole("button", { name: "Preview saved motion", exact: true }).click();
    await expect(card.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    for (const width of [375, 390, 430, 768]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await fits()).toBe(true);
      await page.screenshot({ path: `${folder}/private-library-${width}.png`, fullPage: true });
    }
  } finally {
    await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password });
  }
});
