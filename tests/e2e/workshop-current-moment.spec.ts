import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { blankWorkshopScene, identityTransform } from "../../src/lib/motion/workshop";
import { createStudioObject } from "../../src/lib/motion/studio";
import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { jointField, openWorkshopTool, selectWorkshopJoint } from "./workshop-menu.helpers";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });

test("single joint edits follow the scrubbed time and preserve other poses after reload", async ({ page }) => {
  test.setTimeout(180_000); page.setDefaultTimeout(15_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `current-moment-${randomUUID()}@example.test`, password = "CurrentMomentFixture2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true }); if (account.error) throw account.error;
  try {
    const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    await owner.auth.signInWithPassword({ email, password });
    const scene = structuredClone(blankWorkshopScene);
    const bench = { ...createStudioObject("bench", randomUUID(), 0), ...identityTransform, benchAngle: 0 };
    const weights = (["left", "right"] as const).map((side, index) => ({ ...createStudioObject("dumbbell", randomUUID(), index + 1), attachment: side, poseDriver: "arm" as const }));
    scene.studio = { body: identityTransform, objects: [bench, ...weights], seating: { benchId: bench.id, facing: "supine" } };
    scene.keyframes = [0, 1600, 3200].map(timeMs => ({ timeMs, poses: { "left-elbow": { x: timeMs === 1600 ? 40 : 10, y: 0, z: 0 }, "right-elbow": { x: 15, y: 0, z: 0 } } }));
    const created = await owner.rpc("save_workshop_draft", { p_scene: scene, p_name: "Current moment regression" }); if (created.error) throw created.error;
    await page.setViewportSize({ width: 1383, height: 1000 });
    await page.goto("/sign-in"); await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/my-exercises/${created.data}/workshop`); await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await selectWorkshopJoint(page, "Left elbow");
    const scrubber = page.getByLabel("Preview time", { exact: true });
    await scrubber.fill("1070");
    await jointField(page, "x").fill("65"); await jointField(page, "x").press("Enter");
    await expect(scrubber).toHaveValue("1070");
    await expect(page.getByLabel("Editing pose", { exact: true }).locator("option:checked")).toContainText("1.07s");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.getByLabel("Editing pose", { exact: true }).locator("option")).toHaveCount(3);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await scrubber.fill("1600"); await expect(jointField(page, "x")).toHaveValue("40");
    await jointField(page, "x").fill("80"); await jointField(page, "x").press("Enter");
    await scrubber.fill("2400"); await selectWorkshopJoint(page, "Right elbow");
    await expect(scrubber).toHaveValue("2400");
    await jointField(page, "x").fill("55"); await jointField(page, "x").press("Enter");
    await page.getByRole("button", { name: "Capture pose", exact: true }).click();
    await page.getByRole("button", { name: "Save exercise", exact: true }).click(); await expect(page.getByText(/^Saved at .* · Private$/)).toBeVisible();
    await page.reload(); await selectWorkshopJoint(page, "Left elbow");
    for (const [time, value] of [[0, 10], [1070, 65], [1600, 80], [3200, 10]]) {
      await scrubber.fill(String(time)); await expect(jointField(page, "x")).toHaveValue(String(value));
    }
    await scrubber.fill("2400"); await selectWorkshopJoint(page, "Right elbow"); await expect(jointField(page, "x")).toHaveValue("55");
    await openWorkshopTool(page, "Timeline");
    await expect(page.getByLabel("Scrub timeline", { exact: true })).toHaveCount(0);
    const evidence = ".local-artifacts/workshop/current-moment"; mkdirSync(evidence, { recursive: true });
    await page.screenshot({ path: `${evidence}/timeline-desktop.png` });
    await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole("tabpanel", { name: "Timeline", exact: true }).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `${evidence}/timeline-mobile.png` });
  } finally { await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password }); }
});
