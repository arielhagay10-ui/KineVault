import { expect } from "@playwright/test";
import { test } from "../readiness/workshop.fixture";

test("empty search recovery opens the complete equipment catalog", async ({ page, workshop }) => {
  expect(workshop.draftId).toBeTruthy();
  await page.getByRole("button", { name: "Add equipment", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Choose equipment", exact: true });
  await dialog.getByRole("searchbox", { name: "Search equipment", exact: true }).fill("missing-equipment-xyz");
  await expect(dialog.getByRole("status")).toContainText("No matching equipment");
  await dialog.getByRole("button", { name: "Show all equipment", exact: true }).click();
  await expect(dialog.getByRole("searchbox")).toHaveValue("");
  await expect(dialog.getByRole("button", { name: "View all equipment", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByRole("button", { name: "Pec deck", exact: true })).toBeVisible();
});
