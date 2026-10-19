import { expect, test, type APIRequestContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { cleanupLocalFixture } from "../helpers/local-fixtures";

test("password visibility and auth links preserve the original destination", async ({ page }) => {
  await page.goto("/sign-in?next=%2Fexercises%3Fequipment%3Dcable");
  const password = page.getByLabel("Password", { exact: true });
  await password.fill("PasswordManagerValue2026!");
  await page.getByRole("button", { name: "Show password", exact: true }).click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("PasswordManagerValue2026!");
  await page.getByRole("button", { name: "Hide password", exact: true }).click();
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("link", { name: "Create an account", exact: true }).click();
  await expect(page.locator('input[name="next"]')).toHaveValue("/exercises?equipment=cable");
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await page.getByRole("link", { name: "Forgot password?", exact: true }).click();
  await expect(page.locator('input[name="next"]')).toHaveValue("/exercises?equipment=cable");
  await page.goto(`/sign-in?next=${encodeURIComponent("/exercises?q=50%25")}`);
  await expect(page.locator('input[name="next"]')).toHaveValue("/exercises?q=50%25");
});

test("callback failures show recovery without reflecting provider error text", async ({ page }) => {
  await page.goto("/auth/callback?error=access_denied&error_description=DO_NOT_REFLECT&next=%2Fexercises");
  await expect(page).toHaveURL(/\/sign-in\?/);
  await expect(page.locator("#form-error")).toContainText("Google sign-in was canceled");
  await expect(page.getByText("DO_NOT_REFLECT")).toHaveCount(0);
  await expect(page.locator('input[name="next"]')).toHaveValue("/exercises");
});

test("opening an email link does not consume its token and failed confirmation offers a new link", async ({ page }) => {
  const response = await page.goto(`/auth/confirm?token_hash=${"a".repeat(64)}&type=email&next=%2Fexercises`);
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  await expect(page.getByRole("heading", { name: "Confirm your email", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Confirm email", exact: true }).click();
  await expect(page.locator("#form-error")).toContainText("expired");
  await page.getByRole("link", { name: "Send a new link", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Get a new confirmation link", exact: true })).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
});

async function localEmailLink(request: APIRequestContext, email: string, subject: string) {
  const mailUrl = "http://127.0.0.1:15424";
  let messageId: string | undefined;
  await expect.poll(async () => {
    const response = await request.get(`${mailUrl}/api/v1/search`, { params: { query: `to:${email}` } });
    if (!response.ok()) return false;
    const data = await response.json() as { messages: { ID: string; Subject: string }[] };
    messageId = data.messages.find(message => message.Subject.includes(subject))?.ID;
    return Boolean(messageId);
  }, { message: "The local inbox should receive the auth email", timeout: 20_000 }).toBe(true);
  const response = await request.get(`${mailUrl}/api/v1/message/${messageId}`);
  if (!response.ok()) throw new Error("Could not open the fixture's local auth email");
  const message = await response.json() as { HTML: string };
  const link = message.HTML.match(/href="([^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
  if (!link) throw new Error("The local auth email has no confirmation link");
  const destination = new URL(link);
  expect(destination.origin).toBe("http://127.0.0.1:3000");
  expect(destination.pathname).toBe("/auth/confirm");
  return link;
}

test("registration and recovery work through real local emails and retain combined catalog filters", async ({ page, request, browser }) => {
  test.setTimeout(120_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  test.skip(!url || !serviceKey, "Local Supabase credentials are required");
  expect(new URL(url!).hostname).toBe("127.0.0.1");
  const admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });
  const email = `auth-${randomUUID()}@example.test`;
  const password = "AuthFixturePassword2026!";
  const newPassword = "UpdatedAuthFixture2026!";
  const next = "/exercises?jointAction=shoulder-abduction&equipment=cable";
  let userId: string | undefined;
  let activePassword = password;
  try {
    await page.goto(`/sign-up?next=${encodeURIComponent(next)}`);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(page).toHaveURL(/\/check-email$/);
    await expect(page.getByRole("heading", { name: "Check your email", exact: true })).toBeVisible();
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email);
    await expect(page.getByRole("button", { name: /Resend available in/ })).toBeDisabled();
    const listed = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (listed.error) throw listed.error;
    const account = listed.data.users.find(user => user.email === email);
    if (!account) throw new Error("The registration fixture account was not created");
    userId = account.id;
    expect(Boolean(account.email_confirmed_at)).toBe(false);
    const link = await localEmailLink(request, email, "Confirm your KineVault email");
    await request.get(link);
    const prefetched = await admin.auth.admin.getUserById(userId);
    expect(Boolean(prefetched.data.user?.email_confirmed_at)).toBe(false);
    await page.goto(link);
    await page.getByRole("button", { name: "Confirm email", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/exercises\\?jointAction=shoulder-abduction&equipment=cable$`));
    await expect(page.getByRole("checkbox", { name: "Shoulder Abduction", exact: true })).toBeChecked();
    await expect(page.locator('input[name="equipment"][value="cable"]')).toBeChecked();

    await page.goto(`/reset-password?next=${encodeURIComponent(next)}`);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByRole("button", { name: "Send reset email", exact: true }).click();
    await expect(page).toHaveURL(/\/check-email$/);
    const resetLink = await localEmailLink(request, email, "Reset your KineVault password");
    await page.goto(resetLink);
    await page.getByRole("button", { name: "Choose a new password", exact: true }).click();
    await expect(page).toHaveURL(/\/reset-password\/update\?/);
    await page.getByLabel("Password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Set new password", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/exercises\\?jointAction=shoulder-abduction&equipment=cable$`));
    activePassword = newPassword;

    const context = await browser.newContext();
    try {
      const fresh = await context.newPage();
      await fresh.goto(`/sign-in?next=${encodeURIComponent(next)}`);
      await fresh.getByLabel("Email", { exact: true }).fill(email);
      await fresh.getByLabel("Password", { exact: true }).fill(newPassword);
      await fresh.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(fresh).toHaveURL(new RegExp(`/exercises\\?jointAction=shoulder-abduction&equipment=cable$`));
    } finally { await context.close(); }
  } finally {
    if (!userId) {
      const listed = await admin.auth.admin.listUsers({ perPage: 1000 });
      if (listed.error) throw listed.error;
      userId = listed.data.users.find(user => user.email === email)?.id;
    }
    if (userId) {
      const prepared = await admin.auth.admin.updateUserById(userId, { email_confirm: true, password: activePassword });
      if (prepared.error) throw prepared.error;
      await cleanupLocalFixture({ admin, userId, email, password: activePassword });
    }
  }
});

test("confirmation recovery fits a narrow viewport and has accessible form controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/check-email?kind=recovery");
  await expect(page.getByRole("heading", { name: "Get a new reset link", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send reset email", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("an unconfirmed login can resend a real confirmation email", async ({ page, request }) => {
  test.setTimeout(60_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  test.skip(!url || !serviceKey, "Local Supabase credentials are required");
  expect(new URL(url!).hostname).toBe("127.0.0.1");
  const admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });
  const email = `auth-resend-${randomUUID()}@example.test`;
  const password = "AuthResendFixture2026!";
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: false });
  if (created.error) throw created.error;
  const userId = created.data.user.id;
  try {
    await page.goto("/sign-in?next=%2Fexercises");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/check-email$/);
    await page.getByRole("button", { name: "Resend email", exact: true }).click();
    await expect(page.getByRole("button", { name: /Resend available in/ })).toBeDisabled();
    await expect(page.getByRole("status")).toContainText("a new link is on its way");
    const link = await localEmailLink(request, email, "Confirm your KineVault email");
    await page.goto(link);
    await page.getByRole("button", { name: "Confirm email", exact: true }).click();
    await expect(page).toHaveURL(/\/exercises$/);
  } finally {
    const prepared = await admin.auth.admin.updateUserById(userId, { email_confirm: true });
    if (prepared.error) throw prepared.error;
    await cleanupLocalFixture({ admin, userId, email, password });
  }
});

test("authentication stays accessible in desktop light and mobile dark views", async ({ page }) => {
  await mkdir(".local-artifacts/auth", { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
  await page.screenshot({ path: ".local-artifacts/auth/sign-in-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().addCookies([{ name: "kv-theme", value: "dark", url: "http://127.0.0.1:3000" }]);
  await page.goto("/sign-up");
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: ".local-artifacts/auth/sign-up-mobile-dark.png", fullPage: true });
});
