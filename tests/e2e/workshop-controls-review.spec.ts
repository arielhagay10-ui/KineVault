import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { automaticWeightTransform } from "../../src/lib/motion/automatic-weight-grip";
import { createStudioObject } from "../../src/lib/motion/studio";
import { blankWorkshopScene } from "../../src/lib/motion/workshop";
import { dismissWorkshopTutorial, jointField, openWorkshopTool } from "./workshop-menu.helpers";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });

test("workshop equipment, paired joints, title, palm controls and joint limits agree with the preview", async ({ page }) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `controls-review-${randomUUID()}@example.test`, password = "ControlsReview2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
    await page.goto("/my-exercises/new"); await dismissWorkshopTutorial(page);
    const title = page.getByRole("region", { name: "Workshop actions", exact: true }).getByRole("textbox", { name: "Rename exercise", exact: true });
    await expect(title).toBeVisible();
    await title.fill("Quick create name");
    await expect(page.getByRole("heading", { name: "Quick create name", exact: true })).toBeVisible();
    await openWorkshopTool(page, "Equipment");
    await expect(page.getByRole("textbox", { name: "Exercise name", exact: true })).toHaveValue("Quick create name");
    const equipment = page.locator('[data-workshop-panel="equipment"]');
    await equipment.getByRole("button", { name: "Add equipment to scene", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Choose equipment", exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Adjustable bench", exact: true }).click();
    await expect(page.getByLabel("Selected equipment", { exact: true }).locator("option:checked")).toContainText("Adjustable bench");
    await expect(page.getByRole("region", { name: "Workshop actions", exact: true }).getByText("Exercise name", { exact: true })).toHaveCount(0);
    await page.getByRole("textbox", { name: "Exercise name", exact: true }).fill("Incline dumbbell curl");
    await expect(page.getByRole("heading", { name: "Incline dumbbell curl", exact: true })).toBeVisible();
    await openWorkshopTool(page, "Pose");
    const joints = page.getByRole("combobox", { name: "Body joint", exact: true });
    await joints.selectOption("shoulder");
    const side = page.getByRole("group", { name: "Body side", exact: true });
    await expect(side.getByRole("button", { name: "Both", exact: true })).toHaveAttribute("aria-pressed", "true");
    for (const joint of ["wrist", "torso", "elbow"]) await joints.selectOption(joint);
    await expect(side.getByRole("button", { name: "Both", exact: true })).toHaveAttribute("aria-pressed", "true");
    await side.getByRole("button", { name: "Right", exact: true }).click();
    await joints.selectOption("shoulder");
    await expect(side.getByRole("button", { name: "Right", exact: true })).toHaveAttribute("aria-pressed", "true");
    await joints.selectOption("torso"); await joints.selectOption("elbow");
    await expect(side.getByRole("button", { name: "Right", exact: true })).toHaveAttribute("aria-pressed", "true");
    mkdirSync(".local-artifacts/workshop/controls-review", { recursive: true });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.getByRole("heading", { name: "Incline dumbbell curl", exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `.local-artifacts/workshop/controls-review/${width}.png` });
    }
    const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    await owner.auth.signInWithPassword({ email, password });
    const scene = structuredClone(blankWorkshopScene);
    const bench = { ...createStudioObject("bench", randomUUID(), 0), benchAngle: 45 };
    const weights = (["left", "right"] as const).map((attachment, index) => ({ ...createStudioObject("dumbbell", randomUUID(), index + 1), attachment }));
    scene.studio!.objects = [bench, ...weights.map(item => ({ ...item, ...automaticWeightTransform(scene.studio!.body, item, item.attachment, scene, 0) }))];
    const created = await owner.rpc("save_workshop_draft", { p_scene: scene, p_name: "Seated palm controls" });
    if (created.error) throw created.error;
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/my-exercises/${created.data}/workshop`); await dismissWorkshopTutorial(page);
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await openWorkshopTool(page, "Contacts");
    await page.getByLabel("Selected equipment", { exact: true }).selectOption(bench.id);
    await page.getByRole("button", { name: "Sit", exact: true }).click();
    await openWorkshopTool(page, "Pose");
    await joints.selectOption("shoulder");
    const shoulder = await Promise.all((["x", "y", "z"] as const).map(axis => jointField(page, axis).inputValue()));
    await joints.selectOption("wrist");
    await expect(page.getByRole("button", { name: "Neutral", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.locator("canvas").screenshot({ path: ".local-artifacts/workshop/controls-review/seated-neutral.png" });
    await page.getByRole("button", { name: "Palm up", exact: true }).click();
    await expect(page.getByRole("button", { name: "Palm up", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.locator("canvas").screenshot({ path: ".local-artifacts/workshop/controls-review/seated-palm-up.png" });
    await joints.selectOption("shoulder");
    for (const [index, axis] of (["x", "y", "z"] as const).entries()) {
      expect(Number(await jointField(page, axis).inputValue())).toBeCloseTo(Number(shoulder[index]), 2);
    }
    await jointField(page, "x").fill("75"); await jointField(page, "x").press("Enter");
    await expect(jointField(page, "x")).toHaveAttribute("aria-invalid", "true");
    await expect(jointField(page, "x", true)).toHaveAttribute("max", "50");
    await jointField(page, "x").fill("50"); await jointField(page, "x").press("Enter");
    await expect(jointField(page, "x")).toHaveValue("50");
    await joints.selectOption("elbow");
    await jointField(page, "x").fill("155"); await jointField(page, "x").press("Enter");
    await expect(jointField(page, "x")).toHaveAttribute("aria-invalid", "true");
    await expect(jointField(page, "x", true)).toHaveAttribute("max", "150");
    await jointField(page, "x").fill("150"); await jointField(page, "x").press("Enter");
    await expect(jointField(page, "x")).toHaveValue("150");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/Saved at.*Private/)).toBeVisible({ timeout: 20_000 });
    await page.reload(); await dismissWorkshopTutorial(page); await openWorkshopTool(page, "Pose");
    await joints.selectOption("wrist");
    await expect(page.getByRole("button", { name: "Palm up", exact: true })).toHaveAttribute("aria-pressed", "true");
    const animated = structuredClone(blankWorkshopScene);
    animated.keyframes.forEach(frame => { frame.poses["left-elbow"] = { x: 60, y: 0, z: 0 }; });
    const weight = { ...createStudioObject("dumbbell", randomUUID(), 0), attachment: "left" as const };
    const frames = [0, 800, 1600, 3200].map(timeMs => {
      const posed = { ...animated, keyframes: animated.keyframes.map(frame => ({ ...frame,
        poses: { ...frame.poses, "left-elbow": { x: timeMs === 800 ? 100 : 60, y: 0, z: 0 } },
      })) };
      return { ...automaticWeightTransform(animated.studio!.body, weight, "left", posed, timeMs), timeMs };
    });
    animated.studio!.objects = [{ ...weight, ...automaticWeightTransform(animated.studio!.body, weight, "left", animated, 0), frames }];
    const animatedDraft = await owner.rpc("save_workshop_draft", { p_scene: animated, p_name: "Wrist path recording" });
    if (animatedDraft.error) throw animatedDraft.error;
    await page.goto(`/my-exercises/${animatedDraft.data}/workshop`); await dismissWorkshopTutorial(page);
    await openWorkshopTool(page, "Pose"); await joints.selectOption("wrist");
    await page.getByRole("button", { name: "View finish", exact: true }).click();
    await page.getByRole("button", { name: "Palm up", exact: true }).click();
    await expect(page.locator("[data-pose-save-state]")).toContainText("Finish");
    await page.getByRole("button", { name: "Save pose", exact: true }).click();
    await expect(page.getByText(/Saved at.*Private/)).toBeVisible({ timeout: 20_000 });
    const savedDraft = await owner.from("private_exercises").select("content_id").eq("id", animatedDraft.data).single();
    if (savedDraft.error) throw savedDraft.error;
    const savedScene = await owner.from("exercise_scenes").select("id").eq("content_id", savedDraft.data.content_id).single();
    if (savedScene.error) throw savedScene.error;
    const savedFrames = await owner.from("motion_keyframes").select("position_ms").eq("scene_id", savedScene.data.id).order("position_ms");
    if (savedFrames.error) throw savedFrames.error;
    expect(savedFrames.data.map(frame => frame.position_ms)).toEqual([0, 800, 1600, 3200]);
  } finally {
    await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password });
  }
});
