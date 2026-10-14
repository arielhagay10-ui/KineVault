import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { blankWorkshopScene, cableAttachmentSlugs, identityTransform, studioAssetSlugs, type StudioLayout } from "../../src/lib/motion/workshop";
import { createStudioObject } from "../../src/lib/motion/studio";
import { cableAttachmentButton, openWorkshopTool, setWorkshopLanguage } from "./workshop-menu.helpers";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });
test("advanced grip editing picks, adjusts, resets, undoes, and persists independent hand contacts", async ({ page }) => {
  test.setTimeout(240_000); page.setDefaultTimeout(60_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `grip-edit-${randomUUID()}@example.test`, password = "GripEditFixture2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true }); if (account.error) throw account.error;
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const evidence = ".local-artifacts/workshop/grip-edit"; mkdirSync(evidence, { recursive: true });
  try {
    const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    await owner.auth.signInWithPassword({ email, password });
    const scene = structuredClone(blankWorkshopScene);
    const bar = { ...createStudioObject("barbell", randomUUID(), 0), attachment: "left" as const, x: .45, y: 1.3, z: .4,
      frames: [0, 1600, 3200].map(timeMs => ({ ...identityTransform, x: .45, y: timeMs === 1600 ? 1.4 : 1.3, z: .4, timeMs })) };
    scene.studio!.objects = [bar];
    const created = await owner.rpc("save_workshop_draft", { p_scene: scene, p_name: "Custom grip regression" }); if (created.error) throw created.error;
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.goto("/sign-in"); await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/my-exercises/${created.data}/workshop`); await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible();
    await expect(page.getByText("Grip edit", { exact: true })).toHaveCount(0);
    await openWorkshopTool(page, "Contacts"); await page.getByLabel("Selected equipment", { exact: true }).selectOption(bar.id);
    await page.getByRole("button", { name: /^Edit left grip/ }).click();
    const x = page.getByLabel("Grip X centimeters", { exact: true });
    await x.fill("-8"); await x.press("Enter"); await expect(x).toHaveValue("-8");
    await page.getByRole("button", { name: "Reset left grip to automatic", exact: true }).click(); await expect(x).toHaveValue("0");
    await page.getByRole("button", { name: "Undo", exact: true }).first().click(); await expect(x).toHaveValue("-8");
    await page.getByRole("button", { name: /^Edit right grip/ }).click(); await x.fill("8"); await x.press("Enter");
    await page.getByRole("button", { name: /^Edit left grip/ }).click(); await expect(x).toHaveValue("-8");
    await page.getByRole("button", { name: "Hold with both hands", exact: true }).click(); await expect(x).toHaveValue("-48");
    await page.getByRole("button", { name: "Hold with left hand", exact: true }).click(); await expect(x).toHaveValue("-8");
    await page.getByRole("button", { name: "Choose point on equipment", exact: true }).click();
    await expect(page.getByText("Click the equipment or its attachment in the preview to place this grip.")).toBeVisible();
    await page.keyboard.press("Escape"); await expect(page.getByRole("button", { name: "Choose point on equipment", exact: true })).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: "Choose point on equipment", exact: true }).click();
    await page.getByRole("button", { name: "Camera", exact: true }).click();
    await expect(page.getByRole("button", { name: "Choose point on equipment", exact: true })).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: "Front", exact: true }).click();
    await page.screenshot({ path: `${evidence}/before-pick.png` });
    await page.getByRole("button", { name: "Choose point on equipment", exact: true }).click();
    await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
    const marker = (await page.getByRole("img", { name: "left grip location", exact: true }).boundingBox())!;
    await page.mouse.click(marker.x + marker.width / 2 + 18, marker.y + marker.height / 2 + 28);
    await expect(page.getByRole("button", { name: "Choose point on equipment", exact: true })).toHaveAttribute("aria-pressed", "false");
    await expect(x).not.toHaveValue("-8");
    // Restore a shaft-centered contact for the complete saved rep inspection.
    for (const [axis, value] of [["X", "-8"], ["Y", "0"], ["Z", "0"]]) {
      const field = page.getByLabel(`Grip ${axis} centimeters`, { exact: true }); await field.fill(value); await field.press("Enter");
    }
    await page.getByRole("button", { name: "Save", exact: true }).click(); await expect(page.getByText(/^Saved at .* · Private$/)).toBeVisible();
    await page.reload(); await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible();
    await openWorkshopTool(page, "Contacts"); await page.getByLabel("Selected equipment", { exact: true }).selectOption(bar.id);
    await page.getByRole("button", { name: /^Edit left grip/ }).click(); await expect(x).toHaveValue("-8");
    await page.getByRole("button", { name: /^Edit right grip/ }).click(); await expect(x).toHaveValue("8");
    await page.getByRole("button", { name: /^Edit left grip/ }).click();
    for (const view of ["Three-quarter", "Side"]) {
      await page.getByRole("button", { name: view, exact: true }).click();
      for (let i = 0; i <= 16; i++) {
        await page.getByLabel("Preview time", { exact: true }).fill(String(3200 * i / 16));
        await page.locator("canvas").screenshot({ path: `${evidence}/${view.toLowerCase()}-${i}.png` });
        await expect(page.getByText("Too far to reach. Move the weight closer to the figure.", { exact: true })).toHaveCount(0);
      }
    }
    await page.getByRole("button", { name: "Play", exact: true }).click(); await page.waitForTimeout(3500); await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.screenshot({ path: `${evidence}/controls.png` });
    const record = await owner.from("private_exercises").select("content_id").eq("id", created.data).single(); if (record.error) throw record.error;
    const saved = await owner.from("exercise_scenes").select("studio_layout").eq("content_id", record.data.content_id).single(); if (saved.error) throw saved.error;
    const grips = (saved.data.studio_layout as StudioLayout).objects[0].gripOffsets!;
    expect(grips.left!.x).toBeCloseTo(-.08, 10); expect(grips.right!.x).toBeCloseTo(.08, 10);
    expect([grips.left!.y, grips.left!.z, grips.right!.y, grips.right!.z]).toEqual([0, 0, 0, 0]);
    await setWorkshopLanguage(page, "he"); await expect(page.getByText("עריכת אחיזה", { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 320, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally { await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password }); }
});

test("grip edit excludes fixed supports and covers weights, machines and cable attachments", async ({ page }) => {
  test.setTimeout(240_000); page.setDefaultTimeout(60_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `all-grips-${randomUUID()}@example.test`, password = "AllGripFixture2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true }); if (account.error) throw account.error;
  try {
    const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    await owner.auth.signInWithPassword({ email, password });
    const scene = structuredClone(blankWorkshopScene);
    scene.studio!.objects = studioAssetSlugs.map((slug, index) => ({ ...createStudioObject(slug, randomUUID(), index), x: index * .5 - 2, z: 2, scale: .5 }));
    const created = await owner.rpc("save_workshop_draft", { p_scene: scene, p_name: "Every equipment grip regression" }); if (created.error) throw created.error;
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.goto("/sign-in"); await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/my-exercises/${created.data}/workshop`); await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible();
    await openWorkshopTool(page, "Contacts");
    for (const object of scene.studio!.objects) {
      await page.getByLabel("Selected equipment", { exact: true }).selectOption(object.id);
      if (object.slug === "bench" || object.slug === "squat-rack") {
        await expect(page.getByRole("button", { name: /^Edit (left|right) grip/ })).toHaveCount(0);
        continue;
      }
      await page.getByRole("button", { name: /^Edit right grip/ }).click();
      const x = page.getByLabel("Grip X centimeters", { exact: true }); await x.fill("2"); await x.press("Enter"); await expect(x).toHaveValue("2");
    }
    const cable = scene.studio!.objects[0]; await page.getByLabel("Selected equipment", { exact: true }).selectOption(cable.id);
    for (const kind of cableAttachmentSlugs) {
      await cableAttachmentButton(page, kind).click();
      await page.getByRole("button", { name: /^Edit left grip/ }).click();
      const y = page.getByLabel("Grip Y centimeters", { exact: true }); await y.fill("1"); await y.press("Enter"); await expect(y).toHaveValue("1");
      await page.getByRole("button", { name: "Choose point on equipment", exact: true }).click();
      await expect(page.getByRole("img", { name: "left grip location", exact: true })).toBeAttached();
      await page.getByRole("button", { name: "Camera", exact: true }).click();
      await expect(page.getByRole("button", { name: "Choose point on equipment", exact: true })).toHaveAttribute("aria-pressed", "false");
    }
    await page.getByRole("button", { name: "Save", exact: true }).click(); await expect(page.getByText(/^Saved at .* · Private$/)).toBeVisible();
    const record = await owner.from("private_exercises").select("content_id").eq("id", created.data).single(); if (record.error) throw record.error;
    const saved = await owner.from("exercise_scenes").select("studio_layout").eq("content_id", record.data.content_id).single(); if (saved.error) throw saved.error;
    const layout = saved.data.studio_layout as StudioLayout;
    for (const object of layout.objects) {
      if (object.slug === "bench" || object.slug === "squat-rack") expect(object.gripOffsets).toBeUndefined();
      else expect(object.gripOffsets).toEqual(object.id === cable.id ? { left: { x: 0, y: .01, z: 0 } } : { right: { x: .02, y: 0, z: 0 } });
    }
  } finally { await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password }); }
});
