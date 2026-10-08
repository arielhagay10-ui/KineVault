import { dismissWorkshopTutorial } from "./workshop-menu.helpers";
import { expect, test, type BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { jointField, openWorkshopMenu, selectWorkshopJoint } from "./workshop-menu.helpers";

test("an owner can save, share, and revoke a private exercise", async ({ page, browser }) => {
  test.setTimeout(90_000);
  page.setDefaultTimeout(15_000);
  const email = `kinevault-e2e-${Date.now()}@example.test`;
  const password = "ExamplePassphrase2026!";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  let userId: string | undefined;
  let anonymous: BrowserContext | undefined;
  try {
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const account = await owner.auth.signInWithPassword({ email, password });
  if (account.error) throw account.error;
  userId = account.data.user.id;

  await page.goto("/my-exercises/new");
    await dismissWorkshopTutorial(page);
  await page.getByRole("button", { name: "Name and save", exact: true }).click();
  await page.getByLabel("Exercise name", { exact: true }).fill("Private Cable Raise");
  await openWorkshopMenu(page);
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
  await page.getByRole("button", { name: "Advanced editing", exact: true }).click();
  await page.getByRole("tab", { name: "Settings", exact: true }).click();
  await page.getByText("Advanced settings", { exact: true }).click();
  await page.getByLabel("Legacy demo equipment").selectOption("single-cable");
  await page.getByRole("tab", { name: "Timeline", exact: true }).click();
  await page.getByRole("button", { name: /^Finish ·/ }).click();
  await page.getByRole("tab", { name: "Pose", exact: true }).click();
  await selectWorkshopJoint(page, "Left shoulder");
  await jointField(page, "z").fill("-80");
  await jointField(page, "z").blur();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/Saved at.*Private/)).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Advanced editing", exact: true }).click();
  await page.getByRole("tab", { name: "Timeline", exact: true }).click();
  await page.getByRole("button", { name: /^Finish ·/ }).click();
  await page.getByRole("tab", { name: "Pose", exact: true }).click();
  await selectWorkshopJoint(page, "Left shoulder");
  await expect(jointField(page, "z")).toHaveValue("-80");
  await openWorkshopMenu(page);
  await page.getByRole("button", { name: "Save & add details", exact: false }).click();

  await page.getByRole("link", { name: "Submit for review" }).click();
  await expect(page.getByRole("heading", { name: "Ready for review" })).toBeVisible();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page).toHaveURL(/\/submissions\/[0-9a-f-]+$/);
  await expect(page.getByText(/submitted ·/)).toBeVisible();
  await page.getByRole("button", { name: "Inspect motion in 3D", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Motion study" })).toBeVisible();
  await page.getByRole("link", { name: "Edit my private copy" }).click();

  await page.getByRole("button", { name: "Create share link" }).click();
  const relativeLink = await page.getByRole("textbox", { name: "Share link" }).inputValue();
  expect(relativeLink).toMatch(/^\/shared\/[A-Za-z0-9_-]{43}$/);

  anonymous = await browser.newContext();
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
  } finally {
    try {
      if (anonymous) await anonymous.close();
    } finally {
      if (!userId) {
        const account = await owner.auth.signInWithPassword({ email, password });
        userId = account.data.user?.id;
      }
      if (userId) await cleanupLocalFixture({ admin, userId, email, password });
    }
  }
});
