import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { changingElbowPulloverScene, nearLimitPulloverScene, sharedDumbbellScene } from "../helpers/shared-dumbbell";
import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { dismissWorkshopTutorial, jointField, openWorkshopTool, selectWorkshopJoint, selectWorkshopMoment, selectWorkshopObject } from "./workshop-menu.helpers";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });

for (const variant of ["goblet", "pullover", "near-limit-pullover", "varying-pullover", "left-arm-pullover"] as const) test(`two-handed dumbbell ${variant} stays attached during playback, arm edits and reload`, async ({ page }) => {
  test.setTimeout(180_000); page.setDefaultTimeout(45_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const email = `shared-dumbbell-${randomUUID()}@example.test`, password = `Shared-${randomUUID()}!`;
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  try {
    await owner.auth.signInWithPassword({ email, password });
    const { scene } = variant === "near-limit-pullover" ? nearLimitPulloverScene()
      : variant === "varying-pullover" || variant === "left-arm-pullover" ? changingElbowPulloverScene(variant === "left-arm-pullover" ? "left" : undefined)
      : sharedDumbbellScene(variant);
    const created = await owner.rpc("save_workshop_draft", { p_scene: scene, p_name: `Shared dumbbell ${variant}` });
    if (created.error) throw created.error;
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/my-exercises/${created.data}/workshop`); await dismissWorkshopTutorial(page);
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await selectWorkshopObject(page, "Dumbbell"); await openWorkshopTool(page, "Contacts");
    if (variant === "goblet" || variant === "pullover") await page.getByRole("button", { name: "Hold with both hands", exact: true }).click();
    const selected = page.locator('section[aria-label="Selected item"]');
    await expect(selected).toHaveAttribute("data-grip-reachable", "true");
    const artifacts = `.local-artifacts/workshop-three-comments/${variant}`; mkdirSync(artifacts, { recursive: true });
    await openWorkshopTool(page, "Timeline");
    for (const view of ["Three-quarter", "Side"]) {
      await page.getByRole("button", { name: view, exact: true }).click();
      for (let step = 0; step <= 16; step++) {
        await page.getByLabel("Preview time", { exact: true }).fill(String(step * 200));
        await expect(selected).toHaveAttribute("data-grip-reachable", "true");
        if (step % 2 === 0) await page.locator("canvas").screenshot({ path: `${artifacts}/${view}-${step}.png` });
      }
    }
    await page.getByRole("button", { name: "Play", exact: true }).click();
    const initial = await page.getByLabel("Preview time", { exact: true }).inputValue();
    await expect.poll(() => page.getByLabel("Preview time", { exact: true }).inputValue()).not.toBe(initial);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    if (variant === "goblet") {
      await openWorkshopTool(page, "Settings");
      await page.getByRole("combobox", { name: /^Movement setup/ }).selectOption("free");
      await selectWorkshopMoment(page, "Finish"); await openWorkshopTool(page, "Pose"); await selectWorkshopJoint(page, "Left elbow");
      await jointField(page, "x").fill("95"); await jointField(page, "x").press("Enter");
      await page.getByRole("button", { name: "Capture pose", exact: true }).click();
      await selectWorkshopObject(page, "Dumbbell"); await openWorkshopTool(page, "Contacts");
      await expect(selected).toHaveAttribute("data-grip-reachable", "true");
    }
    await page.getByRole("button", { name: "Save exercise", exact: true }).click();
    await expect(page.getByText(/Saved at.*Private/)).toBeVisible();
    await page.reload(); await dismissWorkshopTutorial(page);
    await expect(page.locator('[data-equipment-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await selectWorkshopObject(page, "Dumbbell"); await openWorkshopTool(page, "Contacts");
    await expect(page.getByRole("button", { name: "Hold with both hands", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(selected).toHaveAttribute("data-grip-reachable", "true");
    await page.locator("canvas").screenshot({ path: `${artifacts}/reloaded.png` });
    expect(errors).toEqual([]);
  } finally { await page.close(); await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password, owner }); }
});
