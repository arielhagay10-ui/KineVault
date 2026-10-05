import { expect } from "@playwright/test";
import { test } from "./published-catalog.helpers";

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
  test(`filter options stay above the Apply button at ${viewport.width}px`, async ({ page, publishedCableRaise }) => {
    await page.setViewportSize(viewport);
    await page.goto("/exercises");
    const form = page.locator('#explore-filters form');
    await expect(form).toBeVisible();
    const options = await form.locator(':scope > div').first().boundingBox();
    const footer = await form.locator(':scope > div').last().boundingBox();
    expect(options).not.toBeNull();
    expect(footer).not.toBeNull();
    expect(options!.y + options!.height).toBeLessThanOrEqual(footer!.y + 1);
    await expect(page.getByRole("button", { name: "Apply filters" })).toBeInViewport();

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
