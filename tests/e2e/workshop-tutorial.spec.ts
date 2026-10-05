import { setWorkshopLanguage } from "./workshop-menu.helpers";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });
test.beforeEach(async ({ page }) => page.setDefaultTimeout(60_000));

test("first exercise tutorial resumes, closes, and stays optional on later exercises", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `tutorial-${randomUUID()}@example.test`, password = "WorkshopTutorial2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/my-exercises/new");
    const tutorial = page.getByRole("region", { name: "Workshop tutorial", exact: true });
    await expect(tutorial.getByRole("heading", { name: "Choose your equipment", exact: true })).toBeVisible();
    for (let step = 0; step < 4; step++) await tutorial.getByRole("button", { name: "Next tip", exact: true }).click();
    await expect(tutorial.getByRole("heading", { name: "Build the movement", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Advanced editing", exact: true, includeHidden: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-tutorial-target="timeline"]')).toBeVisible();
    await page.reload();
    await expect(tutorial.getByRole("heading", { name: "Build the movement", exact: true })).toBeVisible();
    await tutorial.getByRole("button", { name: "Show these controls", exact: true }).click();
    await expect(page.locator('[data-tutorial-target="timeline"]')).toBeVisible();
    await tutorial.getByRole("button", { name: "Close tutorial", exact: true }).click();
    await expect(tutorial).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Tutorial", exact: true })).toBeFocused();
    await page.reload();
    await expect(page.getByRole("button", { name: "Tutorial", exact: true })).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText("Choose an example to see a complete movement, or add equipment to your current scene.", { exact: true })).not.toBeVisible();
    await page.getByRole("button", { name: "Add equipment", exact: true }).filter({ visible: true }).click();
    await page.getByRole("dialog").getByRole("searchbox").fill("cable row");
    await page.getByRole("dialog").getByRole("button", { name: "Cable row", exact: true }).first().click();
    await page.getByRole("button", { name: "Start and finish", exact: true }).click();
    await expect(page.getByText("Sit with feet on the footplates. Both hands follow the row handle toward the torso.", { exact: true })).not.toBeVisible();
    await expect(page.getByText("Demonstration caption:", { exact: true })).not.toBeVisible();
    await page.getByRole("button", { name: "Name and save", exact: true }).click();
    await page.getByLabel("Exercise name", { exact: true }).fill("My first workshop exercise");
    await expect(page.getByText(/Saved at.*Private/)).toBeVisible({ timeout: 20_000 });
    // An existing exercise suppresses automatic onboarding even on another device.
    const cleanContext = await browser.newContext({ storageState: { cookies: await context.cookies(), origins: [] } });
    try {
      const next = await cleanContext.newPage();
      await next.goto("http://127.0.0.1:3000/my-exercises/new");
      const replay = next.getByRole("button", { name: "Tutorial", exact: true });
      await replay.click();
      await expect(next.getByRole("heading", { name: "Choose your equipment", exact: true })).toBeVisible();
      await next.getByRole("button", { name: "Close tutorial", exact: true }).click();
      await next.reload();
      await expect(replay).toHaveAttribute("aria-expanded", "false");
      await expect(next.locator("[data-workshop-current-hint]")).toBeVisible();
      await expect(next.locator("[data-workshop-guidance]:not([data-workshop-essential])")).toHaveCount(0);
    } finally { await cleanContext.close(); }
    await page.getByRole("button", { name: "Tutorial", exact: true }).click();
    await setWorkshopLanguage(page, "he");
    await expect(page.getByRole("region", { name: "מדריך הסדנה", exact: true })).toBeVisible();
    await setWorkshopLanguage(page, "en");
    for (let step = 0; step < 8; step++) await tutorial.getByRole("button", { name: "Next tip", exact: true }).click();
    await expect(tutorial.getByRole("heading", { name: "Name and save your exercise", exact: true })).toBeVisible();
    await tutorial.getByRole("button", { name: "Finish tutorial", exact: true }).click();
    await expect(tutorial).not.toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Tutorial", exact: true }).click();
    await expect(tutorial).toBeVisible();
    await expect(tutorial.getByRole("heading", { name: "Choose your equipment", exact: true })).toBeInViewport();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    mkdirSync(".local-artifacts/workshop/tutorial", { recursive: true });
    await page.screenshot({ path: ".local-artifacts/workshop/tutorial/mobile.png", fullPage: true });
    expect(errors).toEqual([]);
  } finally { await admin.auth.admin.deleteUser(account.data.user.id); }
});
