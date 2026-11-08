import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { captureEvidence } from "../helpers/ci";
import { blankWorkshopScene, identityTransform, type StudioLayout, type WorkshopScene } from "../../src/lib/motion/workshop";
import { createStudioObject } from "../../src/lib/motion/studio";
import { jointField, openWorkshopTool, selectWorkshopJoint, selectWorkshopObject } from "./workshop-menu.helpers";

test.use({ viewport: { width: 1440, height: 1000 }, launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });

const arms = (shoulder: number[], elbow: number) => ({ "left-shoulder": { x: shoulder[0], y: shoulder[1], z: shoulder[2] }, "right-shoulder": { x: shoulder[0], y: -shoulder[1], z: -shoulder[2] },
  "left-elbow": { x: elbow, y: 0, z: 0 }, "right-elbow": { x: elbow, y: 0, z: 0 }, "left-knee": { x: -25, y: 0, z: 0 }, "right-knee": { x: -25, y: 0, z: 0 } });

test("hanging from the pull-up bar follows the arms, locks placement and survives release, save and reload", async ({ page }) => {
  test.setTimeout(240_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname)) throw Error("Local fixtures only");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `pull-up-${randomUUID()}@example.test`, password = `PullUp-${randomUUID()}!`;
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const errors: string[] = [], evidence = ".local-artifacts/workshop/pull-up";
  mkdirSync(evidence, { recursive: true });
  page.on("pageerror", error => errors.push(error.message));
  try {
    const login = await owner.auth.signInWithPassword({ email, password });
    if (login.error) throw login.error;
    const bar = { ...createStudioObject("pull-up-bar", randomUUID(), 0), ...identityTransform, attachment: "both" as const };
    const scene: WorkshopScene = { ...structuredClone(blankWorkshopScene), keyframes: [
      { timeMs: 0, poses: arms([0, 0, -162], 6) }, { timeMs: 1600, poses: arms([-5, 5, -65], 135) }, { timeMs: 3200, poses: arms([0, 0, -162], 6) }],
      studio: { body: { ...identityTransform }, objects: [bar] } };
    const created = await owner.rpc("create_workshop_exercise", { p_scene: scene });
    if (created.error) throw created.error;
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/my-exercises/${created.data}/workshop`);
    await expect(page.locator('[data-equipment-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await selectWorkshopObject(page, "Anatomical figure");
    await openWorkshopTool(page, "Position");
    await expect(page.getByText("The figure hangs from the bar. Select the bar to move it, or release the bar to place the figure freely.", { exact: true })).toBeVisible();
    // The arms set the height, so they stay posable while hanging.
    await openWorkshopTool(page, "Pose");
    await selectWorkshopJoint(page, "Left shoulder");
    await expect(jointField(page, "x")).toBeEnabled();
    await page.getByRole("button", { name: "Front", exact: true }).click();
    for (const [name, time] of [["hang", 0], ["top", 1600]] as const) {
      await page.getByLabel("Preview time", { exact: true }).fill(String(time));
      await captureEvidence(page.locator("canvas"), `${evidence}/${name}.png`);
    }
    const release = page.getByRole("region", { name: "Workshop actions", exact: true }).getByRole("button", { name: "Release bar", exact: true });
    await release.click();
    await expect(release).toHaveCount(0);
    await selectWorkshopObject(page, "Pull-up bar");
    await openWorkshopTool(page, "Contacts");
    await expect(page.getByRole("button", { name: "Hold with left hand", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Hold with both hands", exact: true }).click();
    await expect(page.getByText("The hands carry the body. Pose the shoulders and elbows to raise or lower it; the legs hang freely.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Save exercise", exact: true }).click();
    await expect(page.getByText(/Saved at.*Private/)).toBeVisible();
    await page.reload();
    await expect(page.locator('[data-equipment-state="ready"]')).toBeVisible({ timeout: 60_000 });
    const record = await owner.from("private_exercises").select("content_id").eq("id", created.data).single();
    if (record.error) throw record.error;
    const saved = await owner.from("exercise_scenes").select("studio_layout").eq("content_id", record.data.content_id).single();
    if (saved.error) throw saved.error;
    expect((saved.data.studio_layout as StudioLayout).objects[0]).toMatchObject({ slug: "pull-up-bar", attachment: "both" });
    expect(errors).toEqual([]);
  } finally { await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password }); }
});
