import { expect, test } from "@playwright/test";

test("an owner can save, share, and revoke a private exercise", async ({ page, browser }) => {
  const email = `kinevault-e2e-${Date.now()}@example.test`;
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("ExamplePassphrase2026!");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/my-exercises/new");
  await page.getByRole("button", { name: "Save & add details", exact: false }).click();
  await expect(page).toHaveURL(/\/my-exercises\/[0-9a-f-]+\/edit\?sceneSaved=1$/);
  await page.getByLabel("Name").fill("Private Cable Raise");
  await page.getByText("Description, equipment and classifications (optional)", { exact: true }).click();
  await page.getByLabel("Short description").fill("My cable raise variation.");
  await page.getByLabel("Exercise family").selectOption("lateral-raise");
  await page.getByText("Anatomy (optional)", { exact: true }).click();
  await page.getByRole("group", { name: "Primary muscles" }).getByLabel("Lateral Deltoid").check();
  await page.getByRole("group", { name: "Joint actions" }).getByLabel("Shoulder Abduction", { exact: true }).check();
  await page.getByRole("group", { name: "Equipment" }).getByLabel("Cable", { exact: true }).check();
  await page.getByText("Instructions and detailed classifications (optional)", { exact: true }).click();
  await page.getByLabel("Execution", { exact: true }).fill("Raise the upper arm with a controlled motion.");
  await page.getByLabel("Laterality", { exact: true }).selectOption("unilateral");
  await page.getByLabel("Aliases", { exact: true }).fill("My cable abduction");
  await page.getByRole("button", { name: "Save privately" }).click();
  await expect(page).toHaveURL(/\/my-exercises\/[0-9a-f-]+\/edit\?saved=1$/);
  await expect(page.getByText("Saved privately.")).toBeVisible();
  await page.getByText("Instructions and detailed classifications (optional)", { exact: true }).click();
  await expect(page.getByLabel("Execution", { exact: true })).toHaveValue("Raise the upper arm with a controlled motion.");
  await expect(page.getByLabel("Laterality", { exact: true })).toHaveValue("unilateral");

  await page.getByRole("link", { name: "Open motion workshop" }).click();
  await expect(page.getByRole("heading", { name: "Private Cable Raise" })).toBeVisible();
  await page.getByText("Advanced settings", { exact: true }).click();
  await page.getByLabel("Legacy demo equipment").selectOption("single-cable");
  await page.getByText("Animate movement", { exact: false }).first().click();
  await page.getByRole("button", { name: /Keyframe 2/ }).click();
  await page.getByRole("button", { name: "Pose body", exact: true }).click();
  await page.getByRole("button", { name: "Left shoulder", exact: true }).click();
  await page.getByLabel("Joint Z", { exact: true }).fill("-80");
  await page.getByRole("button", { name: "Save scene" }).click();
  await expect(page.getByText("Scene saved privately.")).toBeVisible();
  await page.reload();
  await page.getByText("Animate movement", { exact: false }).first().click();
  await page.getByRole("button", { name: /Keyframe 2/ }).click();
  await page.getByRole("button", { name: "Pose body", exact: true }).click();
  await page.getByRole("button", { name: "Left shoulder", exact: true }).click();
  await expect(page.getByLabel("Joint Z", { exact: true })).toHaveValue("-80");
  await page.getByRole("link", { name: "Exercise details" }).click();

  await page.getByRole("link", { name: "Submit for review" }).click();
  await expect(page.getByRole("heading", { name: "Ready for review" })).toBeVisible();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page).toHaveURL(/\/submissions\/[0-9a-f-]+$/);
  await expect(page.getByText(/submitted ·/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Motion study" })).toBeVisible();
  await page.getByRole("link", { name: "Edit my private copy" }).click();

  await page.getByRole("button", { name: "Create share link" }).click();
  const relativeLink = await page.getByRole("textbox", { name: "Share link" }).inputValue();
  expect(relativeLink).toMatch(/^\/shared\/[A-Za-z0-9_-]{43}$/);

  const anonymous = await browser.newContext();
  const sharedPage = await anonymous.newPage();
  await sharedPage.goto(relativeLink);
  await expect(sharedPage.getByRole("heading", { name: "Private Cable Raise" })).toBeVisible();
  await expect(sharedPage.getByText("My cable raise variation.")).toBeVisible();
  await expect(sharedPage.getByRole("heading", { name: "Motion study" })).toBeVisible();
  await expect(sharedPage.getByText("Raise the upper arm with a controlled motion.", { exact: true })).toBeVisible();
  await expect(sharedPage.getByText("My cable abduction", { exact: true })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Revoke link" }).click();
  await expect(page.getByText("No active share link.")).toBeVisible();
  const revokedResponse = await sharedPage.reload();
  expect(revokedResponse?.status()).toBe(404);
  await anonymous.close();
});
