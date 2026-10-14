import { expect } from "@playwright/test";
import { test } from "../e2e/published-catalog.helpers";
import { auditAccessibility, setAppearance } from "./accessibility.helpers";

for (const appearance of ["light", "dark"] as const) {
  test(`public pages and open navigation meet automated accessibility checks in ${appearance}`, async ({ page, isMobile, publishedCableRaise }, testInfo) => {
    await page.goto("/");
    await setAppearance(page, appearance);
    for (const path of ["/", "/exercises", "/sign-in", "/sign-up", "/reset-password", "/joint-actions/shoulder-abduction"]) {
      await test.step(path, async () => {
        await page.goto(path);
        await expect(page.getByRole("main")).toBeVisible();
        if (path === "/exercises" && isMobile) await page.getByRole("button", { name: "Show filters" }).click();
        await auditAccessibility(page, testInfo, `${appearance}-${path.replaceAll("/", "_") || "home"}`);
      });
    }
    await page.goto("/exercises?jointAction=shoulder-abduction&equipment=cable");
    const detail = page.getByRole("main").locator(`a[href="/exercises/${publishedCableRaise.slug}"]`);
    await expect(detail).toBeVisible();
    await detail.click();
    await expect(page).toHaveURL(/\/exercises\/[^/?]+$/);
    await expect(page.getByRole("heading", { level: 1, name: publishedCableRaise.name, exact: true })).toBeVisible();
    await auditAccessibility(page, testInfo, `${appearance}-exercise-detail`);
    await page.getByRole("button", { name: "Site menu", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Site navigation" })).toBeVisible();
    await auditAccessibility(page, testInfo, `${appearance}-navigation-dialog`);
    await page.getByRole("button", { name: "Close menu", exact: true }).click();
    await page.goto("/exercises?q=" + "x".repeat(101));
    await expect(page.getByRole("heading", { name: "Invalid search filters" })).toBeVisible();
    await auditAccessibility(page, testInfo, `${appearance}-invalid-filters`);
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill("readiness-missing@example.test");
    await page.getByLabel("Password", { exact: true }).fill("InvalidReadinessPassword!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const authenticationError = page.getByRole("main").getByRole("alert");
    await expect(authenticationError).toBeVisible();
    await expect(authenticationError).toHaveText("Those sign-in details did not work.");
    await auditAccessibility(page, testInfo, `${appearance}-authentication-error`);
  });
}
