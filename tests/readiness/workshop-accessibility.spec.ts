import { expect } from "@playwright/test";
import { openWorkshopTool, setWorkshopLanguage } from "../e2e/workshop-menu.helpers";
import { auditAccessibility, setAppearance } from "./accessibility.helpers";
import { test } from "./workshop.fixture";

for (const appearance of ["light", "dark"] as const) {
  test(`owner pages, workshop tools and equipment dialog meet automated checks in ${appearance}`, async ({ page, workshop }, testInfo) => {
    await page.goto("/dashboard");
    await setAppearance(page, appearance);
    await page.goto(`/my-exercises/${workshop.draftId}/workshop`);
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await auditAccessibility(page, testInfo, `${appearance}-quick-workshop`);
    const advanced = page.getByRole("button", { name: "Advanced editing", exact: true });
    await advanced.focus();
    await advanced.press("Enter");
    await expect(advanced).toHaveAttribute("aria-pressed", "true");
    for (const tool of ["Equipment", "Position", "Pose", "Timeline", "Settings"]) {
      await openWorkshopTool(page, tool);
      await auditAccessibility(page, testInfo, `${appearance}-tool-${tool}`);
    }
    await openWorkshopTool(page, "View");
    await page.getByRole("button", { name: "Compare start and finish", exact: true }).click();
    await expect(page.getByRole("region", { name: "Start and finish comparison", exact: true })).toBeVisible();
    await expect(page.locator('[data-anatomy-state="ready"]')).toHaveCount(2);
    await auditAccessibility(page, testInfo, `${appearance}-start-finish-comparison`);
    await page.getByRole("button", { name: "Close comparison", exact: true }).click();
    await openWorkshopTool(page, "Equipment");
    await page.getByRole("button", { name: "Add equipment", exact: true }).filter({ visible: true }).click();
    const dialog = page.getByRole("dialog", { name: "Choose equipment", exact: true });
    await expect(dialog).toBeVisible();
    await auditAccessibility(page, testInfo, `${appearance}-equipment-dialog`);
    await dialog.getByRole("searchbox").fill("missing-readiness-equipment");
    await expect(dialog.getByRole("status")).toContainText("No matching equipment");
    await auditAccessibility(page, testInfo, `${appearance}-equipment-empty-search`);
    await page.keyboard.press("Escape");
    await setWorkshopLanguage(page, "he");
    await auditAccessibility(page, testInfo, `${appearance}-hebrew-workshop`);
    await setWorkshopLanguage(page, "en");
    for (const path of ["/dashboard", "/my-exercises", `/my-exercises/${workshop.draftId}/edit`, "/reset-password/update"]) {
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();
      await auditAccessibility(page, testInfo, `${appearance}-owner-${path.replaceAll("/", "_")}`);
    }
  });
}
