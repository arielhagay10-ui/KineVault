import { mkdirSync } from "node:fs";
import { setWorkshopMode, setWorkshopLanguage, selectWorkshopObject, expandWorkshopControls } from "./workshop-menu.helpers";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page, type Locator } from "@playwright/test";
import { PerspectiveCamera, Vector3 } from "three";
import { createQuickScene } from "../../src/lib/motion/quick-create";
import { createStudioObject } from "../../src/lib/motion/studio";
import { fitWorkshopCamera } from "../../src/lib/motion/workshop-camera";
import { blankWorkshopScene } from "../../src/lib/motion/workshop";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });
const folder = ".local-artifacts/workshop/mouse";
async function drag(page: Page, handle: Locator, dx: number, dy: number, cancel = false) {
  await handle.scrollIntoViewIfNeeded();
  const bounds = (await handle.boundingBox())!;
  const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 12 });
  if (cancel) await page.keyboard.press("Escape");
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => page.setDefaultTimeout(15_000));

test("mouse handles edit row and pec deck endpoints with Undo, cancellation and saved motion", async ({ page }) => {
  test.setTimeout(180_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `mouse-${Date.now()}@example.test`, password = "MouseFixture2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  await owner.auth.signInWithPassword({ email, password });
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  mkdirSync(folder, { recursive: true });
  try {
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/);
    const scene = createQuickScene("cable-row-machine"); scene.studio!.presentation!.highlight = "group:abs";
    const created = await owner.rpc("create_workshop_exercise", { p_scene: scene }); if (created.error) throw created.error;
    await page.goto(`/my-exercises/${created.data}/workshop`);
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Side", exact: true }).click();
    await page.getByRole("button", { name: "Drag finish", exact: true }).click();
    const handle = page.getByRole("button", { name: "Drag Cable row handle", exact: true });
    const height = page.getByRole("textbox", { name: "Finish handle height meters", exact: true });
    const travel = page.getByRole("textbox", { name: "Finish Row pull percent", exact: true });
    await expect(handle).toBeVisible();
    await drag(page, handle, -45, -35);
    await expect.poll(async () => Number(await height.inputValue())).toBeGreaterThan(1.23);
    await expect.poll(async () => Number(await travel.inputValue())).toBeLessThan(100);
    const movedHeight = await height.inputValue(), movedTravel = await travel.inputValue();
    await page.getByRole("button", { name: "Undo", exact: true }).first().click();
    await expect(height).toHaveValue("1.23"); await expect(travel).toHaveValue("100");
    await page.getByRole("button", { name: "Redo", exact: true }).first().click();
    await expect(height).toHaveValue(movedHeight); await expect(travel).toHaveValue(movedTravel);
    await page.getByRole("button", { name: "Drag finish", exact: true }).click();
    await drag(page, handle, 20, -20, true);
    await expect(height).toHaveValue(movedHeight); await expect(travel).toHaveValue(movedTravel);
    await page.getByRole("button", { name: "Drag finish", exact: true }).click();
    await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
    await handle.press("ArrowUp");
    await expect.poll(async () => Number(await height.inputValue())).toBeGreaterThan(Number(movedHeight));
    await page.getByRole("button", { name: "Undo", exact: true }).first().click();
    await expect(height).toHaveValue(movedHeight);
    await page.getByRole("button", { name: "Drag finish", exact: true }).click();
    await page.screenshot({ path: `${folder}/mouse-controls.png`, fullPage: true });
    await page.getByRole("button", { name: "Name and save", exact: true }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("article", { name: "Saved private exercise" })).toBeVisible();
    await page.reload(); await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible();
    await expect(height).toHaveValue(movedHeight); await expect(travel).toHaveValue(movedTravel);
    await expect(page.getByRole("textbox", { name: "Start handle height meters", exact: true })).toHaveValue("1.23");
    const record = await owner.from("private_exercises").select("content_id").eq("id", created.data).single(); if (record.error) throw record.error;
    const stored = await owner.from("exercise_scenes").select("studio_layout").eq("content_id", record.data.content_id).single(); if (stored.error) throw stored.error;
    expect(stored.data.studio_layout).toMatchObject({ presentation: { highlight: "group:abs" }, objects: [{ x: 0, y: 0, z: 0 }] });
    for (const view of ["Three-quarter", "Side"]) {
      await page.getByRole("button", { name: view, exact: true }).click();
      for (let i = 0; i <= 16; i++) {
        await page.getByLabel("Preview time", { exact: true }).fill(String(scene.durationMs * i / 16));
        await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
        await page.locator("canvas").screenshot({ path: `${folder}/${view.toLowerCase()}-${i}.png` });
      }
    }
    for (const speed of ["1", "0.25"]) {
      await page.getByLabel("Preview speed", { exact: true }).selectOption(speed);
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await page.waitForTimeout(scene.durationMs / Number(speed) + 400);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
    }
    for (const mode of ["regular", "reverse"] as const) {
      const pec = createQuickScene("pec-deck"); pec.studio!.objects[0].machineMode = mode;
      const saved = await owner.rpc("create_workshop_exercise", { p_scene: pec }); if (saved.error) throw saved.error;
      await page.goto(`/my-exercises/${saved.data}/workshop`); await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible();
      await page.getByRole("button", { name: "Front", exact: true }).click();
      await page.getByRole("button", { name: "Drag finish", exact: true }).click();
      const grips = page.getByRole("button", { name: "Drag Pec deck handle", exact: true }); await expect(grips).toHaveCount(2);
      const field = page.getByRole("textbox", { name: `Finish ${mode === "reverse" ? "Arm opening" : "Arm closure"} percent`, exact: true });
      await drag(page, grips.first(), 45, 0);
      await expect.poll(async () => Number(await field.inputValue())).toBeLessThan(100);
      const changed = await field.inputValue();
      await page.getByRole("button", { name: "Undo", exact: true }).first().click(); await expect(field).toHaveValue("100");
      await page.getByRole("button", { name: "Redo", exact: true }).first().click(); await expect(field).toHaveValue(changed);
      await page.getByRole("button", { name: "Drag finish", exact: true }).click();
      await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
      await grips.first().press("ArrowLeft");
      await expect.poll(async () => Number(changed) - Number(await field.inputValue())).toBeGreaterThan(1.5);
      await expect.poll(async () => Number(changed) - Number(await field.inputValue())).toBeLessThan(3.5);
      await page.getByRole("button", { name: "Undo", exact: true }).first().click();
      await expect(field).toHaveValue(changed);
      await page.getByRole("button", { name: "Drag finish", exact: true }).click();
      await page.locator('[data-workshop-preview]').screenshot({ path: `${folder}/pec-${mode}.png` });
    }
    await setWorkshopLanguage(page, "he");
    await expect(page.getByRole("button", { name: "הזזה עם העכבר", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "גרירת ידית פרפר", exact: true })).toHaveCount(2);
    await page.setViewportSize({ width: 320, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally { await admin.auth.admin.deleteUser(account.data.user.id); }
});

test("equipment can be lifted with the mouse or moved along the floor", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `mouse-weight-${Date.now()}@example.test`, password = "MouseFixture2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true }); if (account.error) throw account.error;
  const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  await owner.auth.signInWithPassword({ email, password });
  try {
    const weight = { ...createStudioObject("dumbbell", crypto.randomUUID(), 0), x: 1.4, y: 1.1, z: 0, attachment: "none" as const };
    const scene = { ...blankWorkshopScene, studio: { ...blankWorkshopScene.studio!, objects: [weight] } };
    const created = await owner.rpc("create_workshop_exercise", { p_scene: scene }); if (created.error) throw created.error;
    await page.setViewportSize({ width: 1500, height: 1100 }); await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/my-exercises/${created.data}/workshop`); await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await setWorkshopMode(page, "advanced");
    await page.getByRole("button", { name: "Move with mouse", exact: true }).click();
    await page.getByRole("button", { name: "Front", exact: true }).click();
    await selectWorkshopObject(page, "Dumbbell");
    await page.getByRole("tab", { name: "Position", exact: true }).click();
    await expandWorkshopControls(page, "Precise placement");
    const height = page.getByRole("textbox", { name: "Position Y meters", exact: true });
    const canvas = page.locator("canvas");
    const moveWeight = async () => {
      await canvas.scrollIntoViewIfNeeded(); const bounds = (await canvas.boundingBox())!;
      const fit = fitWorkshopCamera(scene, "front", bounds.width / bounds.height, 34);
      const camera = new PerspectiveCamera(34, bounds.width / bounds.height, .1, 100);
      camera.position.copy(fit.position); camera.lookAt(fit.target); camera.updateMatrixWorld();
      const point = new Vector3(weight.x, weight.y + .2, weight.z).project(camera);
      const x = bounds.x + (point.x + 1) * bounds.width / 2, y = bounds.y + (1 - point.y) * bounds.height / 2;
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 25, y - 50, { steps: 12 }); await page.mouse.up();
    };
    await moveWeight(); await expect.poll(async () => Number(await height.inputValue())).toBeGreaterThan(1.1);
    await page.getByRole("button", { name: "Undo", exact: true }).first().click(); await expect(height).toHaveValue("1.1");
    await expandWorkshopControls(page, "Drag options");
    await page.getByRole("button", { name: "Along floor", exact: true }).click();
    await moveWeight(); await expect(height).toHaveValue("1.1");
    await expect.poll(async () => Number(await page.getByRole("textbox", { name: "Position X meters", exact: true }).inputValue())).toBeGreaterThan(1.4);
    expect(errors).toEqual([]);
  } finally { await admin.auth.admin.deleteUser(account.data.user.id); }
});
