import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { dismissWorkshopTutorial, jointField, openWorkshopTool, selectWorkshopJoint, selectWorkshopMoment } from "./workshop-menu.helpers";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });

test("duplicated poses stay independent through editing, capture and reload", async ({ page }) => {
  test.setTimeout(180_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `frame-independence-${randomUUID()}@example.test`, password = "FrameIndependence2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  try {
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/my-exercises/new");
    await dismissWorkshopTutorial(page);
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await page.getByLabel("Exercise name", { exact: true }).fill("Independent frames regression");
    await selectWorkshopJoint(page, "Left elbow");
    await jointField(page, "x").fill("70");
    await jointField(page, "x").press("Enter");
    await openWorkshopTool(page, "Timeline");
    const frames = page.getByRole("group", { name: "Saved poses", exact: true }).getByRole("button");
    await frames.first().focus();
    await page.keyboard.press("Control+d");
    await expect(frames).toHaveCount(4);
    await selectWorkshopMoment(page, "Start");
    await selectWorkshopJoint(page, "Left elbow");
    await jointField(page, "x").fill("80");
    await jointField(page, "x").press("Enter");
    const scrubber = page.getByLabel("Preview time", { exact: true });
    await scrubber.fill("800");
    await expect(jointField(page, "x")).toHaveValue("70");
    await scrubber.fill("0");
    await page.getByRole("button", { name: "Capture start", exact: true }).click();
    await scrubber.fill("800");
    await expect(jointField(page, "x")).toHaveValue("70");
    await scrubber.fill("3200");
    await jointField(page, "x").fill("40");
    await jointField(page, "x").press("Enter");
    await page.getByRole("button", { name: "Capture pose", exact: true }).click();
    await scrubber.fill("0");
    await jointField(page, "x").fill("90");
    await jointField(page, "x").press("Enter");
    await page.getByRole("button", { name: "Capture start", exact: true }).click();
    await scrubber.fill("3200");
    await expect(jointField(page, "x")).toHaveValue("40");
    await page.getByRole("button", { name: "Save exercise", exact: true }).click();
    await expect(page.getByText(/Saved at.*Private/)).toBeVisible();
    await page.reload();
    await dismissWorkshopTutorial(page);
    await selectWorkshopJoint(page, "Left elbow");
    for (const [time, angle] of [[0, 90], [800, 70], [3200, 40]]) {
      await scrubber.fill(String(time));
      await expect(jointField(page, "x")).toHaveValue(String(angle));
    }
  } finally {
    await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password });
  }
});
