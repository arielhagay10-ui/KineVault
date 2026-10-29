import { openWorkshopDeviceRecovery } from "./workshop-menu.helpers";
import { selectWorkshopMoment } from "./workshop-menu.helpers";
import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { addWorkshopEquipment, openWorkshopMenu, setWorkshopLanguage } from "./workshop-menu.helpers";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/database.types";
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
    await expect(tutorial.getByRole("heading", { name: "Set up your scene", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add equipment", exact: true })).toHaveAttribute("data-tutorial-active", "true");
    await expect(page.locator("[data-tutorial-spotlight]")).toBeVisible();
    await expect(page.locator("[data-tutorial-dimmer]")).toBeVisible();
    const desktopPanel = await tutorial.boundingBox();
    const figurePreview = await page.locator("[data-workshop-preview]").boundingBox();
    expect(desktopPanel!.x).toBeGreaterThan(figurePreview!.x + figurePreview!.width / 2);
    expect(desktopPanel!.y).toBeGreaterThan(figurePreview!.y);
    await addWorkshopEquipment(page, "Dumbbell");
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
    await openWorkshopDeviceRecovery(page);
    await page.getByRole("button", { name: "Restore device draft", exact: true }).click();
    await expect(page.getByRole("combobox", { name: "Body joint", exact: true })).toHaveAttribute("data-tutorial-active", "true");
    await expect.poll(async () => {
      const spotlight = await page.locator("[data-tutorial-spotlight]").boundingBox();
      const controls = await page.locator('[data-tutorial-target="pose"]').boundingBox();
      return !!spotlight && !!controls && Math.abs(spotlight.x - controls.x + 5) < 1
        && Math.abs(spotlight.x + spotlight.width - controls.x - controls.width - 5) < 1
        && Math.abs(spotlight.y - controls.y + 5) < 1
        && Math.abs(spotlight.height - controls.height - 10) < 1;
    }).toBe(true);
    await expect(tutorial).toContainText("or select it directly in the scene");
    await page.screenshot({ path: ".local-artifacts/workshop/tutorial/desktop-pose.png" });
    await page.getByRole("button", { name: "Capture start", exact: true }).click();
    await selectWorkshopMoment(page, "Finish");
    await expect(page.getByRole("combobox", { name: "Body joint", exact: true })).toHaveAttribute("data-tutorial-active", "true");
    await tutorial.getByRole("button", { name: "Close tutorial", exact: true }).click();
    await expect(page.locator("[data-workshop-menu] > summary")).toBeFocused();
    await page.reload();
    await expect(page.getByRole("button", { name: "Tutorial", exact: true, includeHidden: true })).toHaveAttribute("aria-expanded", "false");
    await openWorkshopDeviceRecovery(page);
    await page.getByRole("button", { name: "Restore device draft", exact: true }).click();
    await page.getByRole("button", { name: "Capture start", exact: true }).click();
    await selectWorkshopMoment(page, "Finish");
    await page.getByRole("button", { name: "Capture pose", exact: true }).click();
    await page.getByLabel("Exercise name", { exact: true }).fill("My first workshop exercise");
    await page.getByRole("button", { name: "Save exercise", exact: true }).click();
    await expect(page.getByText(/Saved at.*Private/)).toBeVisible({ timeout: 30_000 });
    const cleanContext = await browser.newContext({ baseURL, storageState: { cookies: await context.cookies(), origins: [] } });
    try {
      const next = await cleanContext.newPage();
      await next.goto("/my-exercises/new");
      await openWorkshopMenu(next);
      await expect(next.getByRole("button", { name: "Tutorial", exact: true })).toHaveAttribute("aria-expanded", "false");
      await next.getByRole("button", { name: "Tutorial", exact: true }).click();
      await expect(next.getByRole("dialog", { name: "Workshop tutorial", exact: true })).toBeVisible();
      await next.getByRole("button", { name: "Close tutorial", exact: true }).click();
    } finally { await cleanContext.close(); }
    await setWorkshopLanguage(page, "he");
    await openWorkshopMenu(page);
    await page.getByRole("button", { name: "מדריך", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "מדריך הסדנה", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "סגירת המדריך", exact: true }).click();
    await setWorkshopLanguage(page, "en");
    await openWorkshopMenu(page);
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
    const savedId = new URL(page.url()).pathname.split("/")[2];
    const saved = page.waitForResponse(response => response.request().method() === "POST"
      && new URL(response.url()).pathname === `/my-exercises/${savedId}/workshop`
      && (response.request().postData()?.includes("Saved during the tutorial") ?? false));
    await page.getByRole("button", { name: "Save exercise", exact: true }).click();
    expect((await saved).ok()).toBe(true);
    const owner = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const signedIn = await owner.auth.signInWithPassword({ email, password });
    expect(signedIn.error).toBeNull();
    await expect.poll(async () => {
      const result = await owner.from("private_exercises").select("id,exercise_content(name)")
        .eq("id", savedId).eq("owner_id", account.data.user.id).single();
      if (result.error) throw result.error;
      return result.data.exercise_content?.name;
    }).toBe("Saved during the tutorial");
    // Revalidation can mount the saved route after the first save changed /new's URL.
    await expect(page.getByText(/^(Saved privately|Saved at .* · Private)$/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Saved during the tutorial", exact: true })).toBeVisible();
    await expect(tutorial).toBeVisible();
    await tutorial.getByRole("button", { name: "Finish tutorial", exact: true }).click();
    await expect(tutorial).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await openWorkshopMenu(page);
    await page.getByRole("button", { name: "Tutorial", exact: true }).click();
    await expect(tutorial.getByRole("heading", { name: "Set up your scene", exact: true })).toBeInViewport();
    const mobilePanel = await tutorial.boundingBox();
    // The fixed workspace keeps the active controls in view without page scrolling.
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
