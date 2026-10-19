import { selectWorkshopMoment } from "./workshop-menu.helpers";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { blankWorkshopScene, identityTransform, type StudioLayout } from "../../src/lib/motion/workshop";
import { createStudioObject } from "../../src/lib/motion/studio";
import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { jointField, openWorkshopTool, selectWorkshopJoint } from "./workshop-menu.helpers";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });

test("bench supports and bilateral shoulder edits preserve elbows and held dumbbells after reload", async ({ page }) => {
  test.setTimeout(240_000); page.setDefaultTimeout(45_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `joint-contacts-${randomUUID()}@example.test`, password = "JointContactsFixture2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  const evidence = ".local-artifacts/workshop/joint-contacts"; mkdirSync(evidence, { recursive: true });
  try {
    const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    await owner.auth.signInWithPassword({ email, password });
    const scene = structuredClone(blankWorkshopScene);
    const bench = { ...createStudioObject("bench", randomUUID(), 0), x: 0, z: 0, benchAngle: 0, attachment: "both" as const };
    const weights = [createStudioObject("dumbbell", randomUUID(), 1), createStudioObject("dumbbell", randomUUID(), 2)];
    scene.studio = { body: identityTransform, objects: [bench, ...weights], seating: { benchId: bench.id, facing: "supine" } };
    scene.keyframes = scene.keyframes.map(frame => ({ ...frame, poses: { "left-elbow": { x: 15, y: 0, z: 0 }, "right-elbow": { x: 15, y: 0, z: 0 } } }));
    const created = await owner.rpc("save_workshop_draft", { p_scene: scene, p_name: "Lying front raise regression" });
    if (created.error) throw created.error;
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.goto("/sign-in"); await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/my-exercises/${created.data}/workshop`); await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await openWorkshopTool(page, "Contacts");
    const selected = page.getByRole("combobox", { name: "Selected item", exact: true });
    await selected.selectOption(bench.id);
    await expect(page.getByRole("button", { name: /^Hold with / })).toHaveCount(0);
    await expect(selected.locator("option:checked")).not.toContainText("Held");
    await expect(page.getByRole("button", { name: "Lie face up", exact: true })).toHaveAttribute("aria-pressed", "true");
    await openWorkshopTool(page, "Timeline");
    await expect(page.getByRole("button", { name: "Animate selected item", exact: true })).toHaveCount(0);
    await openWorkshopTool(page, "Contacts");
    for (const [index, side] of ["left", "right"].entries()) {
      await selected.selectOption(weights[index].id); await page.getByRole("button", { name: `Hold with ${side} hand`, exact: true }).click();
    }
    await openWorkshopTool(page, "Pose");
    const joint = page.getByRole("combobox", { name: "Body joint", exact: true });
    await expect(joint.locator("option")).toHaveCount(8);
    await joint.selectOption("shoulder");
    const sides = page.getByRole("group", { name: "Body side", exact: true });
    await sides.getByRole("button", { name: "Both", exact: true }).click();
    await expect(sides.getByRole("button", { name: "Both", exact: true })).toHaveAttribute("aria-pressed", "true");
    await selectWorkshopMoment(page, "Finish");
    await jointField(page, "x").fill("60"); await jointField(page, "x").press("Enter");
    await expect(jointField(page, "x")).toHaveAttribute("aria-invalid", "true");
    await selectWorkshopJoint(page, "Left elbow");
    await expect(jointField(page, "x")).toHaveValue("15");
    await expect(jointField(page, "x")).toHaveAttribute("aria-invalid", "false");
    await joint.selectOption("shoulder");
    await sides.getByRole("button", { name: "Both", exact: true }).click();
    await jointField(page, "x").fill("-60"); await jointField(page, "x").press("Enter");
    await sides.getByRole("button", { name: "Right", exact: true }).click(); await expect(jointField(page, "x")).toHaveValue("-60");
    for (const side of ["Left", "Right"]) { await selectWorkshopJoint(page, `${side} elbow`); await expect(jointField(page, "x")).toHaveValue("15"); }
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await selectWorkshopJoint(page, "Left shoulder"); await expect(jointField(page, "x")).toHaveValue("0");
    await selectWorkshopJoint(page, "Right shoulder"); await expect(jointField(page, "x")).toHaveValue("0");
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(jointField(page, "x")).toHaveValue("-60");
    await page.getByRole("button", { name: "Capture pose", exact: true }).click();
    await page.getByRole("button", { name: "Save exercise", exact: true }).click(); await expect(page.getByText(/^Saved at .* · Private$/)).toBeVisible();
    await page.reload(); await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await selectWorkshopMoment(page, "Finish");
    for (const side of ["Left", "Right"]) {
      await selectWorkshopJoint(page, `${side} shoulder`); await expect(jointField(page, "x")).toHaveValue("-60");
      await selectWorkshopJoint(page, `${side} elbow`); await expect(jointField(page, "x")).toHaveValue("15");
    }
    await openWorkshopTool(page, "Contacts"); await selected.selectOption(weights[0].id);
    for (let step = 0; step <= 16; step++) {
      await page.getByLabel("Preview time", { exact: true }).fill(String(scene.durationMs * step / 16));
      await expect(page.getByRole("region", { name: "Selected item", exact: true })).toHaveAttribute("data-grip-reachable", "true");
    }
    await selectWorkshopJoint(page, "Both shoulder"); await page.screenshot({ path: `${evidence}/bilateral-pose.png` });
    await page.setViewportSize({ width: 390, height: 844 }); await expect(joint).toBeVisible();
    await page.screenshot({ path: `${evidence}/bilateral-pose-mobile.png` });
    const record = await owner.from("private_exercises").select("content_id").eq("id", created.data).single(); if (record.error) throw record.error;
    const saved = await owner.from("exercise_scenes").select("studio_layout").eq("content_id", record.data.content_id).single(); if (saved.error) throw saved.error;
    const layout = saved.data.studio_layout as StudioLayout;
    expect(layout.objects[0].attachment).toBe("none");
    expect(layout.objects.slice(1).map(weight => [weight.attachment, weight.poseDriver])).toEqual([["left", "arm"], ["right", "arm"]]);
    expect(layout.seating).toEqual(scene.studio.seating);
  } finally { await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password }); }
});
