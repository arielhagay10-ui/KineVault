import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { cleanupLocalFixture } from "../helpers/local-fixtures";

async function withAdminFixture(page: Page, run: (fixture: { id: string; slug: string }) => Promise<void>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname)) throw new Error("Admin fixtures require local Supabase");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const slug = `qa-admin-${randomUUID()}`;
  const email = `${slug}@example.test`, password = `LocalAdmin-${randomUUID()}!`;
  const result = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (result.error || !result.data.user) throw result.error ?? new Error("Admin fixture creation failed");
  const id = result.data.user.id;
  const sql = (statement: string) => execFileSync("docker", ["exec", "supabase_db_kinevault", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", statement], { stdio: "pipe" });
  try {
    mkdirSync(".local-artifacts/qa", { recursive: true });
    appendFileSync(".local-artifacts/qa/admin-regression-fixtures.jsonl", `${JSON.stringify({ id, slug })}\n`);
    sql(`begin; select set_config('app.audit_comment','Authorized temporary local admin browser QA.',true); update public.roles set role='admin',assigned_by=user_id where user_id='${id}'; commit;`);
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await run({ id, slug });
  } finally {
    sql(`begin; select set_config('app.audit_comment','Remove disposable QA classification and privileges.',true); delete from public.muscles where slug='${slug}'; update public.roles set role='user',assigned_by=null where user_id='${id}'; commit;`);
    await cleanupLocalFixture({ admin, userId: id, email, password });
  }
}

test("long taxonomy names fit all supported viewports", async ({ page }) => {
  await withAdminFixture(page, async ({ slug }) => {
    await page.goto("/admin/taxonomies");
    await page.getByLabel("Name", { exact: true }).fill("Q".repeat(120));
    await page.getByLabel("Slug", { exact: true }).fill(slug);
    await page.getByRole("button", { name: "Add classification", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Classification saved");
    for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 768], [1024, 768], [768, 1024], [430, 932], [390, 844], [375, 667]]) {
      await page.setViewportSize({ width, height });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Taxonomy at ${width}px`).toBe(true);
    }
    await page.screenshot({ path: ".local-artifacts/qa/admin-taxonomy-fixed-375.png", fullPage: true });
    const row = page.locator("li").filter({ hasText: slug });
    await row.getByRole("link", { name: "Edit", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Edit classification", exact: true })).toBeVisible();
    await page.getByLabel("Delete this unused classification").check();
    await page.getByRole("button", { name: "Delete classification", exact: true }).click();
    await expect(row).toHaveCount(0);
  });
});

test("failed admin saves preserve entered fields", async ({ page }) => {
  await withAdminFixture(page, async ({ slug }) => {
    await page.goto("/admin/taxonomies");
    await page.getByLabel("Name", { exact: true }).fill("QA classification");
    await page.getByLabel("Slug", { exact: true }).fill(slug);
    await page.getByRole("button", { name: "Add classification", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Classification saved");
    await page.getByLabel("Name", { exact: true }).fill("Duplicate attempt");
    await page.getByLabel("Slug", { exact: true }).fill(slug);
    await page.getByRole("button", { name: "Add classification", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "already used" })).toBeVisible();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Duplicate attempt");
    await expect(page.getByLabel("Slug", { exact: true })).toHaveValue(slug);
    await page.goto("/admin/roles");
    await page.getByLabel("Account ID", { exact: true }).fill("invalid");
    await page.getByRole("combobox", { name: "Role", exact: true }).selectOption("user");
    await page.getByLabel("Reason", { exact: true }).fill("Correctable QA validation failure.");
    await page.getByRole("button", { name: "Assign role", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Choose an account" })).toBeVisible();
    await expect(page.getByLabel("Account ID", { exact: true })).toHaveValue("invalid");
    await expect(page.getByRole("combobox", { name: "Role", exact: true })).toHaveValue("user");
    await expect(page.getByLabel("Reason", { exact: true })).toHaveValue("Correctable QA validation failure.");
  });
});

test("candidate searches remain bounded without dropping the query", async ({ page }) => {
  await withAdminFixture(page, async () => {
    await page.goto("/admin/candidates");
    await page.getByRole("textbox", { name: "Search candidates", exact: true }).fill("x".repeat(2000));
    await expect(page.getByRole("textbox", { name: "Search candidates", exact: true })).toHaveValue("x".repeat(100));
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByText("No candidates on this page.", { exact: true })).toBeVisible();
    await page.goto(`/admin/candidates?q=${"x".repeat(101)}`);
    await expect(page.getByText("No candidates on this page.", { exact: true })).toBeVisible();
  });
});
