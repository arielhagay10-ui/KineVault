import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { z } from "zod";

test("submission pages expose records beyond 50 and search the whole owned history", async ({ page }) => {
  test.setTimeout(60_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname)) throw new Error("Paging fixtures require local Supabase");
  const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `paging-${Date.now()}@example.test`;
  const password = "LocalPagingPassphrase2026!";
  const account = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;

  const ownerId = z.uuid().parse(account.data.user!.id);
  const sql = (query: string) => execFileSync("docker", ["exec", "supabase_db_kinevault", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", query], { stdio: "pipe" });
  const contents = Array.from({ length: 55 }, (_, index) => ({
    id: randomUUID(),
    name: `History fixture ${String(index + 1).padStart(2, "0")}`,
  }));
  try {
    // Draft histories need no render. Editable fixture snapshots allow complete cleanup.
    sql(`begin;
      insert into public.exercise_content(id,kind,owner_id,created_by,name) values
      ${contents.map(content => `('${content.id}','submission_editorial','${ownerId}','${ownerId}','${content.name}')`).join(",")};
      insert into public.exercise_submissions(owner_id,original_content_id,status,submitted_at) values
      ${contents.map((content, index) => `('${ownerId}','${content.id}','draft','${new Date(Date.now() - index * 1000).toISOString()}')`).join(",")};
      commit;`);
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/submissions");
    await expect(page.locator('a[href^="/submissions/"]')).toHaveCount(24);
    await expect(page.getByText("Page 1 · 55 total")).toBeVisible();
    await page.getByRole("link", { name: "Next page" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator('a[href^="/submissions/"]')).toHaveCount(24);
    await page.getByRole("link", { name: "Next page" }).click();
    await expect(page).toHaveURL(/page=3/);
    await expect(page.locator('a[href^="/submissions/"]')).toHaveCount(7);
    await expect(page.getByRole("heading", { name: "History fixture 55" })).toBeVisible();
    await page.getByLabel("Search submissions").fill("fixture 55");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/q=fixture/);
    await expect(page.locator('a[href^="/submissions/"]')).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "History fixture 55" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Next page" })).toHaveCount(0);
  } finally {
    try {
    sql(`begin; delete from public.exercise_submissions where owner_id='${ownerId}';
      delete from public.exercise_content where id in (${contents.map(content => `'${content.id}'`).join(",")}); commit;`);
    } finally {
      await cleanupLocalFixture({ admin: service, userId: ownerId, email, password });
    }
  }
});
