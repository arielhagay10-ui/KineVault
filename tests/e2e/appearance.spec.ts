import { expect, test } from "@playwright/test";

test("theme persists and mobile filters stay usable without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/exercises");
  await page.getByRole("combobox", { name: "Appearance", exact: true }).selectOption("dark");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Appearance", exact: true })).toHaveValue("dark");
  await expect(page.getByRole("button", { name: "Show filters" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Shoulder Abduction", exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Show filters" }).click();
  await page.getByRole("checkbox", { name: "Shoulder Abduction", exact: true }).check();
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/jointAction=shoulder-abduction/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: "test-results/explore-mobile-dark.png", fullPage: true, caret: "initial", animations: "disabled" });
  await page.getByRole("combobox", { name: "Appearance", exact: true }).selectOption("light");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.screenshot({ path: "test-results/explore-mobile-light.png", fullPage: true, caret: "initial", animations: "disabled" });
});
