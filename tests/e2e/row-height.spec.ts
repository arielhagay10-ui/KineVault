import { selectWorkshopObject, openWorkshopTool, setWorkshopLanguage } from "./workshop-menu.helpers";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { createQuickScene } from "../../src/lib/motion/quick-create";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });
test.beforeEach(async ({ page }) => page.setDefaultTimeout(60_000));

test("row start and finish heights move independently and survive private save/reload", async ({ page }) => {
  test.setTimeout(180_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `row-height-${Date.now()}@example.test`, password = "RowHeightFixture2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  await owner.auth.signInWithPassword({ email, password });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const folder = ".local-artifacts/workshop/row-height";
  mkdirSync(folder, { recursive: true });
  try {
    const scene = createQuickScene("cable-row-machine");
    scene.studio!.presentation!.highlight = "group:abs";
    const created = await owner.rpc("create_workshop_exercise", { p_scene: scene });
    if (created.error) throw created.error;
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/my-exercises/${created.data}/workshop`);
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Start and finish", exact: true }).click();
    const start = page.getByRole("textbox", { name: "Start handle height meters", exact: true });
    const finish = page.getByRole("textbox", { name: "Finish handle height meters", exact: true });
    await expect(start).toHaveValue("1.23");
    await start.fill("1.1"); await start.press("Enter");
    await finish.fill("1.45"); await finish.press("Enter");
    await page.getByRole("button", { name: "Name and save", exact: true }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("article", { name: "Saved private exercise" })).toBeVisible();
    await page.reload({ waitUntil: "commit", timeout: 60_000 });
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Start and finish", exact: true }).click();
    await expect(start).toHaveValue("1.1"); await expect(finish).toHaveValue("1.45");
    await page.getByRole("region", { name: "Playback controls" }).getByRole("button", { name: "View finish", exact: true }).click();
    await page.screenshot({ path: `${folder}/controls.png`, fullPage: true });
    for (const view of ["Three-quarter", "Side"]) {
      await page.getByRole("button", { name: view, exact: true }).click();
      for (let i = 0; i <= 16; i++) {
        await page.getByLabel("Preview time", { exact: true }).fill(String(scene.durationMs * i / 16));
        await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
        await page.locator("canvas").screenshot({ path: `${folder}/${view.toLowerCase()}-${i}.png`, timeout: 60_000 });
      }
    }
    for (const speed of ["1", "0.25"]) {
      await page.getByLabel("Preview speed", { exact: true }).selectOption(speed);
      await page.getByRole("button", { name: "Play", exact: true }).click();
      const time = await page.getByLabel("Preview time", { exact: true }).inputValue();
      await expect.poll(() => page.getByLabel("Preview time", { exact: true }).inputValue()).not.toBe(time);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
    }
    const record = await owner.from("private_exercises").select("content_id").eq("id", created.data).single();
    if (record.error) throw record.error;
    const stored = await owner.from("exercise_scenes").select("studio_layout").eq("content_id", record.data.content_id).single();
    if (stored.error) throw stored.error;
    expect(stored.data.studio_layout).toMatchObject({ presentation: { highlight: "group:abs" }, objects: [{ machineHandleHeight: 1.1 }] });
    const layout = stored.data.studio_layout as { objects: { frames: { timeMs: number; machineHandleHeight: number }[] }[] };
    expect(layout.objects[0].frames.find(frame => frame.timeMs === scene.durationMs / 2)?.machineHandleHeight).toBe(1.45);
    await page.reload({ waitUntil: "commit", timeout: 60_000 });
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Start and finish", exact: true }).click();
    await expect(start).toHaveValue("1.1"); await expect(finish).toHaveValue("1.45");
    await page.getByRole("button", { name: "Small range", exact: true }).click();
    await expect(start).toHaveValue("1.1"); await expect(finish).toHaveValue("1.45");
    await page.getByRole("button", { name: "Advanced editing", exact: true }).click();
    await selectWorkshopObject(page, "Cable row");
    await openWorkshopTool(page, "Timeline");
    await expect(page.getByRole("textbox", { name: "Handle height meters", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Quick create", exact: true }).click();
    await setWorkshopLanguage(page, "he");
    await expect(page.getByRole("textbox", { name: "גובה הידית בהתחלה במטרים", exact: true })).toBeVisible();
    await page.setViewportSize({ width: 320, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto("/my-exercises");
    const card = page.getByRole("article");
    await expect(card).toHaveCount(1);
    await card.getByRole("button", { name: "Preview saved motion", exact: true }).click();
    await expect(card.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await card.getByRole("button", { name: "Play", exact: true }).click();
    await page.waitForTimeout(scene.durationMs + 800);
    await card.getByRole("button", { name: "Pause", exact: true }).click();
    await card.screenshot({ path: `${folder}/saved-library.png`, timeout: 60_000 });
    expect(errors).toEqual([]);
  } finally { await admin.auth.admin.deleteUser(account.data.user.id); }
});
