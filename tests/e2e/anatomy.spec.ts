import { expect, test } from "@playwright/test";

test("anatomical model supports muscle groups, individual selection, isolation and playback", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  const viewer = page.locator('[data-anatomy-state="ready"]');
  await expect(viewer).toBeVisible({ timeout: 60_000 });
  await page.getByLabel("Highlight", { exact: true }).selectOption("group:triceps");
  await expect(viewer).toHaveAttribute("data-highlight-count", "6");
  await page.getByLabel("Highlight", { exact: true }).selectOption("group:traps");
  await expect(viewer).toHaveAttribute("data-highlight-count", "6");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("button", { name: "Back", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Find a muscle").fill("triceps");
  const options = page.locator('optgroup[label="Individual muscles and structures"] option');
  await expect(options).toHaveCount(6);
  const first = await options.first().getAttribute("value");
  await page.getByLabel("Highlight", { exact: true }).selectOption(first!);
  await page.getByLabel("Show selected only").check();
  await expect(viewer).toHaveAttribute("data-highlight-count", "1");
  await expect(viewer).toHaveAttribute("data-isolated", "true");
  await page.getByLabel("Show selected only").uncheck();
  await page.getByLabel("Find a muscle").fill("no matching muscle");
  await expect(page.getByText("0 groups · 0 individual structures found")).toBeVisible();
  await page.getByLabel("Find a muscle").fill("");
  await page.getByLabel("Highlight", { exact: true }).selectOption("group:deltoid");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(() => page.getByRole("slider", { name: "Scrub motion" }).inputValue()).not.toBe("0");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(errors).toEqual([]);
});

test("anatomy download errors allow retry", async ({ page }) => {
  await page.route("**/models/z-anatomy/model.glb", route => route.fulfill({ status: 503, body: "Unavailable" }));
  await page.goto("/");
  await expect(page.getByText("Could not load the anatomy model.")).toBeVisible();
  await page.unroute("**/models/z-anatomy/model.glb");
  await page.getByRole("button", { name: "Retry model", exact: true }).click();
  await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByLabel("Highlight", { exact: true })).toBeEnabled();
});
