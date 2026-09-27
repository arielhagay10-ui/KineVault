import { expect, test } from "@playwright/test";

test("an owner can save, share, and revoke a private exercise", async ({ page, browser }) => {
  const email = `kinevault-e2e-${Date.now()}@example.test`;
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("ExamplePassphrase2026!");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/my-exercises/new");
  await page.getByLabel("Name").fill("Private Cable Raise");
  await page.getByLabel("Short description").fill("My cable raise variation.");
  await page.getByLabel("Exercise family").selectOption("lateral-raise");
  await page.getByRole("group", { name: "Primary muscles" }).getByLabel("Lateral Deltoid").check();
  await page.getByRole("group", { name: "Joint actions" }).getByLabel("Shoulder Abduction").check();
  await page.getByRole("group", { name: "Equipment" }).getByLabel("Cable", { exact: true }).check();
  await page.getByRole("button", { name: "Save privately" }).click();
  await expect(page).toHaveURL(/\/my-exercises\/[0-9a-f-]+\/edit\?saved=1$/);
  await expect(page.getByText("Saved privately.")).toBeVisible();

  await page.getByRole("button", { name: "Create share link" }).click();
  const relativeLink = await page.getByRole("textbox", { name: "Share link" }).inputValue();
  expect(relativeLink).toMatch(/^\/shared\/[A-Za-z0-9_-]{43}$/);

  const anonymous = await browser.newContext();
  const sharedPage = await anonymous.newPage();
  await sharedPage.goto(relativeLink);
  await expect(sharedPage.getByRole("heading", { name: "Private Cable Raise" })).toBeVisible();
  await expect(sharedPage.getByText("My cable raise variation.")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Revoke link" }).click();
  await expect(page.getByText("No active share link.")).toBeVisible();
  const revokedResponse = await sharedPage.reload();
  expect(revokedResponse?.status()).toBe(404);
  await anonymous.close();
});
