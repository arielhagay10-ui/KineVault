import { openWorkshopTool, selectWorkshopObject, selectWorkshopJoint, jointField, openWorkshopMenu, expandWorkshopControls, cableAttachmentButton } from "./workshop-menu.helpers";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { PerspectiveCamera, Vector3 } from "three";
import { keenanFlapsScene } from "../../src/lib/motion/keenan-flaps";
import { createStudioObject } from "../../src/lib/motion/studio";
import { blankWorkshopScene } from "../../src/lib/motion/workshop";
import { fitWorkshopCamera } from "../../src/lib/motion/workshop-camera";

test.beforeEach(async ({ page }) => page.setDefaultTimeout(15_000));

test("shoulder alignment, plane lock and cuff preferences survive bench edits and reload", async ({ page }) => {
  page.setDefaultTimeout(15_000);
  test.setTimeout(150_000);
  const fixture = await createOwner();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    const created = await fixture.owner.rpc("create_workshop_exercise", { p_scene: { ...keenanFlapsScene, annotations: [] } });
    if (created.error) throw created.error;
    await page.setViewportSize({ width: 1600, height: 1100 });
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(fixture.email); await page.getByLabel("Password").fill(fixture.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/my-exercises/${created.data}/workshop`);
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await selectWorkshopObject(page, "Right cuff cable");
    await openWorkshopTool(page, "Position");
    await expect(page.getByLabel("Position X meters", { exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Contacts", exact: true })).toHaveAttribute("aria-selected", "false");
    await openWorkshopTool(page, "Contacts");
    await expect(page.getByRole("button", { name: "Right wrist", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Right shoulder", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Right elbow", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Beside right shoulder", exact: true }).click();
    await openWorkshopTool(page, "Position");
    const cableX = Number(await page.getByLabel("Position X meters", { exact: true }).inputValue());
    const cableZ = Number(await page.getByLabel("Position Z meters", { exact: true }).inputValue());
    await selectWorkshopObject(page, "Adjustable bench");
    await openWorkshopTool(page, "Position");
    await page.getByLabel("Position X meters", { exact: true }).fill("1.25");
    await page.getByLabel("Position Z meters", { exact: true }).fill("0.4");
    await selectWorkshopObject(page, "Right cuff cable");
    await openWorkshopTool(page, "Position");
    expect(Number(await page.getByLabel("Position X meters", { exact: true }).inputValue())).toBeCloseTo(cableX + 1.25, 5);
    expect(Number(await page.getByLabel("Position Z meters", { exact: true }).inputValue())).toBeCloseTo(cableZ + 0.4, 5);
    await openWorkshopTool(page, "Pose");
    await page.getByLabel("Frontal-plane lock", { exact: true }).check();
    await selectWorkshopJoint(page, "Right shoulder");
    await expect(jointField(page, "x")).toHaveCount(0);
    await expect(jointField(page, "y")).toHaveCount(0);
    await jointField(page, "z").fill("65");
    await selectWorkshopJoint(page, "Left shoulder");
    await expect(jointField(page, "z")).toHaveValue("-10");
    await selectWorkshopObject(page, "Right cuff cable");
    await cableAttachmentButton(page, "rope").click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/Saved at.*Private/)).toBeVisible();
    await page.reload();
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await openWorkshopTool(page, "Pose");
    await expect(page.getByLabel("Frontal-plane lock", { exact: true })).toBeChecked();
    await selectWorkshopObject(page, "Right cuff cable");
    await cableAttachmentButton(page, "cuff").click();
    await expect(page.getByLabel("Cuff placement", { exact: true })).toHaveValue("upper-arm");
    await expect(page.getByRole("button", { name: "Beside right shoulder", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Right wrist", exact: true })).toHaveCount(0);
    const saved = await fixture.owner.from("private_exercises").select("content_id").eq("id", created.data).single();
    // Check the actual stored frames, including moments never opened in the UI.
    const sceneRow = await fixture.owner.from("exercise_scenes").select("id").eq("content_id", saved.data!.content_id).single();
    const storedFrames = await fixture.owner.from("motion_keyframes").select("motion_joint_poses(rotation_x,rotation_y,rig_joints(slug))").eq("scene_id", sceneRow.data!.id);
    if (storedFrames.error) throw storedFrames.error;
    expect(storedFrames.data).toHaveLength(17);
    for (const frame of storedFrames.data!) {
      const poses = frame.motion_joint_poses as unknown as { rotation_x: number; rotation_y: number; rig_joints: { slug: string } }[];
      const shoulders = poses.filter(pose => pose.rig_joints.slug.endsWith("shoulder"));
      expect(shoulders).toHaveLength(2);
      for (const pose of shoulders) {
        expect(pose.rotation_x).toBe(0); expect(pose.rotation_y).toBe(0);
      }
    }
    mkdirSync(".local-artifacts/workshop", { recursive: true });
    await page.screenshot({ path: ".local-artifacts/workshop/shoulder-alignment.png", fullPage: true });
    await openWorkshopTool(page, "Position");
    await page.getByLabel("Position X meters", { exact: true }).fill("-2");
    await page.getByLabel("Position X meters", { exact: true }).press("Enter");
    await openWorkshopTool(page, "Contacts");
    await expect(page.getByRole("button", { name: "Beside right shoulder", exact: true })).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.getByRole("button", { name: "Beside right shoulder", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally { await fixture.admin.auth.admin.deleteUser(fixture.userId); }
});

test("seating and cuffs make a chest-supported Keenan flaps rep that survives save and reload", async ({ page }) => {
  test.setTimeout(180_000);
  const fixture = await createOwner(), errors: string[] = [];
  const artifacts = ".local-artifacts/workshop/keenan-flaps";
  mkdirSync(artifacts, { recursive: true });
  writeFileSync(`${artifacts}/scene.json`, JSON.stringify(keenanFlapsScene, null, 2));
  page.on("pageerror", error => errors.push(error.message));
  try {
    const created = await fixture.owner.rpc("create_workshop_exercise", { p_scene: { ...keenanFlapsScene, annotations: keenanFlapsScene.annotations?.map(item => ({ ...item, jointAction: null })) } });
    if (created.error) throw created.error;
    await page.setViewportSize({ width: 1600, height: 1100 });
    await page.goto("/sign-in"); await page.getByLabel("Email").fill(fixture.email); await page.getByLabel("Password").fill(fixture.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/my-exercises/${created.data}/workshop`);
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await selectWorkshopObject(page, "Adjustable bench");
    await openWorkshopTool(page, "Pose");
    await expect(page.getByLabel("Frontal-plane lock")).toBeChecked();
    await selectWorkshopObject(page, "Adjustable bench");
    await expect(page.getByLabel("Bench pad angle degrees", { exact: true })).toHaveValue("65");
    await openWorkshopTool(page, "Position");
    await expect(page.getByLabel("Rotation Y degrees", { exact: true })).toHaveValue("-20");
    await openWorkshopTool(page, "Contacts");
    await page.getByRole("button", { name: "Sit", exact: true }).click();
    for (const direction of ["front", "left", "right"]) {
      await page.getByLabel("Sitting direction", { exact: true }).selectOption(direction);
      await expect(page.getByLabel("Sitting direction", { exact: true })).toHaveValue(direction);
      await page.locator("canvas").screenshot({ path: `${artifacts}/seat-${direction.replaceAll(" ", "-")}.png` });
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByText(/Saved at.*Private/)).toBeVisible();
      await page.reload(); await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
      await selectWorkshopObject(page, "Adjustable bench");
      await expect(page.getByLabel("Sitting direction", { exact: true })).toHaveValue(direction);
    }
    await page.getByRole("button", { name: "Chest supported", exact: true }).click();
    await selectWorkshopObject(page, "Right cuff cable");
    await expect(cableAttachmentButton(page, "cuff")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Hold with both hands", exact: true })).toHaveCount(0);
    for (const site of ["wrist", "upper-arm"]) {
      await page.getByLabel("Cuff placement").selectOption(site);
      for (const side of ["right", "left"]) {
        await page.getByRole("button", { name: `Cuff ${side} arm`, exact: true }).click();
        await expect(page.getByLabel("Selected item")).toHaveAttribute("data-grip-reachable", "true");
        await page.locator("canvas").screenshot({ path: `${artifacts}/cuff-${site}-${side}.png` });
      }
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByText(/Saved at.*Private/)).toBeVisible();
      await page.reload(); await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
      await selectWorkshopObject(page, "Right cuff cable");
      await expect(page.getByLabel("Cuff placement")).toHaveValue(site);
    }
    // Restore the working arm after checking both cuff placement controls.
    await selectWorkshopObject(page, "Right cuff cable");
    await page.getByRole("button", { name: "Cuff right arm", exact: true }).click();
    await page.getByRole("button", { name: "Above head", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Pulley height meters", exact: true })).toHaveValue("2.8");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/Saved at.*Private/)).toBeVisible();
    await page.reload(); await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await selectWorkshopObject(page, "Right cuff cable");
    await expect(page.getByRole("textbox", { name: "Pulley height meters", exact: true })).toHaveValue("2.8");
    await expect(page.getByRole("button", { name: "Cuff right arm", exact: true })).toHaveAttribute("aria-pressed", "true");
    // Restore the slightly raised pulley for the latest reference setup.
    const exerciseHeight = String(keenanFlapsScene.studio!.objects[1].pulleyHeight);
    await page.getByRole("textbox", { name: "Pulley height meters", exact: true }).fill(exerciseHeight);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/Saved at.*Private/)).toBeVisible();
    await page.reload(); await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await selectWorkshopObject(page, "Right cuff cable");
    await expect(page.getByRole("textbox", { name: "Pulley height meters", exact: true })).toHaveValue(exerciseHeight);
    await page.screenshot({ path: `${artifacts}/setup-controls.png`, fullPage: true });
    await openWorkshopTool(page, "Timeline");
    for (const view of ["Back view", "Side"]) {
      await page.getByRole("button", { name: view, exact: true }).click();
      for (let step = 0; step <= 8; step++) {
        await page.getByLabel("Scrub timeline").evaluate((element, value) => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, String(value));
          element.dispatchEvent(new Event("input", { bubbles: true }));
        }, step * 600);
        await expect(page.getByLabel("Scrub timeline")).toHaveValue(String(step * 600));
        await page.locator("canvas").screenshot({ path: `${artifacts}/flaps-${view}-${step}.png` });
      }
    }
    if (process.env.CAPTURE_KEENAN === "1") {
      await page.getByRole("button", { name: "Three-quarter", exact: true }).click();
      const frames = `${artifacts}/playback`;
      mkdirSync(frames, { recursive: true });
      for (let index = 0; index <= 96; index++) {
        await page.getByLabel("Scrub timeline").evaluate((element, value) => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, String(value));
          element.dispatchEvent(new Event("input", { bubbles: true }));
        }, index * 50);
        await page.locator("canvas").screenshot({ path: `${frames}/frame-${String(index).padStart(4, "0")}.png` });
      }
    }
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(() => page.getByLabel("Scrub timeline").inputValue()).not.toBe("4800");
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByText("Timeline settings", { exact: true }).click();
    await page.getByLabel("Duration").selectOption("8000");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(() => page.getByLabel("Scrub timeline").inputValue()).not.toBe("4800");
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByLabel("Duration").selectOption("4800");
    await selectWorkshopObject(page, "Adjustable bench");
    await openWorkshopTool(page, "Contacts");
    await page.getByRole("button", { name: "Leave bench", exact: true }).click();
    await expect(page.getByRole("button", { name: "Leave bench", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Chest supported", exact: true }).click();
    await openWorkshopTool(page, "Equipment");
    await page.getByRole("button", { name: "Remove item", exact: true }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/Saved at.*Private/)).toBeVisible();
    expect(errors).toEqual([]);
  } finally { await fixture.admin.auth.admin.deleteUser(fixture.userId); }
});

async function createOwner() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!url || !["127.0.0.1", "localhost"].includes(new URL(url).hostname)) throw new Error("Studio fixtures require local Supabase");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `studio-${Date.now()}@example.test`, password = "LocalStudioTestPass2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  await owner.auth.signInWithPassword({ email, password });
  return { admin, owner, email, password, userId: account.data.user!.id };
}

test("kettlebell grips and adjustable cable attachments survive switching, playback and reload", async ({ page }) => {
  test.setTimeout(300_000);
  page.setDefaultTimeout(15_000);
  const fixture = await createOwner(), errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const artifacts = ".local-artifacts/workshop/cable-attachments";
  mkdirSync(artifacts, { recursive: true });
  try {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await page.goto("/sign-in"); await page.getByLabel("Email").fill(fixture.email); await page.getByLabel("Password").fill(fixture.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/my-exercises/new");
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Add equipment", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Kettlebell", exact: true }).click();
    await openWorkshopTool(page, "Contacts");
    for (const grip of ["left hand", "right hand", "both hands"]) {
      await page.getByRole("button", { name: `Hold with ${grip}`, exact: true }).click();
      await expect(page.getByLabel("Selected item")).toHaveAttribute("data-grip-reachable", "true");
      for (const view of ["Front", "Side"]) {
        await page.getByRole("button", { name: view, exact: true }).click();
        await page.locator("canvas").screenshot({ path: `${artifacts}/kettlebell-${grip.replaceAll(" ", "-")}-${view}.png` });
      }
    }
    await openWorkshopTool(page, "Contacts");
    await page.getByLabel("Exercise name", { exact: true }).fill("Cable attachment fixture");
    await openWorkshopMenu(page);
    await page.getByRole("button", { name: "Save & add details", exact: false }).click();
    await expect(page).toHaveURL(/\/my-exercises\/[^/]+\/edit\?sceneSaved=1$/);
    const id = page.url().split("/my-exercises/")[1].split("/")[0];
    await page.goto(`/my-exercises/${id}/workshop`);
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await selectWorkshopObject(page, "Kettlebell");
    await expect(page.getByRole("button", { name: "Hold with both hands", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Release", exact: true }).click();
    await openWorkshopTool(page, "Equipment");
    await page.getByRole("button", { name: "Remove item", exact: true }).click();
    await page.getByRole("button", { name: "Add equipment", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cable machine", exact: true }).click();
    await page.getByRole("textbox", { name: "Pulley height meters", exact: true }).fill("1.75");
    await page.getByRole("textbox", { name: "Pulley height meters", exact: true }).press("Enter");
    await expect(page.getByRole("slider", { name: "Pulley height meters", exact: true })).toHaveValue("1.75");
    await page.getByRole("textbox", { name: "Pulley height meters", exact: true }).fill("100");
    await page.getByRole("textbox", { name: "Pulley height meters", exact: true }).press("Enter");
    await expect(page.getByRole("textbox", { name: "Pulley height meters", exact: true })).toHaveAttribute("aria-invalid", "true");
    await page.getByRole("textbox", { name: "Pulley height meters", exact: true }).fill("-1");
    await page.getByRole("textbox", { name: "Pulley height meters", exact: true }).press("Enter");
    await expect(page.getByRole("textbox", { name: "Pulley height meters", exact: true })).toHaveAttribute("aria-invalid", "true");
    await page.getByRole("textbox", { name: "Pulley height meters", exact: true }).fill("0.2");
    await page.getByRole("textbox", { name: "Pulley height meters", exact: true }).press("Enter");
    await page.getByRole("slider", { name: "Pulley height meters", exact: true }).focus(); await page.getByRole("slider", { name: "Pulley height meters", exact: true }).press("End");
    await expect(page.getByRole("textbox", { name: "Pulley height meters", exact: true })).toHaveValue("3.2");
    await page.getByRole("textbox", { name: "Pulley height meters", exact: true }).fill("1.75");
    await openWorkshopTool(page, "Timeline");
    await page.getByRole("button", { name: /Finish ·/ }).click();
    await openWorkshopTool(page, "Pose");
    for (const side of ["Left", "Right"]) {
      await selectWorkshopJoint(page, `${side} elbow`);
      await jointField(page, "x").fill("70");
    }
    await selectWorkshopObject(page, "Cable machine");
    for (const kind of ["d-handle", "straight-bar", "angled-bar", "v-bar", "rope"] as const) {
      await openWorkshopTool(page, "Contacts");
      await cableAttachmentButton(page, kind).click();
      for (const grip of ["left hand", "right hand", ...(kind === "d-handle" ? [] : ["both hands"])]) {
        await page.getByRole("button", { name: `Hold with ${grip}`, exact: true }).click();
        await expect(page.getByLabel("Selected item")).toHaveAttribute("data-grip-reachable", "true");
      }
      for (const view of ["Front", "Side"]) {
        await page.getByRole("button", { name: view, exact: true }).click();
        for (let step = 0; step <= 8; step++) {
          await openWorkshopTool(page, "Timeline");
          await page.getByLabel("Scrub timeline").evaluate((element, value) => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, String(value));
            element.dispatchEvent(new Event("input", { bubbles: true }));
          }, step * 400);
          await expect(page.getByLabel("Scrub timeline")).toHaveValue(String(step * 400));
          await openWorkshopTool(page, "Contacts");
          await expect(page.getByLabel("Selected item")).toHaveAttribute("data-grip-reachable", "true");
          await page.locator("canvas").screenshot({ path: `${artifacts}/${kind}-${view}-${step}.png` });
        }
      }
      await openWorkshopTool(page, "Timeline");
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await expect.poll(() => page.getByLabel("Scrub timeline").inputValue()).not.toBe("3200");
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByText(/Saved at.*Private/)).toBeVisible();
      await page.reload();
      await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
      await selectWorkshopObject(page, "Cable machine");
      await expect(cableAttachmentButton(page, kind)).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByRole("textbox", { name: "Pulley height meters", exact: true })).toHaveValue("1.75");
      await expect(page.getByRole("button", { name: `Hold with ${kind === "d-handle" ? "right hand" : "both hands"}`, exact: true })).toHaveAttribute("aria-pressed", "true");
      await openWorkshopTool(page, "Contacts");
    }
    await cableAttachmentButton(page, "d-handle").click();
    await expect(page.getByRole("button", { name: "Hold with left hand", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Hold with both hands", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Release", exact: true }).click();
    await page.getByRole("button", { name: "Near feet", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Pulley height meters", exact: true })).toHaveValue("0.3");
    await page.setViewportSize({ width: 390, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally { await fixture.admin.auth.admin.deleteUser(fixture.userId); }
});

test("support controls, explicit animation and presentation survive saving without hiding the preview", async ({ page }) => {
  test.setTimeout(120_000);
  const fixture = await createOwner();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(fixture.email); await page.getByLabel("Password").fill(fixture.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/my-exercises/new");
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Add equipment", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Adjustable bench", exact: true }).click();
    await openWorkshopTool(page, "Contacts");
    await page.getByLabel("Bench pad angle degrees", { exact: true }).fill("30");
    await openWorkshopTool(page, "Timeline");
    await expect(page.getByRole("button", { name: "Animate selected item", exact: true })).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: /Finish ·/ }).click();
    await openWorkshopTool(page, "Position");
    await page.getByLabel("Position X meters", { exact: true }).fill("-1");
    await page.getByLabel("Position X meters", { exact: true }).press("Enter");
    await openWorkshopTool(page, "Timeline");
    await page.getByRole("button", { name: /Start ·/ }).click();
    await openWorkshopTool(page, "Position");
    await expect(page.getByLabel("Position X meters", { exact: true })).toHaveValue("-1");
    await page.getByRole("button", { name: "Add equipment", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Dumbbell", exact: true }).click();
    await page.getByRole("button", { name: "Hold with right hand", exact: true }).click();
    await page.getByRole("button", { name: "Lock right elbow", exact: true }).click();
    await expect(page.getByRole("button", { name: "Unlock right elbow", exact: true })).toHaveAttribute("aria-pressed", "true");
    await openWorkshopTool(page, "Pose");
    await selectWorkshopJoint(page, "Right elbow");
    await expect(page.getByText("Dumbbell controls this arm.", { exact: false })).toBeVisible();
    await expect(jointField(page, "x")).toBeDisabled();
    const canvas = page.locator("canvas");
    const bounds = (await canvas.boundingBox())!;
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(1050);
    await selectWorkshopJoint(page, "Right wrist");
    await expect(jointField(page, "x")).toBeEnabled();
    await page.getByRole("button", { name: "Palm up", exact: true }).click();
    await page.getByRole("button", { name: "Side", exact: true }).click();
    await openWorkshopTool(page, "View");
    await page.getByLabel("Highlight", { exact: true }).selectOption("group:biceps");
    await page.getByLabel("Exercise name", { exact: true }).fill("Cable attachment fixture");
    await openWorkshopMenu(page);
    await page.getByRole("button", { name: "Save & add details", exact: false }).click();
    await expect(page).toHaveURL(/\/my-exercises\/[^/]+\/edit\?sceneSaved=1$/);
    const id = page.url().split("/my-exercises/")[1].split("/")[0];
    const saved = await fixture.owner.from("private_exercises").select("content_id").eq("id", id).single();
    const data = await fixture.owner.from("exercise_scenes").select("studio_layout").eq("content_id", saved.data!.content_id).single();
    const layout = data.data!.studio_layout as { objects: { slug: string; frames?: unknown[]; elbowLocks?: { right?: unknown } }[] };
    expect(layout.objects.find(item => item.slug === "bench")!.frames).toBeUndefined();
    expect(layout.objects.find(item => item.slug === "dumbbell")!.elbowLocks?.right).toBeDefined();
    await page.getByRole("link", { name: "Open motion workshop", exact: false }).click();
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Side", exact: true })).toHaveAttribute("aria-pressed", "true");
    await openWorkshopTool(page, "View");
    await expect(page.getByLabel("Highlight", { exact: true })).toHaveValue("group:biceps");
    await selectWorkshopObject(page, "Adjustable bench");
    await expect(page.getByLabel("Bench pad angle degrees", { exact: true })).toHaveValue("30");
    await selectWorkshopObject(page, "Dumbbell");
    await expect(page.getByRole("button", { name: "Unlock right elbow", exact: true })).toBeVisible();
    await openWorkshopTool(page, "Timeline");
    await page.getByRole("button", { name: "Animate selected item", exact: true }).click();
    await page.getByRole("button", { name: /Finish ·/ }).click();
    await expect(page.getByText("Editing 1.60s. Changes affect this moment only.", { exact: true })).toBeVisible();
    await openWorkshopTool(page, "Position");
    await page.getByRole("button", { name: "Up", exact: true }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/Saved at.*Private/)).toBeVisible();
    await page.reload();
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await selectWorkshopObject(page, "Dumbbell");
    await openWorkshopTool(page, "Timeline");
    await expect(page.getByRole("button", { name: "Stop animation and edit placement", exact: true })).toHaveAttribute("aria-pressed", "true");
    await openWorkshopTool(page, "Pose");
    await selectWorkshopJoint(page, "Right elbow");
    await page.getByRole("button", { name: "Release weight to pose arm", exact: true }).click();
    await expect(jointField(page, "x")).toBeEnabled();
    await page.setViewportSize({ width: 390, height: 844 });
    await jointField(page, "x").fill("80");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const mobileBounds = (await canvas.boundingBox())!;
    expect(mobileBounds.y).toBeGreaterThanOrEqual(0);
    expect(mobileBounds.y + mobileBounds.height).toBeLessThanOrEqual(844);
    expect(errors).toEqual([]);
  } finally { await fixture.admin.auth.admin.deleteUser(fixture.userId); }
});

test("ankles and positive knee bends can be posed and saved", async ({ page }) => {
  const fixture = await createOwner();
  try {
    await page.setViewportSize({ width: 1600, height: 1050 });
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(fixture.email); await page.getByLabel("Password").fill(fixture.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/my-exercises/new");
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await openWorkshopTool(page, "Pose");
    await selectWorkshopJoint(page, "Left knee");
    await expect(jointField(page, "x", true)).toHaveAttribute("min", "-5");
    await expect(jointField(page, "x", true)).toHaveAttribute("max", "150");
    await expect(jointField(page, "y")).toHaveCount(0);
    await jointField(page, "x").fill("90");
    await selectWorkshopJoint(page, "Right knee");
    await jointField(page, "x").fill("45");
    await selectWorkshopJoint(page, "Left ankle");
    await jointField(page, "x").fill("20");
    await jointField(page, "y").fill("10");
    await jointField(page, "z").fill("-15");
    await selectWorkshopJoint(page, "Right ankle");
    await jointField(page, "x").fill("-35");
    await page.getByRole("button", { name: "Side", exact: true }).click();
    mkdirSync(".local-artifacts/workshop", { recursive: true });
    await page.screenshot({ path: ".local-artifacts/workshop/knee-ankle-side.png", fullPage: true });
    await page.getByLabel("Exercise name", { exact: true }).fill("Knee and ankle fixture");
    await openWorkshopMenu(page);
    await page.getByRole("button", { name: /Save & add details/ }).click();
    await expect(page).toHaveURL(/\/my-exercises\/[^/]+\/edit\?sceneSaved=1$/);
    const id = page.url().split("/my-exercises/")[1].split("/")[0];
    await page.goto(`/my-exercises/${id}/workshop`);
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await openWorkshopTool(page, "Pose");
    for (const [joint, angle] of [["Left knee", "90"], ["Right knee", "45"], ["Left ankle", "20"], ["Right ankle", "-35"]]) {
      await selectWorkshopJoint(page, joint);
      await expect(jointField(page, "x")).toHaveValue(angle);
    }
    await selectWorkshopJoint(page, "Left ankle");
    await expect(jointField(page, "y")).toHaveValue("10");
    await expect(jointField(page, "z")).toHaveValue("-15");
  } finally { await fixture.admin.auth.admin.deleteUser(fixture.userId); }
});

test("wrist poses and slower movement controls work and survive reloading", async ({ page }) => {
  test.setTimeout(120_000);
  const fixture = await createOwner();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.setViewportSize({ width: 1600, height: 1050 });
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(fixture.email); await page.getByLabel("Password").fill(fixture.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/my-exercises/new");
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    const sensitivity = page.getByLabel("Movement sensitivity");
    await openWorkshopTool(page, "Position");
    await expandWorkshopControls(page, "Drag options");
    await expect(sensitivity).toHaveValue("35");
    await page.getByRole("button", { name: "Add equipment", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Barbell", exact: true }).click();
    await page.getByRole("button", { name: "Front", exact: true }).click();
    await page.getByRole("button", { name: "Move with mouse", exact: true }).click();
    await openWorkshopTool(page, "Position");
    const drag = async (world: Vector3) => {
      const canvas = page.locator("canvas");
      await canvas.scrollIntoViewIfNeeded();
      const bounds = (await canvas.boundingBox())!;
      const camera = new PerspectiveCamera(34, bounds.width / bounds.height, 0.1, 100);
      const fit = fitWorkshopCamera({ ...blankWorkshopScene, studio: { ...blankWorkshopScene.studio!, objects: [createStudioObject("barbell", "drag-fixture", 0)] } }, "front", bounds.width / bounds.height, 34);
      camera.position.copy(fit.position); camera.lookAt(fit.target); camera.updateMatrixWorld();
      const point = world.clone().project(camera);
      const x = bounds.x + (point.x + 1) * bounds.width / 2, y = bounds.y + (1 - point.y) * bounds.height / 2;
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 100, y, { steps: 12 }); await page.mouse.up();
    };
    for (const item of ["Barbell", "Anatomical figure"]) {
      await selectWorkshopObject(page, item);
      await openWorkshopTool(page, "Position");
      const startX = item === "Barbell" ? 0.95 : 0;
      const point = item === "Barbell" ? new Vector3(0.95, 0.85, 0.3) : new Vector3(0, 1.75, 0.1);
      await expandWorkshopControls(page, "Drag options");
      await sensitivity.focus(); await sensitivity.press("Home");
      await drag(point);
      await expect(page.getByLabel("Position X meters", { exact: true })).not.toHaveValue(String(startX));
      const slow = Number(await page.getByLabel("Position X meters", { exact: true }).inputValue()) - startX;
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      await sensitivity.focus(); await sensitivity.press("End");
      await drag(point);
      const fast = Number(await page.getByLabel("Position X meters", { exact: true }).inputValue()) - startX;
      expect(fast).toBeGreaterThan(slow * 7);
      expect(fast).toBeLessThan(slow * 13);
      await page.getByRole("button", { name: "Undo", exact: true }).click();
    }
    await sensitivity.focus(); await sensitivity.press("Home"); await sensitivity.press("ArrowRight");
    await expect(sensitivity).toHaveValue("15");
    await selectWorkshopObject(page, "Barbell");
    await page.getByRole("button", { name: "Hold with both hands", exact: true }).click();
    await selectWorkshopJoint(page, "Left wrist");
    await page.getByRole("button", { name: "Palm up", exact: true }).click();
    await jointField(page, "y").fill("20");
    await jointField(page, "z").fill("-10");
    await selectWorkshopJoint(page, "Right wrist");
    await page.getByRole("button", { name: "Palm down", exact: true }).click();
    mkdirSync(".local-artifacts/workshop", { recursive: true });
    await page.screenshot({ path: ".local-artifacts/workshop/wrist-grips-front.png", fullPage: true });
    await page.getByRole("button", { name: "Side", exact: true }).click();
    await page.screenshot({ path: ".local-artifacts/workshop/wrist-grips-side.png", fullPage: true });
    await page.getByLabel("Exercise name", { exact: true }).fill("Wrist grip fixture");
    await openWorkshopMenu(page);
    await page.getByRole("button", { name: /Save & add details/ }).click();
    await expect(page).toHaveURL(/\/my-exercises\/[^/]+\/edit\?sceneSaved=1$/);
    const id = page.url().split("/my-exercises/")[1].split("/")[0];
    await page.goto(`/my-exercises/${id}/workshop`);
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await openWorkshopTool(page, "Position");
    await expect(sensitivity).toHaveValue("15");
    await openWorkshopTool(page, "Pose");
    await selectWorkshopJoint(page, "Left wrist");
    await expect(jointField(page, "x")).toHaveValue("-90");
    await expect(jointField(page, "y")).toHaveValue("20");
    await expect(jointField(page, "z")).toHaveValue("-10");
    await selectWorkshopJoint(page, "Right wrist");
    await expect(jointField(page, "x")).toHaveValue("90");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("button", { name: "Palm down", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally { await fixture.admin.auth.admin.deleteUser(fixture.userId); }
});

test("creation starts with a simple workshop, supports dragging and holding a bar, then saves details", async ({ page }) => {
  test.setTimeout(120_000);
  const fixture = await createOwner();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.setViewportSize({ width: 1600, height: 1050 });
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(fixture.email); await page.getByLabel("Password").fill(fixture.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/my-exercises/new");
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Choose equipment", exact: true })).toBeVisible();
    await expect(page.getByLabel("Scrub timeline")).not.toBeVisible();
    await page.reload();
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    const empty = await fixture.owner.from("private_exercises").select("id");
    expect(empty.data).toHaveLength(0);
    await page.getByRole("button", { name: "Add equipment", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Barbell", exact: true }).click();
    await page.getByRole("button", { name: "Front", exact: true }).click();
    await page.getByRole("button", { name: "Move with mouse", exact: true }).click();
    const canvas = page.locator("canvas");
    await canvas.scrollIntoViewIfNeeded();
    mkdirSync(".local-artifacts/workshop", { recursive: true });
    await page.screenshot({ path: ".local-artifacts/workshop/simple-before-drag.png" });
    await page.getByRole("button", { name: "Fit scene", exact: true }).click();
    await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
    const bounds = (await canvas.boundingBox())!;
    const camera = new PerspectiveCamera(34, bounds.width / bounds.height, 0.1, 100);
    const fit = fitWorkshopCamera({ ...blankWorkshopScene, studio: { ...blankWorkshopScene.studio!, objects: [createStudioObject("barbell", "drag-fixture", 0)] } }, "front", bounds.width / bounds.height, 34);
    camera.position.copy(fit.position); camera.lookAt(fit.target); camera.updateMatrixWorld();
    const point = new Vector3(0.95, 0.85, 0.3).project(camera);
    const grab = { x: bounds.x + (point.x + 1) * bounds.width / 2, y: bounds.y + (1 - point.y) * bounds.height / 2 };
    await page.mouse.move(grab.x, grab.y); await page.mouse.down(); await page.mouse.move(grab.x + 70, grab.y, { steps: 12 }); await page.mouse.up();
    await openWorkshopTool(page, "Position");
    await expect(page.getByLabel("Position X meters", { exact: true })).not.toHaveValue("0.95");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.getByLabel("Position X meters", { exact: true })).toHaveValue("0.95");
    await openWorkshopTool(page, "Contacts");
    await page.getByRole("button", { name: "Hold with both hands", exact: true }).click();
    await expect(page.getByText("Held with both hands", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Selected item")).toHaveAttribute("data-grip-reachable", "true");
    await openWorkshopTool(page, "Position");
    await page.getByRole("button", { name: "Up", exact: true }).click();
    await expect(page.getByLabel("Selected item")).toHaveAttribute("data-grip-reachable", "true");
    await openWorkshopTool(page, "Timeline");
    await page.getByRole("button", { name: "Animate selected item", exact: true }).click();
    await page.getByRole("button", { name: /Finish ·/ }).click();
    await openWorkshopTool(page, "Position");
    await page.getByRole("button", { name: "Up", exact: true }).click();
    await page.getByRole("button", { name: "Up", exact: true }).click();
    await openWorkshopTool(page, "Timeline");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(() => page.getByLabel("Scrub timeline").inputValue()).not.toBe("1600");
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByRole("button", { name: /Finish ·/ }).click();
    await page.screenshot({ path: ".local-artifacts/workshop/simple-barbell-front.png", fullPage: true });
    await page.getByRole("button", { name: "Side", exact: true }).click();
    await page.screenshot({ path: ".local-artifacts/workshop/simple-barbell-side.png", fullPage: true });
    await page.getByLabel("Exercise name", { exact: true }).fill("Cable attachment fixture");
    await openWorkshopMenu(page);
    await page.getByRole("button", { name: "Save & add details", exact: false }).click();
    await expect(page).toHaveURL(/\/my-exercises\/[0-9a-f-]+\/edit\?sceneSaved=1$/);
    await expect(page.getByRole("status")).toHaveText("Movement saved privately. Give it a name. Anatomy and instructions are optional.");
    await page.getByLabel("Name", { exact: true }).fill("My barbell motion");
    await page.getByText("Description, equipment and classifications (optional)", { exact: true }).click();
    await page.getByLabel("Short description").fill("An exercise created in the workshop first.");
    await page.getByRole("button", { name: "Save privately", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Saved privately.");
    await page.getByRole("link", { name: "Open motion workshop", exact: false }).click();
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await selectWorkshopObject(page, "Barbell");
    await expect(page.getByRole("button", { name: "Hold with both hands", exact: true })).toHaveAttribute("aria-pressed", "true");
    await openWorkshopTool(page, "Timeline");
    await page.getByRole("button", { name: /Finish ·/ }).click();
    await openWorkshopTool(page, "Position");
    await expect(page.getByLabel("Position Y meters", { exact: true })).toHaveValue("1.6");
    await openWorkshopTool(page, "Contacts");
    await page.getByRole("button", { name: "Release", exact: true }).click();
    await openWorkshopTool(page, "Pose");
    await selectWorkshopJoint(page, "Left elbow");
    await jointField(page, "x").fill("95");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/Saved at.*Private/)).toBeVisible();
    await page.setViewportSize({ width: 390, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    expect(errors).toEqual([]);
  } finally { await fixture.admin.auth.admin.deleteUser(fixture.userId); }
});

test("existing demo barbells become selectable and movable", async ({ page }) => {
  const fixture = await createOwner();
  try {
    const draft = await fixture.owner.rpc("save_private_exercise", { p_name: "Legacy barbell fixture" });
    if (draft.error) throw draft.error;
    const saved = await fixture.owner.rpc("save_private_scene", { p_private_id: draft.data, p_scene: {
      durationMs: 3200, cameraAngle: "front", equipment: { slug: "barbell", x: 0.6, y: 0.4, z: 0.3, scale: 1 },
      keyframes: [{ timeMs: 0, poses: {} }, { timeMs: 3200, poses: {} }],
    } });
    if (saved.error) throw saved.error;
    await page.goto("/sign-in"); await page.getByLabel("Email").fill(fixture.email); await page.getByLabel("Password").fill(fixture.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/my-exercises/${draft.data}/workshop`);
    await selectWorkshopObject(page, "Barbell");
    await openWorkshopTool(page, "Position");
    await page.getByRole("button", { name: "Up", exact: true }).click();
    await openWorkshopTool(page, "Position");
    await expect(page.getByLabel("Position Y meters", { exact: true })).toHaveValue("1.12");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/Saved at.*Private/)).toBeVisible();
    await page.reload();
    await selectWorkshopObject(page, "Barbell");
    await openWorkshopTool(page, "Position");
    await expect(page.getByLabel("Position Y meters", { exact: true })).toHaveValue("1.12");
  } finally { await fixture.admin.auth.admin.deleteUser(fixture.userId); }
});
