import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { setWorkshopLanguage } from "./workshop-menu.helpers";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });
test.beforeEach(async ({ page }) => page.setDefaultTimeout(60_000));

test("tutorial points to usable controls, resumes and remains optional on later exercises", async ({ page, context, browser, baseURL }) => {
  test.setTimeout(180_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `tutorial-${randomUUID()}@example.test`, password = "WorkshopTutorial2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;

  try {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/my-exercises/new");
    const tutorial = page.getByRole("dialog", { name: "Workshop tutorial", exact: true });
    await expect(tutorial.getByRole("heading", { name: "Choose your equipment", exact: true })).toBeVisible();
    await expect(page.locator('[data-tutorial-target="equipment"]')).toHaveAttribute("data-tutorial-active", "true");
    await expect(page.locator("[data-tutorial-spotlight]")).toBeVisible();
    await expect(page.locator("[data-tutorial-dimmer]")).toBeVisible();
    const desktopPanel = await tutorial.boundingBox();
    const figurePreview = await page.locator("[data-workshop-preview]").boundingBox();
    expect(desktopPanel!.x).toBeGreaterThan(figurePreview!.x + figurePreview!.width / 2);
    expect(desktopPanel!.y).toBeGreaterThan(figurePreview!.y);
    await page.getByRole("button", { name: "Dumbbell", exact: true }).click();
    await expect(tutorial).toBeVisible();
    mkdirSync(".local-artifacts/workshop/tutorial", { recursive: true });
    await page.screenshot({ path: ".local-artifacts/workshop/tutorial/desktop.png" });
    await tutorial.getByRole("button", { name: "Next tip", exact: true }).click();
    await expect.poll(async () => {
      const panel = await tutorial.boundingBox();
      return !!panel && !!desktopPanel && panel.x === desktopPanel.x && panel.y === desktopPanel.y && panel.height === desktopPanel.height;
    }).toBe(true);
    await page.reload();
    await expect(tutorial.getByRole("heading", { name: "Build the movement", exact: true })).toBeVisible();
    await expect(page.locator('[data-tutorial-target="pose"]')).toHaveAttribute("data-tutorial-active", "true");
    await expect.poll(async () => {
      const spotlight = await page.locator("[data-tutorial-spotlight]").boundingBox();
      const start = await page.getByRole("button", { name: "Edit start", exact: true }).boundingBox();
      const finish = await page.getByRole("button", { name: "Edit finish", exact: true }).boundingBox();
      return !!spotlight && !!start && !!finish && Math.abs(spotlight.x - start.x + 5) < 1
        && Math.abs(spotlight.x + spotlight.width - finish.x - finish.width - 5) < 1;
    }).toBe(true);
    await page.screenshot({ path: ".local-artifacts/workshop/tutorial/desktop-pose.png" });
    await page.getByRole("button", { name: "Edit finish", exact: true }).click();
    await page.getByRole("button", { name: "Advanced editing", exact: true }).click();
    await tutorial.getByRole("button", { name: "Return to this tip", exact: true }).click();
    await expect(page.locator('[data-tutorial-target="pose"]')).toHaveAttribute("data-tutorial-active", "true");
    await tutorial.getByRole("button", { name: "Close tutorial", exact: true }).click();
    await expect(page.getByRole("button", { name: "Tutorial", exact: true })).toBeFocused();
    await page.reload();
    await expect(page.getByRole("button", { name: "Tutorial", exact: true })).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("button", { name: "Name and save", exact: true }).click();
    await page.getByLabel("Exercise name", { exact: true }).fill("My first workshop exercise");
    await page.getByRole("button", { name: "Save privately", exact: true }).click();
    await expect(page.getByRole("article", { name: "Saved private exercise", exact: true })).toBeVisible();
    const cleanContext = await browser.newContext({ baseURL, storageState: { cookies: await context.cookies(), origins: [] } });
    try {
      const next = await cleanContext.newPage();
      await next.goto("/my-exercises/new");
      await expect(next.getByRole("button", { name: "Tutorial", exact: true })).toHaveAttribute("aria-expanded", "false");
      await next.getByRole("button", { name: "Tutorial", exact: true }).click();
      await expect(next.getByRole("dialog", { name: "Workshop tutorial", exact: true })).toBeVisible();
      await next.getByRole("button", { name: "Close tutorial", exact: true }).click();
    } finally { await cleanContext.close(); }
    await setWorkshopLanguage(page, "he");
    await page.getByRole("button", { name: "מדריך", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "מדריך הסדנה", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "סגירת המדריך", exact: true }).click();
    await setWorkshopLanguage(page, "en");
    await page.getByRole("button", { name: "Tutorial", exact: true }).click();
    for (let index = 0; index < 3; index++) {
      await tutorial.getByRole("button", { name: "Next tip", exact: true }).click();
      await expect(page.locator("[data-tutorial-active]")).toBeInViewport();
      if (index === 1) {
        await page.getByRole("button", { name: "Play", exact: true }).click();
        await page.getByRole("button", { name: "Pause", exact: true }).click();
      }
    }
    await page.getByLabel("Exercise name", { exact: true }).fill("Saved during the tutorial");
    await page.getByRole("button", { name: "Save privately", exact: true }).click();
    await expect(page.getByRole("article", { name: "Saved private exercise", exact: true })).toContainText("Saved during the tutorial");
    await expect(tutorial).toBeVisible();
    await tutorial.getByRole("button", { name: "Finish tutorial", exact: true }).click();
    await expect(tutorial).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Tutorial", exact: true }).click();
    await expect(tutorial.getByRole("heading", { name: "Choose your equipment", exact: true })).toBeInViewport();
    const mobilePanel = await tutorial.boundingBox();
    await page.locator('[data-workshop="studio"]').evaluate(element => element.scrollTo({ top: 0 }));
    await tutorial.getByRole("button", { name: "Return to this tip", exact: true }).click();
    await expect(page.locator("[data-tutorial-spotlight]")).toBeVisible();
    await expect.poll(() => tutorial.locator('[id$="-tips"]').evaluate(element => element.scrollTop)).toBe(0);
    for (let index = 0; index < 4; index++) {
      const target = page.locator("[data-tutorial-active]");
      await expect(target).toBeInViewport();
      await expect.poll(async () => {
        const feature = await page.locator("[data-tutorial-spotlight]").boundingBox(), guide = await tutorial.boundingBox();
        return !!feature && !!guide && (guide.x + guide.width <= feature.x || guide.x >= feature.x + feature.width || guide.y + guide.height <= feature.y || guide.y >= feature.y + feature.height);
      }).toBe(true);
      const pointer = page.locator('[data-tutorial-pointer]');
      await expect(pointer).toBeVisible();
      await expect(pointer).toHaveAttribute("data-tutorial-direction", /^(up|down|left|right)$/);
      await expect.poll(async () => {
        const figure = await pointer.boundingBox(), feature = await page.locator("[data-tutorial-spotlight]").boundingBox();
        if (!figure || !feature) return false;
        const direction = await pointer.getAttribute("data-tutorial-direction");
        if (direction === "up") return figure.y >= feature.y + feature.height;
        if (direction === "down") return figure.y + figure.height <= feature.y;
        if (direction === "left") return figure.x >= feature.x + feature.width;
        return figure.x + figure.width <= feature.x;
      }).toBe(true);
      expect(await tutorial.locator('[data-tutorial-pointer]').count()).toBe(0);
      const panel = await tutorial.boundingBox();
      expect(panel?.x).toBe(mobilePanel?.x);
      expect(panel?.y).toBe(mobilePanel?.y);
      expect(panel?.height).toBe(mobilePanel?.height);
      if (index === 2) {
        await expect(target).toHaveText("Play");
        await target.click({ timeout: 5000 });
        await expect(target).toHaveText("Pause");
        await target.click();
      }
      await expect.poll(async () => {
        const feature = await target.boundingBox(), highlight = await page.locator("[data-tutorial-spotlight]").boundingBox();
        return !!feature && !!highlight && Math.abs(feature.x - highlight.x - 5) < 1 && highlight.y >= feature.y - 5;
      }).toBe(true);
      await page.screenshot({ path: `.local-artifacts/workshop/tutorial/mobile-${index}.png` });
      if (index < 3) await tutorial.getByRole("button", { name: "Next tip", exact: true }).click();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: ".local-artifacts/workshop/tutorial/mobile.png" });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(tutorial).toBeInViewport();
    await expect(page.locator('[data-tutorial-pointer]')).toBeVisible();
    await expect(page.locator('[data-tutorial-pointer]')).toHaveCSS("transition-property", "none");
    await page.keyboard.press("Escape");
    await expect(tutorial).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password }); }
});
