import { expect, test } from "@playwright/test";

for (const width of [320, 390, 768, 1440]) {
  test(`primary destinations and search stay visible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const header = page.getByRole("banner");
    await expect(header).toBeVisible();
    const navigation = header.getByRole("navigation", { name: "Main navigation", exact: true });
    for (const name of ["Explore", "Library", "Create"]) {
      await expect(navigation.getByRole("link", { name, exact: true })).toBeInViewport();
    }
    await expect(page.getByRole("searchbox", { name: "Search exercises", exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator("body").evaluate(element => getComputedStyle(element).fontFamily)).not.toContain("Comfortaa");
    expect(await header.getByRole("link", { name: "KineVault", exact: true }).evaluate(element => getComputedStyle(element).fontFamily)).toContain("Comfortaa");
  });
}

test("home search reaches the catalog and keeps its query", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search exercises", exact: true }).fill("lateral raise");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/\/exercises\?q=lateral\+raise$/);
  await expect(page.getByRole("searchbox", { name: "Search exercises", exact: true })).toHaveValue("lateral raise");
  await expect(page.getByRole("navigation", { name: "Main navigation", exact: true }).getByRole("link", { name: "Explore", exact: true })).toHaveAttribute("aria-current", "page");
});

test("appearance options dismiss with Escape and restore focus", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Appearance", exact: true });
  await expect(trigger).toBeEnabled();
  await trigger.focus();
  await page.keyboard.press("Enter");
  const options = page.getByRole("dialog", { name: "Account options", exact: true });
  await expect(options).toBeVisible();
  await options.getByRole("combobox", { name: "Appearance", exact: true }).selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("Escape");
  await expect(options).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("phone browse links reveal their matching filter group", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("link", { name: /^By equipment/ }).click();
  await expect(page.getByRole("checkbox", { name: "Cable", exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: "Cable", exact: true }).check();
  await page.getByRole("searchbox", { name: "Search exercises", exact: true }).fill("raise");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/equipment=cable/);
  await expect(page).toHaveURL(/q=raise/);
  await expect(page.getByRole("combobox", { name: "Sort by", exact: true })).toHaveValue("recommended");
});

