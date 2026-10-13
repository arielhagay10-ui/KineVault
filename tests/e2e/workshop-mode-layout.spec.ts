import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { cleanupLocalFixture } from "../helpers/local-fixtures";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });

test("workshop keeps posing instructions below controls and hides redundant mode hints", async ({ page }) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `mode-layout-${randomUUID()}@example.test`, password = "WorkshopLayout2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/my-exercises/new");
    const closeTutorial = page.getByRole("button", { name: "Close tutorial", exact: true });
    await expect(closeTutorial).toBeVisible();
    await closeTutorial.click();
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    const modes = page.getByRole("group", { name: "Mouse movement", exact: true });
    const preview = page.locator("[data-workshop-figure-preview]");
    const folder = ".local-artifacts/workshop/mode-layout";
    mkdirSync(folder, { recursive: true });
    for (const fullscreen of [false, true]) {
      for (const width of [1440, 800, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        if (fullscreen) {
          await page.getByRole("button", { name: "Full screen", exact: true }).click();
          await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
        }
        for (const mode of ["Move with mouse", "Pose hands and feet", "Camera"]) {
          await modes.getByRole("button", { name: mode, exact: true }).click();
          if (mode === "Pose hands and feet") {
            const copy = preview.getByText(/^Drag a hand or foot using its round button\. Elbows/);
            await expect(copy).toBeVisible();
            const controlsBox = (await modes.boundingBox())!, textBox = (await copy.boundingBox())!;
            expect(textBox.y).toBeGreaterThanOrEqual(controlsBox.y + controlsBox.height);
          } else {
            await expect(modes.getByRole("button", { name: mode, exact: true })).toHaveAttribute("title", /Drag/);
            await expect(preview.locator("[data-workshop-current-hint]")).toHaveCount(0);
          }
          if (mode === "Camera") await expect(modes.getByRole("button", { name: "Reset all joints", exact: true })).toBeHidden();
        }
        await page.screenshot({ path: `${folder}/${fullscreen ? "fullscreen" : "window"}-${width}.png` });
        if (fullscreen) {
          await page.evaluate(() => document.exitFullscreen());
          await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
        }
      }
    }
  } finally {
    await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password });
  }
});
