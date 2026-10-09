import { expect } from "@playwright/test";
import { test } from "../e2e/published-catalog.helpers";
import { expectModalFocus } from "./accessibility.helpers";

test("navigation dialog contains keyboard focus and returns it after Escape", async ({ page }) => {
  await page.goto("/exercises");
  const trigger = page.getByRole("button", { name: "Site menu", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Site navigation", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveJSProperty("open", true);
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ ...viewport, width: viewport.width - 1 });
  await dialog.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await trigger.focus();
  await expect(trigger).not.toBeFocused();
  await expectModalFocus(page, "Site navigation");
  for (let index = 0; index < 15; index++) {
    await page.keyboard.press("Tab");
    await expectModalFocus(page, "Site navigation");
  }
  for (let index = 0; index < 15; index++) {
    await page.keyboard.press("Shift+Tab");
    await expectModalFocus(page, "Site navigation");
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog).toBeHidden();
});

test("touch navigation and combined catalog filters open the matching exercise", async ({ page, hasTouch, publishedCableRaise }) => {
  test.skip(!hasTouch, "Requires an emulated touch project; real-device checks remain manual.");
  await page.goto("/exercises");
  const trigger = page.getByRole("button", { name: "Site menu", exact: true });
  await trigger.tap();
  const dialog = page.getByRole("dialog", { name: "Site navigation", exact: true });
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "Close menu", exact: true }).tap();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.getByRole("button", { name: "Show filters" }).tap();
  await page.getByRole("checkbox", { name: "Shoulder Abduction", exact: true }).tap();
  await page.locator("summary").filter({ hasText: /^Equipment$/ }).tap();
  await page.locator('input[name="equipment"][value="cable"]').tap();
  await page.getByRole("button", { name: "Apply filters", exact: true }).tap();
  await expect(page).toHaveURL(/jointAction=shoulder-abduction/);
  await expect(page).toHaveURL(/equipment=cable/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const detail = page.getByRole("main").locator(`a[href="/exercises/${publishedCableRaise.slug}"]`);
  await expect(detail).toBeVisible();
  await detail.tap();
  await expect(page).toHaveURL(/\/exercises\/[^/?]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
