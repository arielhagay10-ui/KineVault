import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type BrowserContext } from "@playwright/test";
import { z } from "zod";
import { cleanupLocalFixture } from "../helpers/local-fixtures";

test("reviewer corrections and change requests reach the contributor", async ({ page, browser }) => {
  test.setTimeout(60_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!url || !["127.0.0.1", "localhost"].includes(new URL(url).hostname)) throw new Error("Moderation browser fixtures require local Supabase");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Local browser tests require SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const password = "LocalBrowserTestPass2026!";
  const suffix = Date.now();
  const ownerEmail = `review-owner-${suffix}@example.test`;
  const reviewerEmail = `reviewer-${suffix}@example.test`;
  const [ownerResult, reviewerResult] = await Promise.all([
    admin.auth.admin.createUser({ email: ownerEmail, password, email_confirm: true }),
    admin.auth.admin.createUser({ email: reviewerEmail, password, email_confirm: true }),
  ]);
  let ownerContext: BrowserContext | undefined;
  try {
  if (ownerResult.error || reviewerResult.error) throw new Error("Local review accounts could not be created");
  const reviewerId = z.uuid().parse(reviewerResult.data.user!.id);
  execFileSync("docker", ["exec", "supabase_db_kinevault", "psql", "-U", "postgres", "-d", "postgres", "-c",
    `update public.roles set role = 'reviewer' where user_id = '${reviewerId}';`], { stdio: "pipe" });
  const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { error: signInError } = await owner.auth.signInWithPassword({ email: ownerEmail, password });
  if (signInError) throw new Error("Local contributor sign-in failed");
  const { data: privateId, error: privateError } = await owner.rpc("save_private_exercise", {
    p_name: "Browser Review Raise", p_family_slug: "lateral-raise", p_primary_muscle_slugs: ["lateral-deltoid"], p_joint_action_slugs: ["shoulder-abduction"],
  });
  if (privateError) throw new Error("Review fixture could not be saved");
  const { error: sceneError } = await owner.rpc("save_private_scene", { p_private_id: privateId, p_scene: {
    durationMs: 1000, cameraAngle: "front", equipment: null,
    keyframes: [{ timeMs: 0, poses: { "left-shoulder": { z: 0 } } }, { timeMs: 1000, poses: { "left-shoulder": { z: -70 } } }],
  } });
  if (sceneError) throw new Error("Review scene could not be saved");
  const { data: submissionId, error: submissionError } = await owner.rpc("submit_private_exercise", { p_private_id: privateId, p_duplicate_disposition: "new" });
  if (submissionError) throw new Error("Review fixture could not be submitted");
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(reviewerEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto(`/admin/submissions/${submissionId}`);
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByRole("heading", { name: "Correct classifications" })).toBeVisible();
  const editor = page.getByRole("heading", { name: "Correct classifications" }).locator("..");
  await editor.getByLabel("Name", { exact: true }).fill("Corrected Browser Raise");
  await editor.getByLabel("Reviewer notes").fill("Cable geometry determines the external resistance profile.");
  await editor.getByLabel("Reason for corrections").fill("Corrected the name and documented setup uncertainty.");
  await editor.getByRole("button", { name: "Save corrections" }).click();
  await expect(page.getByText("Corrections saved in the review history.")).toBeVisible();
  await page.getByRole("combobox", { name: "Decision", exact: true }).selectOption("request_changes");
  await page.getByRole("combobox", { name: "Reason", exact: true }).selectOption("poor_media");
  await page.getByLabel("Review comment", { exact: true }).fill("Please show the full movement from the side.");
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByText("This review is changes requested.")).toBeVisible();

  ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await ownerPage.goto("/sign-in");
  await ownerPage.getByLabel("Email").fill(ownerEmail);
  await ownerPage.getByLabel("Password").fill(password);
  await ownerPage.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(ownerPage).toHaveURL(/\/dashboard$/);
  await ownerPage.getByRole("link", { name: "Review updates (1 unread)" }).click();
  await expect(ownerPage.getByText("Please show the full movement from the side.")).toBeVisible();
  await ownerPage.getByRole("link", { name: "Browser Review Raise" }).click();
  await expect(ownerPage.getByRole("heading", { name: "Browser Review Raise", exact: true })).toBeVisible();
  await expect(ownerPage.locator("ins").filter({ hasText: "Corrected Browser Raise" })).toBeVisible();
  expect((await ownerPage.goto("/admin"))?.status()).toBe(404);
  } finally {
    const cleanup = await Promise.allSettled([
      ...(ownerContext ? [ownerContext.close()] : []),
      ...(ownerResult.data.user ? [cleanupLocalFixture({ admin, userId: ownerResult.data.user.id, email: ownerEmail, password })] : []),
      ...(reviewerResult.data.user ? [cleanupLocalFixture({ admin, userId: reviewerResult.data.user.id, email: reviewerEmail, password })] : []),
    ]);
    const failures = cleanup.filter(result => result.status === "rejected").map(result => result.reason);
    if (failures.length) throw new AggregateError(failures, "Moderation fixture cleanup failed");
  }
});
