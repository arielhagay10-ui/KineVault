import { expect } from "@playwright/test";
import { test } from "../readiness/workshop.fixture";
import { openWorkshopTool, selectWorkshopObject } from "./workshop-menu.helpers";
import { draftRecoveryKey } from "../../src/lib/motion/workshop-draft";

test("rotation display rounds without changing the authored transform", async ({ page, workshop }, testInfo) => {
  await selectWorkshopObject(page, "Dumbbell");
  await openWorkshopTool(page, "Position");
  const rotation = page.getByRole("textbox", { name: "Rotation X degrees", exact: true });
  await rotation.fill("23.348515");
  await rotation.press("Enter");
  await expect(rotation).toHaveValue("23.35");
  await rotation.focus();
  await rotation.blur();
  const key = draftRecoveryKey(workshop.userId, workshop.draftId);
  await expect.poll(() => page.evaluate(key => {
    const recovery = localStorage.getItem(key);
    return recovery ? JSON.parse(recovery).scene.studio.objects[0].rotationX : null;
  }, key)).toBe(23.348515);
  await page.getByRole("button", { name: "Save exercise", exact: true }).click();
  await expect(page.getByText(/^Saved at .* · Private$/)).toBeVisible();
  await page.reload();
  await selectWorkshopObject(page, "Dumbbell");
  await openWorkshopTool(page, "Position");
  await expect(rotation).toHaveValue("23.35");
  await rotation.scrollIntoViewIfNeeded();
  await expect.poll(() => rotation.evaluate(element => element.clientWidth)).toBeGreaterThanOrEqual(80);
  await page.screenshot({ path: testInfo.outputPath("rotation-display.png") });
  await page.getByRole("button", { name: "Increase Rotation X degrees by 1", exact: true }).click();
  await expect(rotation).toHaveValue("24.35");
  await expect.poll(() => page.evaluate(key => {
    const recovery = localStorage.getItem(key);
    return recovery ? JSON.parse(recovery).scene.studio.objects[0].rotationX : null;
  }, key)).toBe(24.348515);
});
