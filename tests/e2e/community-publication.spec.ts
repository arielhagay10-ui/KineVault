import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { z } from "zod";
import { cleanupLocalFixture } from "../helpers/local-fixtures";

test("publish a minimal private draft, report it, verify it and hide it", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname)) throw new Error("Publication fixtures require local Supabase");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const suffix = randomUUID();
  const password = `LocalPublish-${suffix}!`;
  const accounts: { id: string; email: string }[] = [];
  const owner = createClient(url, key, { auth: { persistSession: false } });
  const reviewer = createClient(url, key, { auth: { persistSession: false } });
  let exerciseId: string | undefined;
  let privateId: string | undefined;
  const visitorContext = await browser.newContext();
  async function signIn(target: Page, email: string) {
    await target.goto("/sign-in");
    await target.getByLabel("Email", { exact: true }).fill(email);
    await target.getByLabel("Password", { exact: true }).fill(password);
    await target.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(target).toHaveURL(/\/dashboard$/);
  }
  try {
    for (const role of ["owner", "reviewer"]) {
      const email = `publication-${role}-${suffix}@example.test`;
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error) throw created.error;
      accounts.push({ id: z.uuid().parse(created.data.user!.id), email });
    }
    execFileSync("docker", ["exec", "supabase_db_kinevault", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c",
      `update public.roles set role='reviewer' where user_id='${accounts[1].id}';`], { stdio: "pipe" });
    const signedIn = await owner.auth.signInWithPassword({ email: accounts[0].email, password });
    if (signedIn.error) throw signedIn.error;
    const name = `Community fixture ${suffix}`;
    const draft = await owner.rpc("save_private_exercise", { p_name: "Untitled exercise" });
    if (draft.error) throw draft.error;
    privateId = z.uuid().parse(draft.data);
    const visitor = await visitorContext.newPage();
    await visitor.goto(`/my-exercises/${privateId}/edit`);
    await expect(visitor).toHaveURL(/\/sign-in/);
    await signIn(page, accounts[0].email);
    await page.goto(`/my-exercises/${privateId}/submit`);
    await expect(page.getByRole("heading", { name: "Publish exercise", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish exercise", exact: true })).toHaveCount(0);
    await expect(page.getByText("Save a name in", { exact: false })).toBeVisible();
    const named = await owner.rpc("save_private_exercise", { p_private_id: privateId, p_name: name });
    if (named.error) throw named.error;
    await page.reload();
    expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
    await page.screenshot({ path: ".local-artifacts/qa/community-publication-confirmation.png", fullPage: true });
    await page.getByRole("button", { name: "Publish exercise", exact: true }).click();
    await expect(page).toHaveURL(/\/exercises\//);
    const publicUrl = page.url();
    await expect(page.getByText("Community", { exact: true })).toBeVisible();
    const publication = await owner.from("exercise_publications").select("exercise_id").eq("source_private_exercise_id", privateId).single();
    if (publication.error) throw publication.error;
    exerciseId = z.uuid().parse(publication.data.exercise_id);
    await page.goto(`/my-exercises/${privateId}/submit`);
    await expect(page.getByRole("link", { name: "View public exercise", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish exercise", exact: true })).toHaveCount(0);
    await page.goto(`/exercises?q=${encodeURIComponent(name)}`);
    const card = page.getByRole("link").filter({ has: page.getByRole("heading", { name, exact: true }) });
    await expect(card.getByText("Community", { exact: true })).toBeVisible();
    await page.goto(publicUrl);
    const changed = await owner.rpc("save_private_exercise", { p_private_id: privateId, p_name: `${name} edited privately` });
    if (changed.error) throw changed.error;
    await visitor.goto(publicUrl);
    await expect(visitor.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(visitor.getByRole("link", { name: "Sign in to report" })).toBeVisible();
    await page.getByText("Report exercise", { exact: true }).click();
    expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
    await page.screenshot({ path: ".local-artifacts/qa/community-publication-report.png", fullPage: true });
    await page.getByLabel("Reason for report").fill("Disposable fixture report for moderator review.");
    await page.getByRole("button", { name: "Send report", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Report sent");
    await page.goto(`/admin/exercises/${exerciseId}`);
    await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
    await signIn(visitor, accounts[1].email);
    await reviewer.auth.signInWithPassword({ email: accounts[1].email, password });
    await visitor.goto("/admin");
    await visitor.getByRole("link", { name: "Community exercises", exact: false }).click();
    await expect(visitor.getByRole("heading", { name: "Exercise moderation", exact: true })).toBeVisible();
    await visitor.getByLabel("Exercise name", { exact: true }).fill(name);
    await visitor.getByLabel("Exercise status", { exact: true }).selectOption("reported");
    await visitor.getByRole("button", { name: "Search", exact: true }).click();
    await expect(visitor).toHaveURL(/status=reported/);
    await visitor.getByRole("link", { name, exact: true }).click();
    await expect(visitor).toHaveURL(new RegExp(`/admin/exercises/${exerciseId}$`));
    await expect(visitor.getByText("Disposable fixture report for moderator review.", { exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page: visitor }).include("main").analyze()).violations).toEqual([]);
    await visitor.getByLabel("Moderation reason").fill("Reviewed this disposable fixture.");
    await visitor.getByRole("button", { name: "Mark verified", exact: true }).click();
    await expect(visitor.getByRole("status")).toContainText("Updated");
    await expect(visitor.getByText("Verified", { exact: true })).toBeVisible();
    await page.goto(publicUrl);
    await expect(page.getByText("Verified", { exact: true })).toBeVisible();
    await visitor.goto(publicUrl);
    await expect.poll(async () => {
      const exercise = await owner.from("exercises").select("view_count").eq("id", exerciseId!).single();
      if (exercise.error) throw exercise.error;
      return exercise.data.view_count;
    }, { timeout: 10_000 }).toBe(1);
    await visitor.getByRole("button", { name: "Copy to my exercises", exact: true }).click();
    await expect(visitor).toHaveURL(/\/my-exercises\/[^/]+\/edit$/);
    await expect(visitor.getByLabel("Name", { exact: true })).toHaveValue(name);
    const used = await owner.from("exercises").select("use_count").eq("id", exerciseId).single();
    if (used.error) throw used.error;
    expect(used.data.use_count).toBe(1);
    await visitor.goto(`/admin/exercises/${exerciseId}`);
    await visitor.getByLabel("Moderation reason").fill("Hide this disposable fixture after verification.");
    await visitor.getByRole("button", { name: "Hide exercise", exact: true }).click();
    await expect(visitor.getByText("Hidden", { exact: true })).toBeVisible();
    await page.goto(publicUrl);
    await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
    await visitor.goto(`/admin/exercises?status=withdrawn&q=${encodeURIComponent(name)}`);
    await expect(visitor.getByRole("listitem").getByText("Hidden", { exact: true })).toBeVisible();
    await visitor.getByRole("link", { name, exact: true }).click();
    await expect(visitor).toHaveURL(new RegExp(`/admin/exercises/${exerciseId}$`));
    await visitor.getByLabel("Moderation reason").fill("Restore disposable fixture to check remaining controls.");
    await visitor.getByRole("button", { name: "Restore exercise", exact: true }).click();
    await expect(visitor.getByText("Public", { exact: true })).toBeVisible();
    await visitor.getByLabel("Moderation reason").fill("Return fixture to community status.");
    await visitor.getByRole("button", { name: "Remove verification", exact: true }).click();
    await expect(visitor.getByText("Community", { exact: true })).toBeVisible();
    await visitor.getByLabel("Moderation reason").fill("Report checked in disposable browser fixture.");
    await visitor.getByRole("button", { name: "Resolve reports", exact: true }).click();
    await expect(visitor.getByRole("button", { name: "Resolve reports", exact: true })).toHaveCount(0);
    await visitor.screenshot({ path: ".local-artifacts/qa/community-publication-moderation.png", fullPage: true });
  } finally {
    if (privateId && !exerciseId) {
      const existing = await owner.from("exercise_publications").select("exercise_id").eq("source_private_exercise_id", privateId).maybeSingle();
      if (existing.data) exerciseId = z.uuid().parse(existing.data.exercise_id);
    }
    if (exerciseId) {
      const authenticated = await reviewer.auth.signInWithPassword({ email: accounts[1].email, password });
      if (authenticated.error) throw authenticated.error;
      const current = await reviewer.from("exercises").select("status").eq("id", exerciseId).single();
      if (current.error) throw current.error;
      if (current.data.status === "published") {
        const hidden = await reviewer.rpc("moderate_public_exercise", { p_exercise_id: exerciseId, p_action: "hide", p_comment: "Hide disposable browser fixture." });
        if (hidden.error) throw hidden.error;
      }
    }
    await visitorContext.close();
    for (const account of accounts) await cleanupLocalFixture({ admin, userId: account.id, email: account.email, password });
  }
});
