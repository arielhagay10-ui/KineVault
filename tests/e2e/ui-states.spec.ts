import { expect } from "@playwright/test";
import { test } from "./published-catalog.helpers";

for (const width of [390, 1440]) {
  test(`empty catalog search has a usable reset at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/exercises?q=zzzzzznomatch");
    await expect(page.getByRole("heading", { name: "No matching exercises", exact: true })).toBeVisible();
    const reset = page.getByRole("link", { name: "Reset search", exact: true });
    expect((await reset.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await reset.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/exercises$/);
    await expect(page.getByRole("searchbox", { name: "Search exercises", exact: true })).toHaveValue("");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("exercise cards wrap long unbroken names on phone and desktop", async ({ page, publishedCableRaise }) => {
  await page.goto("/exercises");
  const card = page.locator(`a[href="/exercises/${publishedCableRaise.slug}"]`);
  const heading = card.getByRole("heading", { level: 2 });
  await expect(heading).toBeVisible();
  // Stress the real card layout without changing published fixture content.
  await heading.evaluate(element => { element.textContent = "A".repeat(200); });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await heading.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
