import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { jointField, selectWorkshopJoint, selectWorkshopMoment } from "./workshop-menu.helpers";
import { draftRecoveryKey } from "../../src/lib/motion/workshop-draft";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });

test("recovering an uncaptured start seeds finish, while authored finish work stays intact", async ({ page }) => {
  test.setTimeout(180_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `first-capture-${randomUUID()}@example.test`, password = `Capture-${randomUUID()}!`;
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  const key = draftRecoveryKey(account.data.user.id, null);
  mkdirSync(".local-artifacts/first-capture", { recursive: true });
  try {
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/my-exercises/new");
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await selectWorkshopJoint(page, "Left elbow");
    await jointField(page, "x").fill("70"); await jointField(page, "x").press("Enter");
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "null")?.scene.keyframes[0].poses["left-elbow"]?.x, key)).toBe(70);
    await page.reload();
    await page.getByRole("button", { name: "Restore device draft", exact: true }).click();
    await page.getByRole("button", { name: "Capture start", exact: true }).click();
    await selectWorkshopMoment(page, "Finish");
    await selectWorkshopJoint(page, "Left elbow");
    await expect(jointField(page, "x")).toHaveValue("70");
    await page.screenshot({ path: ".local-artifacts/first-capture/recovered-first-finish.png" });

    await jointField(page, "x").fill("90"); await jointField(page, "x").press("Enter");
    await page.getByRole("button", { name: "Capture pose", exact: true }).click();
    await page.reload();
    await page.getByRole("button", { name: "Restore device draft", exact: true }).click();
    await selectWorkshopJoint(page, "Left elbow");
    await jointField(page, "x").fill("80"); await jointField(page, "x").press("Enter");
    await page.getByRole("button", { name: "Capture start", exact: true }).click();
    await selectWorkshopMoment(page, "Finish");
    await expect(jointField(page, "x")).toHaveValue("90");

    // Older device drafts have no capture metadata; never discard their finish pose.
    const legacy = await page.evaluate(key => {
      const { scene, name, privateId, confirmed, sessionId, updatedAt } = JSON.parse(localStorage.getItem(key)!);
      return JSON.stringify({ scene, name, privateId, confirmed, sessionId, updatedAt });
    }, key);
    await page.goto("/dashboard");
    await page.evaluate(({ key, legacy }) => localStorage.setItem(key, legacy), { key, legacy });
    await page.goto("/my-exercises/new");
    await page.getByRole("button", { name: "Restore device draft", exact: true }).click();
    await page.getByRole("button", { name: "Capture start", exact: true }).click();
    await expect(page.getByText("Start captured. Existing finish kept; use Copy pose to replace it.", { exact: true })).toBeVisible();
    await selectWorkshopMoment(page, "Finish"); await selectWorkshopJoint(page, "Left elbow");
    await expect(jointField(page, "x")).toHaveValue("90");
  } finally { await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password }); }
});
