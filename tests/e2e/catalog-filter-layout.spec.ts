import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
  test(`filter options stay above the Apply button at ${viewport.width}px`, async ({ page }) => {
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
    await page.getByRole("link").filter({ has: page.getByRole("heading", { name: "Cable Lateral Raise", exact: true }) }).click();
    await expect(page.getByRole("heading", { name: "Cable Lateral Raise", exact: true })).toBeVisible();
  });
}
