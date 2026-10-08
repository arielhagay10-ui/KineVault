import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { dismissWorkshopTutorial, openWorkshopTool } from "./workshop-menu.helpers";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { createQuickScene } from "../../src/lib/motion/quick-create";
import { selectWorkshopJoint, jointField, setWorkshopMode, setWorkshopLanguage } from "./workshop-menu.helpers";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });

async function dragLimb(page: Page, name: string, dx: number, dy: number) {
  await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
  const handle = page.getByRole("button", { name, exact: true });
  await handle.scrollIntoViewIfNeeded();
  const bounds = (await handle.boundingBox())!;
  const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  await expect(handle).toBeFocused();
  await page.mouse.move(x + dx, y + dy, { steps: 12 }); await page.mouse.up();
  await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
}

test("free cable poses, explicit row contacts, undo and saved playback", async ({ page }) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(60_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `free-cable-${Date.now()}@example.test`, password = "FreeCableFixture2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;

  try {
    const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    await owner.auth.signInWithPassword({ email, password });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const folder = ".local-artifacts/workshop/freedom";
    mkdirSync(folder, { recursive: true });
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/my-exercises/new");
    await dismissWorkshopTutorial(page);
    await expect(page.getByRole("button", { name: "Dumbbell", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Add equipment", exact: true }).click();
    await page.getByRole("dialog").getByRole("searchbox").fill("Cable row");
    await page.getByRole("dialog").getByRole("button", { name: "Cable row", exact: true }).click();
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Leave machine", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Edit finish", exact: true }).click();
    await expect(page.getByRole("button", { name: /^Drag (Left|Right) (hand|foot)$/ })).toHaveCount(4);
    await openWorkshopTool(page, "Contacts");
    await page.getByLabel("Selected equipment", { exact: true }).selectOption({ label: "Cable row" });
    await page.getByRole("button", { name: "Use this machine", exact: true }).click();
    await expect(page.getByRole("button", { name: "Leave machine", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Drag (Left|Right) (hand|foot)$/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Free cable movement", exact: true }).click();
    await expect(page.getByRole("button", { name: "Leave machine", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Undo", exact: true }).first().click();
    await expect(page.getByRole("button", { name: "Leave machine", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Redo", exact: true }).first().click();
    await setWorkshopMode(page, "quick");
    await page.getByRole("button", { name: "Edit start", exact: true }).click();
    await expect(page.getByLabel("Editing pose", { exact: true })).toHaveValue("0");
    await page.getByRole("button", { name: "Edit finish", exact: true }).click();
    await expect(page.getByLabel("Editing pose", { exact: true })).toHaveValue("1");
    await expect(page.getByRole("button", { name: /^Drag (Left|Right) (hand|foot)$/ })).toHaveCount(4);
    await page.getByRole("button", { name: "Front", exact: true }).click();
    await dragLimb(page, "Drag Left hand", 10, -35);
    await dragLimb(page, "Drag Right hand", -10, -35);
    await page.getByRole("button", { name: "Side", exact: true }).click();
    await dragLimb(page, "Drag Left foot", 20, -20);
    await dragLimb(page, "Drag Right foot", 20, -20);
    await selectWorkshopJoint(page, "Left hip");
    await jointField(page, "x").fill("25"); await jointField(page, "x").press("Enter");
    await expect(jointField(page, "x")).toHaveValue("25");
    await selectWorkshopJoint(page, "Torso");
    await jointField(page, "x").fill("15"); await jointField(page, "x").press("Enter");
    await page.getByRole("button", { name: "View start", exact: true }).click();
    await expect(page.getByLabel("Editing pose", { exact: true })).toHaveValue("0");
    await expect(jointField(page, "x")).toHaveValue("0");
    await page.getByRole("button", { name: "View finish", exact: true }).click();
    await expect(jointField(page, "x")).toHaveValue("15");
    await selectWorkshopJoint(page, "Left hip");
    await expect(jointField(page, "x")).toHaveValue("25");
    await setWorkshopMode(page, "quick");
    await page.getByRole("button", { name: "Match return to start", exact: true }).click();
    await page.getByRole("button", { name: "Name and save", exact: true }).click();
    await page.getByLabel("Exercise name", { exact: true }).fill("Free cable movement fixture");
    await page.getByRole("button", { name: "Save privately", exact: true }).click();
    await expect(page.getByRole("article", { name: "Saved private exercise" })).toBeVisible();
    const records = await owner.from("private_exercises").select("id,content_id").single(); if (records.error) throw records.error;
    const saved = await owner.from("exercise_scenes").select("id,studio_layout,motion_style").eq("content_id", records.data.content_id).single(); if (saved.error) throw saved.error;
    expect(saved.data).toMatchObject({ motion_style: "free", studio_layout: { objects: [{ slug: "cable-machine", attachment: "both", cableAttachment: "straight-bar", pulleyHeight: .3 }] } });
    await expect.poll(async () => {
      const persisted = await owner.from("motion_keyframes").select("motion_joint_poses(rotation_x)").eq("scene_id", saved.data.id).order("position_ms"); if (persisted.error) throw persisted.error;
      return persisted.data[1].motion_joint_poses.length;
    }).toBeGreaterThanOrEqual(8);
    const frames = await owner.from("motion_keyframes").select("position_ms,motion_joint_poses(rotation_x,rig_joints(slug))").eq("scene_id", saved.data.id).order("position_ms"); if (frames.error) throw frames.error;
    expect(frames.data[0].motion_joint_poses).toHaveLength(0);
    expect(frames.data[2].motion_joint_poses).toHaveLength(0);
    expect(frames.data[1].motion_joint_poses.length).toBeGreaterThanOrEqual(8);
    await page.goto(`/my-exercises/${records.data.id}/workshop`);
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await selectWorkshopJoint(page, "Left hip");
    await page.getByRole("button", { name: "View finish", exact: true }).click();
    await expect(jointField(page, "x")).toHaveValue("25");
    for (const view of ["Three-quarter", "Side"]) {
      await page.getByRole("button", { name: view, exact: true }).click();
      for (let i = 0; i <= 8; i++) {
        await page.getByLabel("Preview time", { exact: true }).fill(String(3200 * i / 8));
        await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
        await page.locator("canvas").screenshot({ path: `${folder}/${view.toLowerCase()}-${i}.png` });
      }
    }
    await page.getByRole("button", { name: "Play", exact: true }).click(); await page.waitForTimeout(3600);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await setWorkshopMode(page, "quick"); await page.getByRole("button", { name: "Start and finish", exact: true }).click();
    await setWorkshopLanguage(page, "he");
    await expect(page.getByRole("button", { name: "עריכת סיום", exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `${folder}/mobile.png`, fullPage: true });
    await page.setViewportSize({ width: 1500, height: 1100 });
    await setWorkshopLanguage(page, "en");
    const twoPoses = createQuickScene("cable-machine");
    twoPoses.keyframes.splice(1, 1);
    const legacy = await owner.rpc("create_workshop_exercise", { p_scene: twoPoses }); if (legacy.error) throw legacy.error;
    await page.goto(`/my-exercises/${legacy.data}/workshop`);
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Start and finish", exact: true }).click();
    await page.getByRole("button", { name: "Edit finish", exact: true }).click();
    await expect(page.getByLabel("Editing pose", { exact: true })).toHaveValue("1");
    await expect(page.getByLabel("Preview time", { exact: true })).toHaveValue("1600");
    await expect(page.getByRole("button", { name: /^Drag (Left|Right) (hand|foot)$/ })).toHaveCount(4);
    expect(errors).toEqual([]);
  } finally { await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password }); }
});
