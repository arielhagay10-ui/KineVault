import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page, type Locator } from "@playwright/test";
import { blankWorkshopScene } from "../../src/lib/motion/workshop";
import { setWorkshopLanguage, openWorkshopTool } from "./workshop-menu.helpers";
import { createQuickScene } from "../../src/lib/motion/quick-create";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });
const folder = ".local-artifacts/workshop/limb-posing";
async function drag(page: Page, handle: Locator, dx: number, dy: number, cancel = false) {
  await handle.scrollIntoViewIfNeeded();
  const bounds = (await handle.boundingBox())!;
  const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 12 });
  if (cancel) await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
}

test.beforeEach(async ({ page }) => page.setDefaultTimeout(60_000));

test("hands and feet drag, cancel, undo, and survive saved preview without detaching contacts", async ({ page }) => {
  test.setTimeout(180_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `limb-${Date.now()}@example.test`, password = "LimbFixture2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;

  try {
    const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    await owner.auth.signInWithPassword({ email, password });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    mkdirSync(folder, { recursive: true });
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/);
    const scene = structuredClone(blankWorkshopScene); scene.studio!.presentation = { highlight: "group:abs", isolate: false, view: "three_quarter" };
    const created = await owner.rpc("create_workshop_exercise", { p_scene: scene }); if (created.error) throw created.error;
    await page.goto(`/my-exercises/${created.data}/workshop`);
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "View finish", exact: true }).click();
    await page.getByRole("button", { name: "Pose hands and feet", exact: true }).click();
    await expect(page.getByLabel("Editing pose", { exact: true })).toHaveValue("1");
    await expect(page.getByLabel("Preview time", { exact: true })).toHaveValue("1600");
    await expect(page.getByRole("button", { name: /^Drag (Left|Right) (hand|foot)$/ })).toHaveCount(4);
    await page.getByRole("button", { name: "Front", exact: true }).click();
    // A changing reach advisory must not resize the canvas or disrupt pointer capture.
    const preview = page.getByLabel("3D exercise preview", { exact: true });
    const hand = page.getByRole("button", { name: "Drag Left hand", exact: true });
    await hand.hover();
    const initialPreview = (await preview.boundingBox())!;
    const handBounds = (await hand.boundingBox())!;
    const handX = handBounds.x + handBounds.width / 2, handY = handBounds.y + handBounds.height / 2;
    await page.mouse.move(handX, handY); await page.mouse.down();
    await page.mouse.move(handX + 600, handY - 600, { steps: 12 });
    const reachMessage = "This target is beyond the limb's reach or joint limits. The closest pose within joint limits is shown.";
    await page.getByText(reachMessage, { exact: true }).first().waitFor({ state: "attached" });
    const limitedPreview = (await preview.boundingBox())!;
    expect(limitedPreview.y).toBeCloseTo(initialPreview.y, 0);
    expect(limitedPreview.height).toBeCloseTo(initialPreview.height, 0);
    await page.mouse.up();
    const feedback = page.getByRole("button", { name: "Pose limit", exact: true });
    await expect(feedback).toBeVisible();
    await feedback.focus();
    await expect(page.getByRole("tooltip")).toHaveText(reachMessage);
    await page.screenshot({ path: `${folder}/pose-limit.png` });
    await page.setViewportSize({ width: 1003, height: 871 });
    await hand.focus();
    const narrowPreview = (await preview.boundingBox())!;
    const narrowFeedback = (await feedback.boundingBox())!;
    expect(narrowFeedback.x).toBeGreaterThanOrEqual(narrowPreview.x);
    expect(narrowFeedback.y).toBeGreaterThanOrEqual(narrowPreview.y);
    expect(narrowFeedback.x + narrowFeedback.width).toBeLessThanOrEqual(narrowPreview.x + narrowPreview.width);
    expect(narrowFeedback.y + narrowFeedback.height).toBeLessThanOrEqual(narrowPreview.y + narrowPreview.height);
    await expect(page.getByRole("tooltip")).not.toBeVisible();
    await page.screenshot({ path: `${folder}/pose-limit-narrow.png` });
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.getByRole("button", { name: "Undo", exact: true }).first().click();
    await drag(page, hand, 10, -10, true);
    await expect(feedback).toHaveCount(0);
    const restoredPreview = (await preview.boundingBox())!;
    expect(restoredPreview.y).toBeCloseTo(initialPreview.y, 0);
    expect(restoredPreview.height).toBeCloseTo(initialPreview.height, 0);
    await drag(page, page.getByRole("button", { name: "Drag Left hand", exact: true }), 25, -65);
    await expect(page.getByRole("button", { name: "Undo", exact: true }).first()).toBeEnabled();
    const canvas = page.locator("canvas");
    const hash = async () => {
      // Escape changes the visible focus ring; compare the pose with no focused button.
      await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
      return createHash("sha256").update(await canvas.screenshot()).digest("hex");
    };
    const moved = await hash();
    await canvas.screenshot({ path: `${folder}/before-cancel.png` });
    await drag(page, page.getByRole("button", { name: "Drag Left hand", exact: true }), -25, -20, true);
    await canvas.screenshot({ path: `${folder}/after-cancel.png` });
    expect(await hash()).toBe(moved);
    await page.getByRole("button", { name: "Undo", exact: true }).first().click();
    expect(await hash()).not.toBe(moved);
    await page.getByRole("button", { name: "Redo", exact: true }).first().click();
    expect(await hash()).toBe(moved);
    await drag(page, page.getByRole("button", { name: "Drag Right hand", exact: true }), -25, -65);
    await page.getByRole("button", { name: "Side", exact: true }).click();
    await drag(page, page.getByRole("button", { name: "Drag Left foot", exact: true }), 15, -35);
    await page.getByRole("button", { name: "Check foot contact", exact: true }).focus();
    await expect(page.getByRole("tooltip")).toHaveText("Foot contact changed. Check the sole and floor from Side view before saving.");
    await page.getByRole("button", { name: "Drag Right foot", exact: true }).press("ArrowUp");
    await page.screenshot({ path: `${folder}/controls.png`, fullPage: true });
    await page.getByRole("button", { name: "Name and save", exact: true }).click();
    await page.getByRole("button", { name: "Save privately", exact: true }).click();
    await expect(page.getByRole("article", { name: "Saved private exercise" })).toBeVisible();
    const record = await owner.from("private_exercises").select("content_id").eq("id", created.data).single(); if (record.error) throw record.error;
    const saved = await owner.from("exercise_scenes").select("id,studio_layout,motion_style").eq("content_id", record.data.content_id).single(); if (saved.error) throw saved.error;
    const frames = await owner.from("motion_keyframes").select("position_ms,motion_joint_poses(rotation_x,rotation_y,rotation_z,rotation_w,rig_joints(slug))").eq("scene_id", saved.data.id).order("position_ms"); if (frames.error) throw frames.error;
    expect(frames.data[0].motion_joint_poses).toHaveLength(0);
    expect(frames.data[2].motion_joint_poses).toHaveLength(0);
    expect(frames.data[1].motion_joint_poses).toHaveLength(8);
    expect(saved.data.studio_layout).toMatchObject({ presentation: { highlight: "group:abs" }, objects: [] });
    expect(saved.data.motion_style).toBe("free");
    await page.reload(); await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "View finish", exact: true }).click();
    for (const view of ["Three-quarter", "Side"]) {
      await page.getByRole("button", { name: view, exact: true }).click();
      for (let i = 0; i <= 16; i++) {
        await page.getByLabel("Preview time", { exact: true }).fill(String(scene.durationMs * i / 16));
        await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
        await canvas.screenshot({ path: `${folder}/${view.toLowerCase()}-${i}.png` });
      }
    }
    for (const speed of ["1", "0.25"]) {
      await page.getByLabel("Preview speed", { exact: true }).selectOption(speed);
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await page.waitForTimeout(scene.durationMs / Number(speed) + 400);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
    }
    await page.getByRole("button", { name: "Pose hands and feet", exact: true }).click();
    await expect(page.getByRole("button", { name: /^Drag (Left|Right) (hand|foot)$/ })).toHaveCount(0);
    await expect(page.getByText("Choose Edit this moment to pose the displayed time.")).toBeVisible();
    await page.getByRole("button", { name: "View finish", exact: true }).click();
    await expect(page.getByRole("button", { name: /^Drag (Left|Right) (hand|foot)$/ })).toHaveCount(4);
    await openWorkshopTool(page, "Timeline");
    await page.getByRole("button", { name: "Edit this moment", exact: true }).click();
    await expect(page.getByRole("button", { name: /^Drag (Left|Right) (hand|foot)$/ })).toHaveCount(4);
    await setWorkshopLanguage(page, "he");
    await expect(page.getByRole("button", { name: "גרירת יד שמאל", exact: true })).toBeVisible();
    await page.setViewportSize({ width: 320, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.goto("/my-exercises");
    await page.getByRole("button", { name: "Preview saved motion", exact: true }).click();
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await page.getByRole("slider", { name: /^Preview time for / }).fill("1600");
    await page.locator("canvas").screenshot({ path: `${folder}/library-preview.png` });
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.waitForTimeout(scene.durationMs + 300);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    const pec = createQuickScene("pec-deck");
    const machine = await owner.rpc("create_workshop_exercise", { p_scene: pec }); if (machine.error) throw machine.error;
    await page.goto(`/my-exercises/${machine.data}/workshop`); await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Pose hands and feet", exact: true }).click();
    await expect(page.getByRole("button", { name: /^Drag (Left|Right) (hand|foot)$/ })).toHaveCount(0);
    await expect(page.getByText("Leave the machine to pose hands and feet freely. Move its handles to keep contact.")).toBeVisible();
    expect(errors).toEqual([]);
  } finally { await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password }); }
});
