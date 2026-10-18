import { selectWorkshopMoment } from "./workshop-menu.helpers";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { automaticWeightTransform } from "../../src/lib/motion/automatic-weight-grip";
import { createStudioObject } from "../../src/lib/motion/studio";
import { blankWorkshopScene, identityTransform, type StudioLayout } from "../../src/lib/motion/workshop";
import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { expandWorkshopControls, jointField, openWorkshopTool, selectWorkshopJoint } from "./workshop-menu.helpers";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });
for (const mode of ["single", "both", "deep"] as const) test(`${mode} held barbell joints edit at start, finish and an intermediate moment, then save and reload`, async ({ page }) => {
  test.setTimeout(240_000); page.setDefaultTimeout(45_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `barbell-joints-${randomUUID()}@example.test`, password = "BarbellJointsFixture2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const evidence = `.local-artifacts/workshop/barbell-joints/${mode}`; mkdirSync(evidence, { recursive: true });
  const firstJoint = mode !== "single" ? "Both elbow" : "Left elbow";
  const secondJoint = mode !== "single" ? "Both elbow" : "Right elbow";
  const peak = mode === "deep" ? 150 : 85;
  try {
    const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    await owner.auth.signInWithPassword({ email, password });
    const scene = structuredClone(blankWorkshopScene);
    const weight = { ...createStudioObject("barbell", randomUUID(), 0), attachment: "both" as const };
    scene.studio!.objects = [{ ...weight, ...automaticWeightTransform(identityTransform, weight, "both", scene, 0) }];
    const created = await owner.rpc("save_workshop_draft", { p_scene: scene, p_name: "Held barbell joint regression" });
    if (created.error) throw created.error;
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.goto("/sign-in"); await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/my-exercises/${created.data}/workshop`); await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible();
    await selectWorkshopJoint(page, firstJoint);
    await expect(jointField(page, "x")).toBeEnabled();
    await expandWorkshopControls(page, "Held equipment");
    await expect(page.getByText("Bend a joint to move the weight. Both hands stay attached.", { exact: true })).toBeVisible();
    await jointField(page, "x").fill("45"); await jointField(page, "x").press("Enter"); await expect(jointField(page, "x")).toHaveValue("45");
    await page.getByRole("button", { name: "Undo", exact: true }).click(); await expect(jointField(page, "x")).not.toHaveValue("45");
    await page.getByRole("button", { name: "Redo", exact: true }).click(); await expect(jointField(page, "x")).toHaveValue("45");
    await selectWorkshopMoment(page, "Finish");
    await selectWorkshopJoint(page, secondJoint);
    await jointField(page, "x").fill("85"); await jointField(page, "x").press("Enter"); await expect(jointField(page, "x")).toHaveValue("85");
    for (const bend of [145, 0, 145, 0, 85]) {
      await jointField(page, "x").fill(String(bend)); await jointField(page, "x").press("Enter"); await expect(jointField(page, "x")).toHaveValue(String(bend));
    }
    if (mode === "deep") for (const bend of [100, 120, 125, 130, 140, 145, 150, 151, 152, 153, 154, 155]) {
      await jointField(page, "x").fill(String(bend)); await jointField(page, "x").press("Enter");
      await expect(jointField(page, "x")).toHaveValue(String(bend));
      await expect(page.locator('[data-grip-reachable]')).toHaveAttribute("data-grip-reachable", "true");
      await page.locator("canvas").screenshot({ path: `${evidence}/bend-${bend}.png` });
    }
    await page.getByLabel("Preview time", { exact: true }).fill("800");
    await jointField(page, "x").fill("60"); await jointField(page, "x").press("Enter"); await expect(jointField(page, "x")).toHaveValue("60");
    await expect(page.getByLabel("Editing pose", { exact: true }).locator("option")).toHaveCount(4);
    await page.screenshot({ path: `${evidence}/joint-controls.png` });
    await page.getByRole("button", { name: "Save exercise", exact: true }).click(); await expect(page.getByText(/^Saved at .* · Private$/)).toBeVisible();
    await page.reload(); await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible();
    await selectWorkshopJoint(page, secondJoint);
    await page.getByLabel("Editing pose", { exact: true }).selectOption("2"); await expect(jointField(page, "x")).toHaveValue(String(peak));
    await page.getByLabel("Editing pose", { exact: true }).selectOption("1"); await expect(jointField(page, "x")).toHaveValue("60");
    await page.getByLabel("Editing pose", { exact: true }).selectOption("0"); await selectWorkshopJoint(page, firstJoint);
    expect(Number(await jointField(page, "x").inputValue())).toBeCloseTo(45, 0);
    await openWorkshopTool(page, "Contacts"); await page.getByRole("combobox", { name: "Selected item", exact: true }).selectOption(weight.id);
    await expect(page.getByRole("combobox", { name: "Selected item", exact: true }).locator("option:checked")).toContainText("Held with both hands");
    for (const time of Array.from({ length: 17 }, (_, index) => index * 200)) {
      await page.getByLabel("Preview time", { exact: true }).fill(String(time));
      await expect(page.getByRole("region", { name: "Selected item", exact: true })).toHaveAttribute("data-grip-reachable", "true");
      await page.locator("canvas").screenshot({ path: `${evidence}/pose-${time}.png` });
    }
    const record = await owner.from("private_exercises").select("content_id").eq("id", created.data).single(); if (record.error) throw record.error;
    const saved = await owner.from("exercise_scenes").select("studio_layout").eq("content_id", record.data.content_id).single(); if (saved.error) throw saved.error;
    const layout = saved.data.studio_layout as StudioLayout;
    expect(layout.objects[0].attachment).toBe("both"); expect(layout.objects[0].poseDriver).toBe(mode !== "single" ? "left-arm" : "right-arm");
    expect(errors).toEqual([]);
  } finally { await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password }); }
});
