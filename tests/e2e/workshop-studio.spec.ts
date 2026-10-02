import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { PerspectiveCamera, Vector3 } from "three";
import { keenanFlapsScene } from "../../src/lib/motion/keenan-flaps";

test("shoulder alignment, plane lock and cuff preferences survive bench edits and reload", async ({ page }) => {
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
    const objects = page.getByLabel("Scene objects");
    await objects.getByRole("button", { name: "Right cuff cable", exact: true }).click();
    await expect(page.getByLabel("Position X", { exact: true })).toBeVisible();
    await expect(page.locator("details").filter({ has: page.getByText("Advanced settings", { exact: true }) })).not.toHaveAttribute("open");
    await expect(page.getByRole("button", { name: "Right wrist", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Right shoulder", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Right elbow", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Beside right shoulder", exact: true }).click();
    const cableX = Number(await page.getByLabel("Position X", { exact: true }).inputValue());
    const cableZ = Number(await page.getByLabel("Position Z", { exact: true }).inputValue());
    await objects.getByRole("button", { name: "Adjustable bench", exact: true }).click();
    await page.getByLabel("Position X", { exact: true }).fill("1.25");
    await page.getByLabel("Position Z", { exact: true }).fill("0.4");
    await objects.getByRole("button", { name: "Right cuff cable", exact: true }).click();
    expect(Number(await page.getByLabel("Position X", { exact: true }).inputValue())).toBeCloseTo(cableX + 1.25, 5);
    expect(Number(await page.getByLabel("Position Z", { exact: true }).inputValue())).toBeCloseTo(cableZ + 0.4, 5);
    await page.getByLabel("Frontal-plane lock", { exact: true }).check();
    await page.getByRole("button", { name: "Right shoulder", exact: true }).click();
    await expect(page.getByLabel("Joint X", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Joint Y", { exact: true })).toHaveCount(0);
    await page.getByLabel("Joint Z", { exact: true }).fill("65");
    await page.getByRole("button", { name: "Left shoulder", exact: true }).click();
    await expect(page.getByLabel("Joint Z", { exact: true })).toHaveValue("-10");
    await objects.getByRole("button", { name: "Right cuff cable", exact: true }).click();
    await page.getByLabel("Cable attachment", { exact: true }).selectOption("rope");
    await page.getByRole("button", { name: "Save scene", exact: true }).click();
    await expect(page.getByText("Scene saved privately.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible();
    await expect(page.getByLabel("Frontal-plane lock", { exact: true })).toBeChecked();
    await objects.getByRole("button", { name: "Right cuff cable", exact: true }).click();
    await page.getByLabel("Cable attachment", { exact: true }).selectOption("cuff");
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
    await page.getByLabel("Position X", { exact: true }).fill("-2");
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
    const objects = page.getByLabel("Scene objects");
    await objects.getByRole("button", { name: "Adjustable bench", exact: true }).click();
    await expect(page.getByLabel("Frontal-plane lock")).toBeChecked();
    await expect(page.getByLabel("Bench pad angle degrees")).toHaveValue("65");
    await expect(page.getByLabel("Rotation Y", { exact: true })).toHaveValue("-20");
    for (const direction of ["Face away from bench", "Face left", "Face right"]) {
      await page.getByRole("button", { name: direction, exact: true }).click();
      await expect(page.getByRole("button", { name: direction, exact: true })).toHaveAttribute("aria-pressed", "true");
      await page.locator("canvas").screenshot({ path: `${artifacts}/seat-${direction.replaceAll(" ", "-")}.png` });
      await page.getByRole("button", { name: "Save scene", exact: true }).click();
      await expect(page.getByText("Scene saved privately.", { exact: true })).toBeVisible();
      await page.reload(); await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible();
      await objects.getByRole("button", { name: "Adjustable bench", exact: true }).click();
      await expect(page.getByRole("button", { name: direction, exact: true })).toHaveAttribute("aria-pressed", "true");
    }
    await page.getByRole("button", { name: "Face bench · chest supported", exact: true }).click();
    await objects.getByRole("button", { name: "Right cuff cable", exact: true }).click();
    await expect(page.getByLabel("Cable attachment", { exact: true })).toHaveValue("cuff");
    await expect(page.getByRole("button", { name: "Hold with both hands", exact: true })).toHaveCount(0);
    for (const site of ["wrist", "upper-arm"]) {
      await page.getByLabel("Cuff placement").selectOption(site);
      for (const side of ["right", "left"]) {
        await page.getByRole("button", { name: `Cuff ${side} arm`, exact: true }).click();
        await expect(page.getByLabel("Selected item")).toHaveAttribute("data-grip-reachable", "true");
        await page.locator("canvas").screenshot({ path: `${artifacts}/cuff-${site}-${side}.png` });
      }
      await page.getByRole("button", { name: "Save scene", exact: true }).click();
      await expect(page.getByText("Scene saved privately.", { exact: true })).toBeVisible();
      await page.reload(); await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible();
      await objects.getByRole("button", { name: "Right cuff cable", exact: true }).click();
      await expect(page.getByLabel("Cuff placement")).toHaveValue(site);
    }
    // Restore the working arm after checking both cuff placement controls.
    await objects.getByRole("button", { name: "Right cuff cable", exact: true }).click();
    await page.getByRole("button", { name: "Cuff right arm", exact: true }).click();
    await page.getByRole("button", { name: "Above head", exact: true }).click();
    await expect(page.getByLabel("Pulley height meters")).toHaveValue("3");
    await page.getByRole("button", { name: "Save scene", exact: true }).click();
    await expect(page.getByText("Scene saved privately.", { exact: true })).toBeVisible();
    await page.reload(); await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible();
    await objects.getByRole("button", { name: "Right cuff cable", exact: true }).click();
    await expect(page.getByLabel("Pulley height meters")).toHaveValue("3");
    await expect(page.getByRole("button", { name: "Cuff right arm", exact: true })).toHaveAttribute("aria-pressed", "true");
    // Restore the slightly raised pulley for the latest reference setup.
    const exerciseHeight = String(keenanFlapsScene.studio!.objects[1].pulleyHeight);
    await page.getByLabel("Pulley height meters").fill(exerciseHeight);
    await page.getByRole("button", { name: "Save scene", exact: true }).click();
    await expect(page.getByText("Scene saved privately.", { exact: true })).toBeVisible();
    await page.reload(); await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible();
    await objects.getByRole("button", { name: "Right cuff cable", exact: true }).click();
    await expect(page.getByLabel("Pulley height meters")).toHaveValue(exerciseHeight);
    await page.screenshot({ path: `${artifacts}/setup-controls.png`, fullPage: true });
    await page.getByText("Animate movement Optional", { exact: true }).click();
    for (const view of ["Back", "Side"]) {
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
    await objects.getByRole("button", { name: "Adjustable bench", exact: true }).click();
    await page.getByRole("button", { name: "Stand up", exact: true }).click();
    await expect(page.getByRole("button", { name: "Stand up", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Face bench · chest supported", exact: true }).click();
    await page.getByRole("button", { name: "Remove item", exact: true }).click();
    await page.getByRole("button", { name: "Save scene", exact: true }).click();
    await expect(page.getByText("Scene saved privately.", { exact: true })).toBeVisible();
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
    await page.getByLabel("Equipment library").getByRole("button", { name: "Kettlebell", exact: true }).click();
    for (const grip of ["left hand", "right hand", "both hands"]) {
      await page.getByRole("button", { name: `Hold with ${grip}`, exact: true }).click();
      await expect(page.getByLabel("Selected item")).toHaveAttribute("data-grip-reachable", "true");
      for (const view of ["Front", "Side"]) {
        await page.getByRole("button", { name: view, exact: true }).click();
        await page.locator("canvas").screenshot({ path: `${artifacts}/kettlebell-${grip.replaceAll(" ", "-")}-${view}.png` });
      }
    }
    await page.getByRole("button", { name: "Save & add details", exact: false }).click();
    await expect(page).toHaveURL(/\/my-exercises\/[^/]+\/edit\?sceneSaved=1$/);
    const id = page.url().split("/my-exercises/")[1].split("/")[0];
    await page.goto(`/my-exercises/${id}/workshop`);
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await page.getByLabel("Scene objects").getByRole("button", { name: "Kettlebell", exact: true }).click();
    await expect(page.getByRole("button", { name: "Hold with both hands", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Release", exact: true }).click();
    await page.getByRole("button", { name: "Remove item", exact: true }).click();
    await page.getByRole("button", { name: "Add equipment", exact: true }).click();
    await page.getByLabel("Equipment library").getByRole("button", { name: "Cable machine", exact: true }).click();
    await page.getByLabel("Pulley height meters").fill("1.75");
    await expect(page.getByLabel("Adjust pulley height")).toHaveValue("1.75");
    await page.getByLabel("Pulley height meters").fill("100");
    await expect(page.getByLabel("Pulley height meters")).toHaveValue("3.2");
    await page.getByLabel("Pulley height meters").fill("-1");
    await expect(page.getByLabel("Pulley height meters")).toHaveValue("0.2");
    await page.getByLabel("Adjust pulley height").focus(); await page.getByLabel("Adjust pulley height").press("End");
    await expect(page.getByLabel("Pulley height meters")).toHaveValue("3.2");
    await page.getByLabel("Pulley height meters").fill("1.75");
    await page.getByText("Animate movement Optional", { exact: true }).click();
    await page.getByRole("button", { name: /Keyframe 2/ }).click();
    await page.getByRole("button", { name: "Pose body", exact: true }).click();
    for (const side of ["Left", "Right"]) {
      await page.getByRole("button", { name: `${side} elbow`, exact: true }).click();
      await page.getByLabel("Joint X", { exact: true }).fill("70");
    }
    await page.getByLabel("Scene objects").getByRole("button", { name: "Cable machine", exact: true }).click();
    for (const kind of ["d-handle", "straight-bar", "angled-bar", "v-bar", "rope"]) {
      await page.getByLabel("Cable attachment", { exact: true }).selectOption(kind);
      for (const grip of ["left hand", "right hand", ...(kind === "d-handle" ? [] : ["both hands"])]) {
        await page.getByRole("button", { name: `Hold with ${grip}`, exact: true }).click();
        await expect(page.getByLabel("Selected item")).toHaveAttribute("data-grip-reachable", "true");
      }
      for (const view of ["Front", "Side"]) {
        await page.getByRole("button", { name: view, exact: true }).click();
        for (let step = 0; step <= 8; step++) {
          await page.getByLabel("Scrub timeline").evaluate((element, value) => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, String(value));
            element.dispatchEvent(new Event("input", { bubbles: true }));
          }, step * 400);
          await expect(page.getByLabel("Scrub timeline")).toHaveValue(String(step * 400));
          await expect(page.getByLabel("Selected item")).toHaveAttribute("data-grip-reachable", "true");
          await page.locator("canvas").screenshot({ path: `${artifacts}/${kind}-${view}-${step}.png` });
        }
      }
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await expect.poll(() => page.getByLabel("Scrub timeline").inputValue()).not.toBe("3200");
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page.getByRole("button", { name: "Save scene", exact: true }).click();
      await expect(page.getByText("Scene saved privately.", { exact: true })).toBeVisible();
      await page.reload();
      await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
      await page.getByLabel("Scene objects").getByRole("button", { name: "Cable machine", exact: true }).click();
      await expect(page.getByLabel("Cable attachment", { exact: true })).toHaveValue(kind);
      await expect(page.getByLabel("Pulley height meters")).toHaveValue("1.75");
      await expect(page.getByRole("button", { name: `Hold with ${kind === "d-handle" ? "right hand" : "both hands"}`, exact: true })).toHaveAttribute("aria-pressed", "true");
      await page.getByText("Animate movement Optional", { exact: true }).click();
    }
    await page.getByLabel("Cable attachment", { exact: true }).selectOption("d-handle");
    await expect(page.getByRole("button", { name: "Hold with left hand", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Hold with both hands", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Release", exact: true }).click();
    await page.getByRole("button", { name: "Low pulley", exact: true }).click();
    await expect(page.getByLabel("Pulley height meters")).toHaveValue("0.3");
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
    await page.getByLabel("Equipment library").getByRole("button", { name: "Adjustable bench", exact: true }).click();
    await page.getByLabel("Bench pad angle degrees").fill("30");
    await expect(page.getByLabel("Animate this item", { exact: true })).not.toBeChecked();
    await page.getByText("Animate movement Optional", { exact: true }).click();
    await page.getByRole("button", { name: /Keyframe 2/ }).click();
    await page.getByText("Advanced settings", { exact: true }).click();
    await page.getByLabel("Position X", { exact: true }).fill("-1");
    await page.getByRole("button", { name: /Start ·/ }).click();
    await expect(page.getByLabel("Position X", { exact: true })).toHaveValue("-1");
    await page.getByText("Advanced settings", { exact: true }).click();
    await page.getByRole("button", { name: "Add equipment", exact: true }).click();
    await page.getByLabel("Equipment library").getByRole("button", { name: "Dumbbell", exact: true }).click();
    await page.getByRole("button", { name: "Hold with right hand", exact: true }).click();
    await page.getByRole("button", { name: "Lock right elbow", exact: true }).click();
    await expect(page.getByRole("button", { name: "Unlock right elbow", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Pose body", exact: true }).click();
    await page.getByRole("button", { name: "Right elbow", exact: true }).click();
    await expect(page.getByText("Dumbbell controls this arm.", { exact: false })).toBeVisible();
    await expect(page.getByLabel("Joint X", { exact: true })).toBeDisabled();
    const canvas = page.locator("canvas");
    const bounds = (await canvas.boundingBox())!;
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(1050);
    await page.getByRole("button", { name: "Right wrist", exact: true }).click();
    await expect(page.getByLabel("Joint X", { exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Palm up", exact: true }).click();
    await page.getByRole("button", { name: "Side", exact: true }).click();
    await page.getByText("Muscle highlights and credits", { exact: true }).click();
    await page.getByLabel("Highlight", { exact: true }).selectOption("group:biceps");
    await page.getByText("Muscle highlights and credits", { exact: true }).click();
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
    await page.getByText("Muscle highlights and credits", { exact: true }).click();
    await expect(page.getByLabel("Highlight", { exact: true })).toHaveValue("group:biceps");
    await page.getByText("Muscle highlights and credits", { exact: true }).click();
    await page.getByLabel("Scene objects").getByRole("button", { name: "Adjustable bench", exact: true }).click();
    await expect(page.getByLabel("Bench pad angle degrees")).toHaveValue("30");
    await page.getByLabel("Scene objects").getByRole("button", { name: "Dumbbell", exact: true }).click();
    await expect(page.getByRole("button", { name: "Unlock right elbow", exact: true })).toBeVisible();
    await page.getByLabel("Animate this item", { exact: true }).check();
    await page.getByRole("button", { name: /Keyframe 2/ }).click();
    await expect(page.getByText("Editing 1.60s. Changes affect this moment only.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Up", exact: true }).click();
    await page.getByRole("button", { name: "Save scene", exact: true }).click();
    await expect(page.getByText("Scene saved privately.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await page.getByLabel("Scene objects").getByRole("button", { name: "Dumbbell", exact: true }).click();
    await expect(page.getByLabel("Animate this item", { exact: true })).toBeChecked();
    await page.getByRole("button", { name: "Pose body", exact: true }).click();
    await page.getByRole("button", { name: "Right elbow", exact: true }).click();
    await page.getByRole("button", { name: "Release weight to pose arm", exact: true }).click();
    await expect(page.getByLabel("Joint X", { exact: true })).toBeEnabled();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel("Joint X", { exact: true }).fill("80");
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
    await page.getByRole("button", { name: "Pose body", exact: true }).click();
    await page.getByRole("button", { name: "Left knee", exact: true }).click();
    await expect(page.getByLabel("Joint X", { exact: true })).toHaveAttribute("min", "-5");
    await expect(page.getByLabel("Joint X", { exact: true })).toHaveAttribute("max", "150");
    await expect(page.getByLabel("Joint Y", { exact: true })).toHaveCount(0);
    await page.getByLabel("Joint X", { exact: true }).fill("90");
    await page.getByRole("button", { name: "Right knee", exact: true }).click();
    await page.getByLabel("Joint X", { exact: true }).fill("45");
    await page.getByRole("button", { name: "Left ankle", exact: true }).click();
    await page.getByLabel("Joint X", { exact: true }).fill("20");
    await page.getByLabel("Joint Y", { exact: true }).fill("10");
    await page.getByLabel("Joint Z", { exact: true }).fill("-15");
    await page.getByRole("button", { name: "Right ankle", exact: true }).click();
    await page.getByLabel("Joint X", { exact: true }).fill("-35");
    await page.getByRole("button", { name: "Side", exact: true }).click();
    mkdirSync(".local-artifacts/workshop", { recursive: true });
    await page.screenshot({ path: ".local-artifacts/workshop/knee-ankle-side.png", fullPage: true });
    await page.getByRole("button", { name: /Save & add details/ }).click();
    await expect(page).toHaveURL(/\/my-exercises\/[^/]+\/edit\?sceneSaved=1$/);
    const id = page.url().split("/my-exercises/")[1].split("/")[0];
    await page.goto(`/my-exercises/${id}/workshop`);
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Pose body", exact: true }).click();
    for (const [joint, angle] of [["Left knee", "90"], ["Right knee", "45"], ["Left ankle", "20"], ["Right ankle", "-35"]]) {
      await page.getByRole("button", { name: joint, exact: true }).click();
      await expect(page.getByLabel("Joint X", { exact: true })).toHaveValue(angle);
    }
    await page.getByRole("button", { name: "Left ankle", exact: true }).click();
    await expect(page.getByLabel("Joint Y", { exact: true })).toHaveValue("10");
    await expect(page.getByLabel("Joint Z", { exact: true })).toHaveValue("-15");
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
    await expect(sensitivity).toHaveValue("35");
    await page.getByRole("button", { name: "Add equipment", exact: true }).click();
    await page.getByLabel("Equipment library").getByRole("button", { name: "Barbell", exact: true }).click();
    await page.getByRole("button", { name: "Front", exact: true }).click();
    await page.getByText("Advanced settings", { exact: true }).click();
    const drag = async (world: Vector3) => {
      const canvas = page.locator("canvas");
      await canvas.scrollIntoViewIfNeeded();
      const bounds = (await canvas.boundingBox())!;
      const camera = new PerspectiveCamera(34, bounds.width / bounds.height, 0.1, 100);
      camera.position.set(0, 1.65, 5.3); camera.lookAt(0, 1.38, 0); camera.updateMatrixWorld();
      const point = world.clone().project(camera);
      const x = bounds.x + (point.x + 1) * bounds.width / 2, y = bounds.y + (1 - point.y) * bounds.height / 2;
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 100, y, { steps: 12 }); await page.mouse.up();
    };
    for (const item of ["Barbell", "Anatomical figure"]) {
      await page.getByLabel("Scene objects").getByRole("button", { name: item, exact: true }).click();
      const startX = item === "Barbell" ? 0.95 : 0;
      const point = item === "Barbell" ? new Vector3(0.95, 0.85, 0.3) : new Vector3(0, 1.75, 0.1);
      await sensitivity.focus(); await sensitivity.press("Home");
      await drag(point);
      await expect(page.getByLabel("Position X", { exact: true })).not.toHaveValue(String(startX));
      const slow = Number(await page.getByLabel("Position X", { exact: true }).inputValue()) - startX;
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      await sensitivity.focus(); await sensitivity.press("End");
      await drag(point);
      const fast = Number(await page.getByLabel("Position X", { exact: true }).inputValue()) - startX;
      expect(fast).toBeGreaterThan(slow * 7);
      expect(fast).toBeLessThan(slow * 13);
      await page.getByRole("button", { name: "Undo", exact: true }).click();
    }
    await sensitivity.focus(); await sensitivity.press("Home"); await sensitivity.press("ArrowRight");
    await expect(sensitivity).toHaveValue("15");
    await page.getByText("Advanced settings", { exact: true }).click();
    await page.getByLabel("Scene objects").getByRole("button", { name: "Barbell", exact: true }).click();
    await page.getByRole("button", { name: "Hold with both hands", exact: true }).click();
    await page.getByRole("button", { name: "Left wrist", exact: true }).click();
    await page.getByRole("button", { name: "Palm up", exact: true }).click();
    await page.getByLabel("Joint Y", { exact: true }).fill("20");
    await page.getByLabel("Joint Z", { exact: true }).fill("-10");
    await page.getByRole("button", { name: "Right wrist", exact: true }).click();
    await page.getByRole("button", { name: "Palm down", exact: true }).click();
    mkdirSync(".local-artifacts/workshop", { recursive: true });
    await page.screenshot({ path: ".local-artifacts/workshop/wrist-grips-front.png", fullPage: true });
    await page.getByRole("button", { name: "Side", exact: true }).click();
    await page.screenshot({ path: ".local-artifacts/workshop/wrist-grips-side.png", fullPage: true });
    await page.getByRole("button", { name: /Save & add details/ }).click();
    await expect(page).toHaveURL(/\/my-exercises\/[^/]+\/edit\?sceneSaved=1$/);
    const id = page.url().split("/my-exercises/")[1].split("/")[0];
    await page.goto(`/my-exercises/${id}/workshop`);
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await expect(sensitivity).toHaveValue("15");
    await page.getByRole("button", { name: "Pose body", exact: true }).click();
    await page.getByRole("button", { name: "Left wrist", exact: true }).click();
    await expect(page.getByLabel("Joint X", { exact: true })).toHaveValue("-90");
    await expect(page.getByLabel("Joint Y", { exact: true })).toHaveValue("20");
    await expect(page.getByLabel("Joint Z", { exact: true })).toHaveValue("-10");
    await page.getByRole("button", { name: "Right wrist", exact: true }).click();
    await expect(page.getByLabel("Joint X", { exact: true })).toHaveValue("90");
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
    await expect(page.getByLabel("Position X", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Scrub timeline")).not.toBeVisible();
    await page.reload();
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    const empty = await fixture.owner.from("private_exercises").select("id");
    expect(empty.data).toHaveLength(0);
    await page.getByRole("button", { name: "Add equipment", exact: true }).click();
    await page.getByLabel("Equipment library").getByRole("button", { name: "Barbell", exact: true }).click();
    await page.getByRole("button", { name: "Front", exact: true }).click();
    const canvas = page.locator("canvas");
    await canvas.scrollIntoViewIfNeeded();
    const bounds = (await canvas.boundingBox())!;
    const camera = new PerspectiveCamera(34, bounds.width / bounds.height, 0.1, 100);
    camera.position.set(0, 1.65, 5.3); camera.lookAt(0, 1.38, 0); camera.updateMatrixWorld();
    const point = new Vector3(0.95, 0.85, 0.3).project(camera);
    const grab = { x: bounds.x + (point.x + 1) * bounds.width / 2, y: bounds.y + (1 - point.y) * bounds.height / 2 };
    mkdirSync(".local-artifacts/workshop", { recursive: true });
    await page.screenshot({ path: ".local-artifacts/workshop/simple-before-drag.png" });
    await page.mouse.move(grab.x, grab.y); await page.mouse.down(); await page.mouse.move(grab.x + 70, grab.y, { steps: 12 }); await page.mouse.up();
    await page.getByText("Advanced settings", { exact: true }).click();
    await expect(page.getByLabel("Position X", { exact: true })).not.toHaveValue("0.95");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.getByLabel("Position X", { exact: true })).toHaveValue("0.95");
    await page.getByText("Advanced settings", { exact: true }).click();
    await page.getByRole("button", { name: "Hold with both hands", exact: true }).click();
    await expect(page.getByText("Held with both hands", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Selected item")).toHaveAttribute("data-grip-reachable", "true");
    await page.getByRole("button", { name: "Up", exact: true }).click();
    await expect(page.getByLabel("Selected item")).toHaveAttribute("data-grip-reachable", "true");
    await page.getByText("Animate movement", { exact: false }).first().click();
    await page.getByLabel("Animate this item", { exact: true }).check();
    await page.getByRole("button", { name: /Keyframe 2/ }).click();
    await page.getByRole("button", { name: "Up", exact: true }).click();
    await page.getByRole("button", { name: "Up", exact: true }).click();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(() => page.getByLabel("Scrub timeline").inputValue()).not.toBe("1600");
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByRole("button", { name: /Keyframe 2/ }).click();
    await page.screenshot({ path: ".local-artifacts/workshop/simple-barbell-front.png", fullPage: true });
    await page.getByRole("button", { name: "Side", exact: true }).click();
    await page.screenshot({ path: ".local-artifacts/workshop/simple-barbell-side.png", fullPage: true });
    await page.getByRole("button", { name: "Save & add details", exact: false }).click();
    await expect(page).toHaveURL(/\/my-exercises\/[0-9a-f-]+\/edit\?sceneSaved=1$/);
    await expect(page.getByText("Movement saved. Now add the exercise’s name, muscles, and instructions.")).toBeVisible();
    await page.getByLabel("Name", { exact: true }).fill("My barbell motion");
    await page.getByLabel("Short description").fill("An exercise created in the workshop first.");
    await page.getByRole("button", { name: "Save privately", exact: true }).click();
    await page.getByRole("link", { name: "Open motion workshop", exact: false }).click();
    await page.getByLabel("Scene objects").getByRole("button", { name: "Barbell", exact: true }).click();
    await expect(page.getByRole("button", { name: "Hold with both hands", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByText("Animate movement", { exact: false }).first().click();
    await page.getByRole("button", { name: /Keyframe 2/ }).click();
    await page.getByText("Advanced settings", { exact: true }).click();
    await expect(page.getByLabel("Position Y", { exact: true })).toHaveValue("1.6");
    await page.getByRole("button", { name: "Release", exact: true }).click();
    await page.getByRole("button", { name: "Pose body", exact: true }).click();
    await page.getByRole("button", { name: "Left elbow", exact: true }).click();
    await page.getByLabel("Joint X", { exact: true }).fill("95");
    await page.getByRole("button", { name: "Save scene", exact: true }).click();
    await expect(page.getByText("Scene saved privately.", { exact: true })).toBeVisible();
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
    await page.getByLabel("Scene objects").getByRole("button", { name: "Barbell", exact: true }).click();
    await page.getByRole("button", { name: "Up", exact: true }).click();
    await page.getByText("Advanced settings", { exact: true }).click();
    await expect(page.getByLabel("Position Y", { exact: true })).toHaveValue("1.12");
    await page.getByRole("button", { name: "Save scene", exact: true }).click();
    await expect(page.getByText("Scene saved privately.", { exact: true })).toBeVisible();
    await page.reload();
    await page.getByLabel("Scene objects").getByRole("button", { name: "Barbell", exact: true }).click();
    await page.getByText("Advanced settings", { exact: true }).click();
    await expect(page.getByLabel("Position Y", { exact: true })).toHaveValue("1.12");
  } finally { await fixture.admin.auth.admin.deleteUser(fixture.userId); }
});
