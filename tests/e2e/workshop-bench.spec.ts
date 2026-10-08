import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { dismissWorkshopTutorial } from "./workshop-menu.helpers";
import { setWorkshopMode, selectWorkshopObject } from "./workshop-menu.helpers";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { createStudioObject } from "../../src/lib/motion/studio";
import { blankWorkshopScene, identityTransform } from "../../src/lib/motion/workshop";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });

test.beforeEach(async ({ page }) => page.setDefaultTimeout(60_000));

test("bench positions stay visible, follow the pad, and survive save and reload", async ({ page }) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(60_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `bench-${randomUUID()}@example.test`, password = "BenchFixture2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;

  try {
    const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    await owner.auth.signInWithPassword({ email, password });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const benchId = randomUUID(), artifacts = ".local-artifacts/workshop/bench-positions";
    mkdirSync(artifacts, { recursive: true });
    const scene = { ...blankWorkshopScene, studio: { body: identityTransform,
      objects: [{ ...createStudioObject("bench", benchId, 0), ...identityTransform, benchAngle: 0 }],
      seating: { benchId, facing: "front" as const } },
    keyframes: [0, 1600, 3200].map(timeMs => ({ timeMs, poses: { "left-elbow": { x: timeMs === 1600 ? 90 : 20, y: 0, z: 0 } } })) };
    const created = await owner.rpc("create_workshop_exercise", { p_scene: scene });
    if (created.error) throw created.error;
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/my-exercises/${created.data}/workshop`);
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Start and finish", exact: true }).click();
    await page.getByText("Grip and equipment options", { exact: true }).click();
    const controls = page.getByRole("region", { name: "Bench body position", exact: true }).filter({ visible: true });
    await expect(controls).toBeVisible();
    await setWorkshopMode(page, "advanced");
    await selectWorkshopObject(page, "Adjustable bench");
    await expect(page.getByRole("tab", { name: "Contacts", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(controls).toBeInViewport();
    await expect(page.getByLabel("Position X meters", { exact: true })).not.toBeVisible();
    await page.screenshot({ path: `${artifacts}/desktop-controls.png`, fullPage: true });
    await page.getByRole("button", { name: "Side", exact: true }).click();
    for (const [facing, label] of [["supine", "Lie face up"], ["prone", "Lie face down"]] as const) {
      await page.getByRole("tab", { name: "Contacts", exact: true }).click();
      await controls.getByRole("button", { name: label, exact: true }).click();
      await expect(controls.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true");
      await expect(controls.getByLabel("Sitting direction")).toHaveCount(0);
      for (const angle of [0, 25, 45, 85]) {
        await controls.getByLabel("Bench pad angle degrees", { exact: true }).fill(String(angle));
        await controls.getByLabel("Bench pad angle degrees", { exact: true }).press("Enter");
        await expect(controls.getByLabel("Bench pad angle degrees", { exact: true })).toHaveValue(String(angle));
        await page.locator("canvas").screenshot({ path: `${artifacts}/${facing}-${angle}.png` });
      }
      await controls.getByRole("button", { name: "Flat", exact: true }).click();
      await expect(controls.getByLabel("Bench pad angle degrees", { exact: true })).toHaveValue("0");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByText(/Saved at.*Private/)).toBeVisible({ timeout: 20_000 });
      const saved = await owner.from("private_exercises").select("content_id").eq("id", created.data).single();
      const stored = await owner.from("exercise_scenes").select("studio_layout").eq("content_id", saved.data!.content_id).single();
      if (stored.error) throw stored.error;
      expect(stored.data.studio_layout).toMatchObject({ seating: { benchId, facing }, objects: [{ benchAngle: 0 }] });
      await page.reload();
      await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
      await page.getByRole("button", { name: "Start and finish", exact: true }).click();
      await page.getByText("Grip and equipment options", { exact: true }).click();
      await expect(controls.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true");
      await setWorkshopMode(page, "advanced");
      await page.getByRole("tab", { name: "Timeline", exact: true }).click();
      for (let frame = 0; frame <= 16; frame++) {
        await page.getByLabel("Scrub timeline").evaluate((element, value) => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, String(value));
          element.dispatchEvent(new Event("input", { bubbles: true }));
        }, frame * 200);
        await expect(page.getByLabel("Scrub timeline")).toHaveValue(String(frame * 200));
        if (frame % 2 === 0) await page.locator("canvas").screenshot({ path: `${artifacts}/${facing}-saved-side-${frame}.png` });
      }
      await page.getByRole("button", { name: "Three-quarter", exact: true }).click();
      for (let frame = 0; frame <= 8; frame++) {
        await page.getByLabel("Scrub timeline").evaluate((element, value) => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, String(value));
          element.dispatchEvent(new Event("input", { bubbles: true }));
        }, frame * 400);
        await page.locator("canvas").screenshot({ path: `${artifacts}/${facing}-saved-three-quarter-${frame}.png` });
      }
      await page.getByRole("button", { name: "Side", exact: true }).click();
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
      await page.waitForTimeout(3500);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
    }
    await setWorkshopMode(page, "quick");
    await page.getByRole("button", { name: "Start and finish", exact: true }).click();
    await page.getByText("Grip and equipment options", { exact: true }).click();
    await expect(controls).toBeVisible();
    await controls.getByRole("button", { name: "Sit", exact: true }).click();
    for (const facing of ["front", "left", "right"]) {
      await controls.getByLabel("Sitting direction").selectOption(facing);
      await expect(controls.getByLabel("Sitting direction")).toHaveValue(facing);
    }
    await controls.getByRole("button", { name: "Chest supported", exact: true }).click();
    await expect(controls.getByRole("button", { name: "Chest supported", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.setViewportSize({ width: 390, height: 844 });
    await controls.scrollIntoViewIfNeeded();
    for (const label of ["Lie face up", "Lie face down", "Sit", "Chest supported"]) {
      await controls.getByRole("button", { name: label, exact: true }).click();
      await expect(controls.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `${artifacts}/mobile-controls.png` });
    await controls.getByRole("button", { name: "Leave bench", exact: true }).click();
    await expect(controls.getByRole("button", { name: "Leave bench", exact: true })).toHaveCount(0);
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto("/my-exercises/new");
    await dismissWorkshopTutorial(page);
    await page.getByRole("button", { name: "Add equipment", exact: true }).filter({ visible: true }).click();
    await page.getByRole("dialog").getByRole("searchbox").fill("bench");
    await page.getByRole("dialog").getByRole("button", { name: "Adjustable bench", exact: true }).first().click();
    await page.getByRole("button", { name: "Start and finish", exact: true }).click();
    await page.getByText("Grip and equipment options", { exact: true }).click();
    await expect(controls.getByRole("button", { name: "Lie face up", exact: true })).toBeVisible();
    await controls.getByRole("button", { name: "Lie face up", exact: true }).click();
    await expect(controls.getByRole("button", { name: "Lie face up", exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(errors).toEqual([]);
  } finally { await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password }); }
});
