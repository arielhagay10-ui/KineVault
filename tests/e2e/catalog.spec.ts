import { expect, test } from "@playwright/test";

test("long searches stay valid and malformed filter URLs can be reset", async ({ page }) => {
  await page.goto("/exercises");
  const search = page.getByLabel("Search", { exact: true });
  await search.fill("x".repeat(2000));
  await expect(search).toHaveValue("x".repeat(100));
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No matching exercises" })).toBeVisible();
  await page.goto(`/exercises?q=${"x".repeat(101)}`);
  await expect(page.getByRole("heading", { name: "Invalid search filters" })).toBeVisible();
  await page.getByRole("link", { name: "Reset filters", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Find the movement you mean." })).toBeVisible();
});

test("Explore preserves combined anatomy and equipment filters in the URL", async ({ page }) => {
  await page.goto("/exercises?jointAction=shoulder-abduction&equipment=cable");
  await expect(page.getByRole("heading", { name: "Find the movement you mean." })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Shoulder Abduction" })).toBeChecked();
  await expect(page.locator('input[name="equipment"][value="cable"]')).toBeChecked();
  await expect(page.getByText("2 active filters", { exact: true })).toBeVisible();
});

test("a joint action explains the movement and links to filtered Explore", async ({ page }) => {
  await page.goto("/joint-actions/shoulder-abduction");
  await expect(page.getByRole("heading", { name: "Shoulder Abduction" })).toBeVisible();
  await expect(page.getByText("The upper arm moves away from the torso to the side.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Full Explore" })).toHaveAttribute("href", "/exercises?jointAction=shoulder-abduction");
});
