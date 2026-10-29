import { expect } from "@playwright/test";
import { test } from "./published-catalog.helpers";

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
  test(`filter options stay above the Apply button at ${viewport.width}px`, async ({ page, publishedCableRaise }) => {
    await page.setViewportSize(viewport);
    await page.goto("/exercises");
    const form = page.locator('#explore-filters > div');
    await expect(form).toBeVisible();
    const options = await form.locator(':scope > div').first().boundingBox();
    const footer = await form.locator(':scope > div').last().boundingBox();
    expect(options).not.toBeNull();
    expect(footer).not.toBeNull();
    expect(options!.y + options!.height).toBeLessThanOrEqual(footer!.y + 1);
    await expect(page.getByRole("button", { name: "Apply filters" })).toBeInViewport();

    await page.locator('summary').filter({ hasText: /^Joint actions$/ }).click();
    await page.getByRole("checkbox", { name: "Shoulder Abduction", exact: true }).check();
    await page.locator('summary').filter({ hasText: /^Equipment$/ }).click();
    await page.getByRole("checkbox", { name: "Cable", exact: true }).check();
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/equipment=cable/);
    await expect(page).toHaveURL(/jointAction=shoulder-abduction/);
    await page.locator(`a[href="/exercises/${publishedCableRaise.slug}"]`)
      .filter({ has: page.getByRole("heading", { name: publishedCableRaise.name, exact: true }) }).click();
    await expect(page).toHaveURL(new RegExp(`/exercises/${publishedCableRaise.slug}$`));
    await expect(page.getByRole("heading", { name: publishedCableRaise.name, exact: true })).toBeVisible();
  });
}

test("catalog uses document scrolling while desktop filters stay reachable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/exercises");
  const filters = page.locator("#explore-filters");
  const results = page.getByRole("region", { name: "Search results", exact: true });
  await expect(results).toBeVisible();
  // Supply result height without publishing extra development exercises.
  await results.evaluate(element => {
    const spacer = document.createElement("div");
    spacer.style.height = "2000px";
    element.append(spacer);
  });
  await expect.poll(() => results.evaluate(element => element.scrollHeight)).toBeGreaterThan(2000);
  await results.hover();
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(300);
  expect(await results.evaluate(element => element.scrollTop)).toBe(0);
  expect((await filters.boundingBox())!.y).toBeGreaterThanOrEqual(0);
  await expect(page.getByRole("button", { name: "Apply filters", exact: true })).toBeInViewport();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/exercises");
  await page.getByRole("button", { name: "Show filters", exact: true }).click();
  await expect(filters).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
