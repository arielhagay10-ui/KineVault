import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { blankWorkshopScene } from "../../src/lib/motion/workshop";
import { createStudioObject } from "../../src/lib/motion/studio";
import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { openWorkshopTool } from "./workshop-menu.helpers";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });
test("placement warnings overlay the preview without resizing it and lead to the affected item", async ({ page }) => {
  test.setTimeout(180_000); page.setDefaultTimeout(20_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `placement-${randomUUID()}@example.test`, password = "PlacementFixture2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  const folder = ".local-artifacts/workshop/placement-warning"; mkdirSync(folder, { recursive: true });
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  try {
    const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    await owner.auth.signInWithPassword({ email, password });
    const scene = structuredClone(blankWorkshopScene);
    const weight = { ...createStudioObject("dumbbell", randomUUID(), 0), x: 0, y: 1.2, z: 0 };
    scene.studio!.objects = [weight, { ...createStudioObject("dumbbell", randomUUID(), 1), x: 3 }];
    const created = await owner.rpc("save_workshop_draft", { p_scene: scene, p_name: "Placement warning and resting pose" });
    if (created.error) throw created.error;
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/sign-in"); await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/my-exercises/${created.data}/workshop`);
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await openWorkshopTool(page, "Contacts"); await page.getByRole("combobox", { name: "Selected item", exact: true }).selectOption(weight.id);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await openWorkshopTool(page, "Position");
      const x = page.getByLabel("Position X meters", { exact: true });
      await x.fill("0"); await x.press("Enter");
      const preview = page.getByRole("button", { name: "Preview", exact: true });
      if (await preview.isVisible()) await preview.click();
      const warning = page.locator("[data-workshop-placement-warning]");
      await expect(warning).toBeVisible();
      const canvas = page.locator("canvas");
      const measure = () => canvas.evaluate(element => {
        const box = element.getBoundingClientRect();
        return { width: box.width, height: box.height };
      });
      const before = await measure();
      await warning.locator("summary").click();
      await expect(warning).toHaveAttribute("open", "");
      await expect(warning.getByRole("button", { name: "Inspect placement · Dumbbell 1", exact: true })).toBeVisible();
      expect(await measure()).toEqual(before);
      const visibleCanvas = (await canvas.boundingBox())!;
      const warningBox = (await warning.boundingBox())!;
      expect(warningBox.y).toBeGreaterThanOrEqual(visibleCanvas.y);
      expect(warningBox.x + warningBox.width).toBeLessThanOrEqual(visibleCanvas.x + visibleCanvas.width);
      await page.screenshot({ path: `${folder}/expanded-${width}.png` });
      await warning.locator("summary").press("Escape");
      await expect(warning).not.toHaveAttribute("open", "");
      await warning.locator("summary").press("Enter");
      await warning.getByRole("button", { name: "Inspect placement · Dumbbell 1", exact: true }).click();
      await expect(page.getByRole("tab", { name: "Position", exact: true })).toHaveAttribute("aria-selected", "true");
      await expect(warning).not.toHaveAttribute("open", "");
      await openWorkshopTool(page, "Position");
      await x.fill("3"); await x.press("Enter");
      if (await preview.isVisible()) await preview.click();
      await expect(warning).toBeHidden();
      expect(await measure()).toEqual(before);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "Save exercise", exact: true }).click(); await expect(page.getByText(/^Saved at .* · Private$/)).toBeVisible();
    await page.reload(); await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible();
    for (const view of ["Front", "Side"]) {
      await page.getByRole("button", { name: view, exact: true }).click();
      await page.locator("canvas").screenshot({ path: `${folder}/rest-${view.toLowerCase()}.png` });
    }
    expect(errors).toEqual([]);
  } finally { await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password }); }
});
