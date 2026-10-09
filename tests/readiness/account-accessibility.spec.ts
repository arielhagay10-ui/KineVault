import { execFileSync } from "node:child_process";
import { z } from "zod";
import { expect } from "@playwright/test";
import { auditAccessibility, setAppearance } from "./accessibility.helpers";
import { test } from "./workshop.fixture";

for (const appearance of ["light", "dark"] as const) {
  test(`administration and submission forms meet automated checks in ${appearance}`, async ({ page, workshop, publishedCableRaise }, testInfo) => {
    const userId = z.uuid().parse(workshop.userId);
    // The fixture already verifies both local destinations. Change only its UUID.
    execFileSync("docker", ["exec", "supabase_db_kinevault", "psql", "-U", "postgres", "-d", "postgres",
      "-v", "ON_ERROR_STOP=1", "-c", `begin;
      select set_config('app.audit_comment','Temporary local accessibility fixture privileges.',true);
      update public.roles set role='admin',assigned_by=user_id where user_id='${userId}'; commit;`], { stdio: "pipe" });
    await page.goto("/dashboard");
    await setAppearance(page, appearance);
    for (const path of ["/admin", "/admin/candidates", "/admin/exercises", "/admin/taxonomies", "/admin/roles",
      "/admin/assets", "/admin/submissions", "/submissions", "/notifications", `/my-exercises/${workshop.draftId}/submit`]) {
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();
      await auditAccessibility(page, testInfo, `${appearance}-${path.replaceAll("/", "_")}`);
    }
    await page.goto("/admin/exercises");
    const edit = page.getByRole("main").locator(`a[href="/admin/exercises/${publishedCableRaise.id}/edit"]`);
    await expect(edit).toBeVisible();
    await edit.click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await auditAccessibility(page, testInfo, `${appearance}-admin-editor`);
  });

  test(`shared and revoked drafts meet automated checks in ${appearance}`, async ({ page, browser, baseURL, workshop }, testInfo) => {
    await page.goto(`/my-exercises/${workshop.draftId}/edit`);
    await setAppearance(page, appearance);
    await page.getByRole("button", { name: "Create share link", exact: true }).click();
    const link = await page.getByRole("textbox", { name: "Share link", exact: true }).inputValue();
    expect(link).toMatch(/^\/shared\/[A-Za-z0-9_-]{43}$/);
    const visitor = await browser.newContext({ baseURL, viewport: page.viewportSize() });
    try {
      const shared = await visitor.newPage();
      await shared.goto(link);
      await setAppearance(shared, appearance);
      await expect(shared.getByRole("heading", { name: "Browser readiness fixture", exact: true })).toBeVisible();
      await expect(shared.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
      await auditAccessibility(shared, testInfo, `${appearance}-shared-draft`);
      page.once("dialog", dialog => dialog.accept());
      await page.getByRole("button", { name: "Revoke link", exact: true }).click();
      await expect(page.getByText("No active share link.", { exact: true })).toBeVisible();
      const response = await shared.reload();
      expect(response?.status()).toBe(404);
      await auditAccessibility(shared, testInfo, `${appearance}-revoked-share`);
    } finally { await visitor.close(); }
  });
}
