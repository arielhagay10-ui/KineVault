import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("a contributor can save and remove a favorite across refresh and dashboard navigation", async ({ page }) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `favorite-qa-${Date.now()}@example.test`;
  const password = "FavoriteQaFixture2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  try {
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/exercises/cable-lateral-raise");
    await page.getByRole("button", { name: "Save favorite", exact: true }).click();
    await expect(page.getByRole("button", { name: "Saved", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.getByRole("button", { name: "Saved", exact: true })).toBeVisible();
    mkdirSync(".local-artifacts/qa", { recursive: true });
    await page.screenshot({ path: ".local-artifacts/qa/favorites-fixed.png", fullPage: true });
    await page.goto("/dashboard");
    await page.getByRole("link", { name: /Cable Lateral Raise/ }).click();
    await page.getByRole("button", { name: "Saved", exact: true }).click();
    await expect(page.getByRole("button", { name: "Save favorite", exact: true })).toHaveAttribute("aria-pressed", "false");
    await page.reload();
    await expect(page.getByRole("button", { name: "Save favorite", exact: true })).toBeVisible();
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: /Cable Lateral Raise/ })).toHaveCount(0);
  } finally {
    await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password });
  }
});
