import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { machineDemoScene } from "../../src/lib/motion/studio-machines";
import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { dismissWorkshopTutorial, jointField, openWorkshopTool, selectWorkshopJoint, selectWorkshopMoment, selectWorkshopObject } from "./workshop-menu.helpers";

test.use({ viewport: { width: 1440, height: 1000 }, launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });

test("plate row adjusts seat, grips and individual arms without losing seating or saved travel", async ({ page }) => {
  test.setTimeout(240_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `row-${randomUUID()}@example.test`, password = "RowFixture2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  mkdirSync(".local-artifacts/plate-row", { recursive: true });
  try {
    await owner.auth.signInWithPassword({ email, password });
    const scene = machineDemoScene("row-machine", randomUUID());
    scene.studio!.presentation!.highlight = "none";
    const created = await owner.rpc("create_workshop_exercise", { p_scene: scene });
    if (created.error) throw created.error;
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/my-exercises/${created.data}/workshop`);
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-equipment-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await dismissWorkshopTutorial(page);
    await selectWorkshopObject(page, "Plate-loaded row");
    const seat = page.getByLabel("Seat height centimeters", { exact: true });
    await seat.fill("70"); await seat.press("Enter");
    await expect(seat).toHaveValue("70");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(seat).toHaveValue("66");
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(seat).toHaveValue("70");
    await seat.fill("66"); await seat.press("Enter");
    for (const grip of ["neutral", "wide"]) {
      await page.getByLabel("Row grip", { exact: true }).selectOption(grip);
      for (const view of ["Three-quarter", "Side"]) {
        await page.getByRole("button", { name: view, exact: true }).click();
        for (let index = 0; index <= 16; index += 2) {
          await page.getByRole("combobox", { name: "Editing pose", exact: true }).selectOption(String(index));
          await page.screenshot({ path: `.local-artifacts/plate-row/${grip}-${view}-${index}.png` });
        }
      }
    }
    await selectWorkshopMoment(page, "Finish");
    await openWorkshopTool(page, "Contacts");
    await page.getByRole("button", { name: "Hold with left hand", exact: true }).click();
    await expect(page.getByRole("button", { name: "Stop using machine", exact: true })).toBeVisible();
    await page.getByLabel("Left lever pull percent", { exact: true }).fill("75");
    await page.getByLabel("Left lever pull percent", { exact: true }).press("Enter");
    await expect(page.getByLabel("Right lever pull percent", { exact: true })).toHaveValue("0");
    await page.getByRole("button", { name: "Select", exact: true }).click();
    const handle = page.getByRole("button", { name: "Drag Left Plate-loaded row handle", exact: true });
    await expect(handle).toBeHidden();
    await selectWorkshopJoint(page, "Right elbow");
    const elbow = jointField(page, "x");
    await expect(elbow).toBeEnabled();
    await elbow.fill("80"); await elbow.press("Enter");
    await expect(elbow).toHaveValue("80");
    await selectWorkshopJoint(page, "Left shoulder");
    await expect(jointField(page, "x")).toBeEnabled();
    await page.getByRole("button", { name: "Three-quarter", exact: true }).click();
    await page.screenshot({ path: ".local-artifacts/plate-row/unilateral.png" });
    await selectWorkshopObject(page, "Plate-loaded row");
    await openWorkshopTool(page, "Contacts");
    await page.getByRole("button", { name: "Hold with both hands", exact: true }).click();
    await page.getByLabel("Left lever pull percent", { exact: true }).fill("75");
    await page.getByLabel("Left lever pull percent", { exact: true }).press("Enter");
    await page.getByLabel("Right lever pull percent", { exact: true }).fill("40");
    await page.getByLabel("Right lever pull percent", { exact: true }).press("Enter");
    const beforePlayback = await page.getByText(/^Preview time /).innerText();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await expect.poll(() => page.getByText(/^Preview time /).innerText()).not.toBe(beforePlayback);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByRole("button", { name: "Save exercise", exact: true }).click();
    await expect(page.getByText(/Saved at.*Private/)).toBeVisible();
    await page.reload();
    await expect(page.locator('[data-equipment-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await selectWorkshopObject(page, "Plate-loaded row");
    await selectWorkshopMoment(page, "Finish");
    await expect(page.getByLabel("Row grip", { exact: true })).toHaveValue("wide");
    await expect(page.getByLabel("Seat height centimeters", { exact: true })).toHaveValue("66");
    await expect(page.getByLabel("Left lever pull percent", { exact: true })).toHaveValue("75");
    await expect(page.getByLabel("Right lever pull percent", { exact: true })).toHaveValue("40");
    await page.setViewportSize({ width: 390, height: 844 });
    await openWorkshopTool(page, "Item settings");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByLabel("Row grip", { exact: true })).toBeVisible();
    await page.screenshot({ path: ".local-artifacts/plate-row/mobile.png" });
    expect(errors).toEqual([]);
  } finally { await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password }); }
});
