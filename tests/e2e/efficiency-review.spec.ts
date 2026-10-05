import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect } from "@playwright/test";
import { test } from "./published-catalog.helpers";

test("metadata warns only for actual edits and keeps them after cancelled navigation", async ({ page }) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname)) throw new Error("Local fixtures required");
  const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const email = `metadata-guard-${randomUUID()}@example.test`, password = "MetadataGuard2026!";
  const account = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  try {
    expect((await owner.auth.signInWithPassword({ email, password })).error).toBeNull();
    const draft = await owner.rpc("save_private_metadata", { p_patch: { name: "Guarded metadata" } });
    expect(draft.error).toBeNull();
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email); await page.getByLabel("Password").fill("IncorrectPassword2026!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Those sign-in details did not work" })).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue(email);
    await expect(page.getByLabel("Password")).toHaveValue("IncorrectPassword2026!");
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/my-exercises/${draft.data}/edit`);
    await page.getByText("Anatomy (optional)", { exact: true }).click();
    await page.getByRole("group", { name: "Primary muscles", exact: true }).getByRole("searchbox").fill("shoulder");
    await page.getByRole("link", { name: "Open motion workshop" }).click();
    await expect(page).toHaveURL(/\/workshop$/);
    await page.goto(`/my-exercises/${draft.data}/edit`);
    await page.getByLabel("Name", { exact: true }).fill("Unsaved metadata");
    let warnings = 0;
    page.on("dialog", async dialog => { warnings++; await dialog.dismiss(); });
    await page.getByRole("link", { name: "Submit for review", exact: false }).click();
    await expect(page).toHaveURL(/\/edit$/);
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Unsaved metadata");
    expect(warnings).toBe(1);
    await page.getByLabel("Name", { exact: true }).fill("Guarded metadata");
    await page.getByRole("link", { name: "Back to my exercises" }).click();
    await expect(page).toHaveURL(/\/my-exercises$/);
    expect(warnings).toBe(1);
    await page.goto(`/my-exercises/${draft.data}/edit`);
    await page.getByLabel("Name", { exact: true }).fill("Saved metadata");
    await page.getByRole("button", { name: "Save privately", exact: true }).click();
    await expect(page).toHaveURL(/saved=1/);
    await page.getByRole("link", { name: "Back to my exercises" }).click();
    await expect(page).toHaveURL(/\/my-exercises$/);
    expect(warnings).toBe(1);
    await page.getByRole("link", { name: "Optional details", exact: true }).click();
    await page.getByLabel("Name", { exact: true }).fill("History recovery");
    await page.goBack();
    await expect(page).toHaveURL(/\/my-exercises$/);
    await page.getByRole("link", { name: "Optional details", exact: true }).click();
    await page.getByRole("button", { name: "Restore details", exact: true }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("History recovery");
    await page.getByRole("button", { name: "Save privately", exact: true }).click();
    await expect(page).toHaveURL(/saved=1/);
    await page.getByRole("link", { name: "Back to my exercises" }).click();
    await page.getByRole("link", { name: "Optional details", exact: true }).click();
    await page.getByLabel("Name", { exact: true }).fill("X");
    await page.getByText("Instructions and detailed classifications (optional)", { exact: true }).click();
    const invalidAliases = "a".repeat(161) + "\n" + Array.from({ length: 21 }, (_, index) => `Alias ${index}`).join("\n");
    await page.getByLabel("Aliases", { exact: true }).fill(invalidAliases);
    await page.goBack();
    await page.getByRole("link", { name: "Optional details", exact: true }).click();
    await page.getByRole("button", { name: "Restore details", exact: true }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("X");
    await page.getByLabel("Name", { exact: true }).fill("Recovered complete name");
    await page.getByText("Instructions and detailed classifications (optional)", { exact: true }).click();
    await expect(page.getByLabel("Aliases", { exact: true })).toHaveValue(invalidAliases);
    await page.getByRole("button", { name: "Save privately", exact: true }).click();
    await expect(page.getByLabel("Aliases", { exact: true })).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Recovered complete name");
    await expect(page.getByLabel("Aliases", { exact: true })).toHaveValue(invalidAliases);
    await page.getByLabel("Aliases", { exact: true }).fill("Recovered valid alias");
    await page.getByRole("button", { name: "Save privately", exact: true }).click();
    await expect(page).toHaveURL(/saved=1/);
  } finally { await service.auth.admin.deleteUser(account.data.user.id); }
});

test("share copy failure is announced and replacing a copied link resets feedback", async ({ page, context }) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname)) throw new Error("Local fixtures required");
  const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const email = `copy-link-${randomUUID()}@example.test`, password = "CopyFeedback2026!";
  const account = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  try {
    await owner.auth.signInWithPassword({ email, password });
    const draft = await owner.rpc("save_private_metadata", { p_patch: { name: "Share feedback" } });
    expect(draft.error).toBeNull();
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email); await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/my-exercises/${draft.data}/edit`);
    await page.getByRole("button", { name: "Create share link" }).click();
    await page.getByRole("button", { name: "Copy link", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Share link copied");
    await page.getByRole("button", { name: "Replace link", exact: true }).click();
    await expect(page.getByRole("button", { name: "Copy link", exact: true })).toBeVisible();
    await expect(page.getByText("Share link copied.", { exact: true })).not.toBeVisible();
    // Simulate an OS/browser clipboard denial while exercising the actual panel.
    await page.evaluate(() => { Object.defineProperty(navigator.clipboard, "writeText", { configurable: true, value: () => Promise.reject(new Error("denied")) }); });
    await page.getByRole("button", { name: "Copy link", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Could not copy" })).toBeVisible();
  } finally { await service.auth.admin.deleteUser(account.data.user.id); }
});

test("mobile navigation and detail title remain visible in both themes", async ({ page, publishedCableRaise }) => {
  mkdirSync(".local-artifacts/efficiency-review", { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  for (const theme of ["light", "dark"]) {
    await page.getByRole("combobox", { name: "Appearance", exact: true }).selectOption(theme);
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.local-artifacts/efficiency-review/home-mobile-${theme}.png`, fullPage: true });
  }
  await page.goto(`/exercises/${publishedCableRaise.slug}`);
  await expect(page.getByRole("heading", { name: publishedCableRaise.name, exact: true })).toBeInViewport();
  await expect(page.getByRole("link", { name: /Sign in to save/ })).toBeInViewport();
  await page.screenshot({ path: ".local-artifacts/efficiency-review/detail-mobile-dark.png", fullPage: true });
});
