import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

test("shared appearance has no topbar or scrollbar gutter", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("banner")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Site menu", exact: true })).toBeVisible();
  expect(await page.locator("body").evaluate(element => getComputedStyle(element).fontFamily)).toContain("Comfortaa");
  await expect(page.locator('img[src="/posters/home-anatomy.webp"]')).toHaveCount(0);
  await expect.poll(() => page.getByRole("img", { name: "Blue mascot wearing glasses and holding a pencil and notebook", exact: true }).evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  mkdirSync(".local-artifacts/site-simplification", { recursive: true });
  await page.screenshot({ path: ".local-artifacts/site-simplification/home-desktop.png" });
  await page.getByRole("button", { name: "Site menu", exact: true }).click();
  await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.goto("/exercises");
  await expect(page.getByRole("banner")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator("body > .os-scrollbar-vertical")).toHaveCount(1);
  expect(await page.locator("body > .os-scrollbar-vertical .os-scrollbar-track").evaluate(element => getComputedStyle(element).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  expect(await page.locator("body > .os-scrollbar-vertical .os-scrollbar-handle").evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
  expect(await page.evaluate(() => innerWidth - document.documentElement.clientWidth)).toBe(0);
});

test("tutorial keeps editing usable and a first exercise saves without WebGL", async ({ page }) => {
  test.setTimeout(120_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixture required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `simple-flow-${randomUUID()}@example.test`, password = "SimpleWorkshop2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;

  try {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { configurable: true, value: function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
        return kind.startsWith("webgl") ? null : Reflect.apply(original, this, [kind, ...args]);
      } });
    });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Start here", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Create an exercise", exact: true }).click();
    const tutorial = page.getByRole("dialog", { name: "Workshop tutorial", exact: true });
    await expect(tutorial).toBeVisible();
    await expect(page.locator("[data-site-menu]")).toBeHidden();
    await expect(page.locator('[aria-label="Workshop editor"]')).not.toHaveAttribute("inert", "");
    await page.keyboard.press("Control+s");
    await expect(page.locator('[data-workshop-tutorial]')).toBeVisible();
    await tutorial.getByRole("button", { name: "Next tip", exact: true }).click();
    await page.reload();
    await expect(tutorial.getByLabel("Tutorial progress", { exact: true })).toHaveText(/2\s*\/\s*4/);
    await tutorial.getByRole("button", { name: "Close tutorial", exact: true }).click();
    await expect(tutorial).toHaveCount(0);
    await expect(page.getByText("3D preview needs WebGL.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Name and save", exact: true }).click();
    await page.getByLabel("Exercise name", { exact: true }).fill("No graphics exercise");
    await page.getByRole("button", { name: "Save privately", exact: true }).click();
    await expect(page.getByRole("article", { name: "Saved private exercise", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Add optional details", exact: true }).click();
    await expect(page).toHaveURL(/\/my-exercises\/[^/]+\/edit/);
    await page.getByRole("link", { name: "Open motion workshop", exact: true }).click();
    await expect(page.getByRole("heading", { name: "No graphics exercise", exact: true })).toBeVisible();
    await expect(page.getByText("3D preview needs WebGL.", { exact: true })).toBeVisible();
    mkdirSync(".local-artifacts/site-simplification", { recursive: true });
    await page.screenshot({ path: ".local-artifacts/site-simplification/workshop-desktop.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Tutorial", exact: true }).click();
    await expect(tutorial).toBeVisible();
    await page.screenshot({ path: ".local-artifacts/site-simplification/tutorial-mobile.png" });
    await tutorial.getByRole("button", { name: "Close tutorial", exact: true }).click();
    // Reload directly into a scroll-locked workshop, then leave through client navigation.
    await page.reload();
    await expect(page.getByText("3D preview needs WebGL.", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Exercise details", exact: true }).click();
    await expect(page).toHaveURL(/\/my-exercises\/[^/]+\/edit/);
    await expect(page.getByRole("heading", { name: "Edit exercise", exact: true })).toBeVisible();
    // A wheel event can arrive while client navigation is still releasing the workshop lock.
    await expect(async () => {
      await page.mouse.wheel(0, 800);
      expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
    }).toPass({ timeout: 5000 });
    await page.getByText("Description, equipment and classifications (optional)", { exact: true }).click();
    const description = page.getByLabel("Short description", { exact: true });
    await description.fill("Line\n".repeat(60));
    await description.scrollIntoViewIfNeeded();
    const thumb = description.locator("..").locator("[data-textarea-scrollbar]");
    await expect(thumb).toBeVisible();
    const bounds = (await thumb.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 4);
    await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 45); await page.mouse.up();
    await expect.poll(() => description.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    expect(await description.evaluate(element => {
      const area = element as HTMLTextAreaElement;
      const style = getComputedStyle(area);
      return area.offsetWidth - area.clientWidth - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
    })).toBe(0);
    expect(errors).toEqual([]);
  } finally { await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password }); }
});
