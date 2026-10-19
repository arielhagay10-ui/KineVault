import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { blankWorkshopScene } from "../../src/lib/motion/workshop";
import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { dismissWorkshopTutorial, openWorkshopMenu } from "./workshop-menu.helpers";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });

test("saved workshop has visible return navigation on desktop, mobile and in focus mode", async ({ page }) => {
  test.setTimeout(180_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `workshop-return-${randomUUID()}@example.test`, password = "WorkshopReturn2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  try {
    const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    await owner.auth.signInWithPassword({ email, password });
    const created = await owner.rpc("save_workshop_draft", { p_scene: blankWorkshopScene, p_name: "Return navigation fixture" });
    if (created.error) throw created.error;
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/my-exercises/${created.data}/workshop`);
    await dismissWorkshopTutorial(page);
    const anatomy = page.locator('[data-anatomy-state="ready"]');
    await expect(anatomy).toBeVisible({ timeout: 60_000 });
    await expect(anatomy).toHaveAttribute("data-highlight-count", "0");
    const actions = page.getByRole("region", { name: "Workshop actions", exact: true });
    const back = actions.getByRole("link", { name: "My exercises", exact: true });
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute("href", "/my-exercises");
    await expect(actions.getByRole("link", { name: "Exercise details", exact: true })).toBeVisible();
    mkdirSync(".local-artifacts/workshop/return-navigation", { recursive: true });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(back).toBeInViewport();
      await page.screenshot({ path: `.local-artifacts/workshop/return-navigation/${width}.png` });
    }
    await openWorkshopMenu(page);
    await page.getByRole("button", { name: "Hide controls", exact: true }).click();
    await expect(back).toBeInViewport();
    await back.click();
    await expect(page).toHaveURL(/\/my-exercises$/);
    await expect(page.getByRole("heading", { name: "My exercises", exact: true })).toBeVisible();
  } finally {
    await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password });
  }
});
