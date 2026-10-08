import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { PerspectiveCamera, Vector3 } from "three";
import { createStudioObject } from "../../src/lib/motion/studio";
import { blankWorkshopScene } from "../../src/lib/motion/workshop";
import { fitWorkshopCamera } from "../../src/lib/motion/workshop-camera";
import { expandWorkshopControls, openWorkshopTool } from "./workshop-menu.helpers";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });

test("right-click selects the hit item and enters Move from Camera", async ({ page }) => {
  test.setTimeout(120_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const email = `camera-click-${randomUUID()}@example.test`, password = "CameraClick2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;

  try {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const signedIn = await owner.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw signedIn.error;
    const scene = structuredClone(blankWorkshopScene);
    const weight = { ...createStudioObject("dumbbell", randomUUID(), 0), x: 1.4, y: 1.1, z: 0, attachment: "none" as const };
    scene.studio!.objects = [weight];
    const created = await owner.rpc("save_workshop_draft", { p_scene: scene, p_name: "Camera click fixture" });
    if (created.error) throw created.error;
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/my-exercises/${created.data}/workshop?metrics=1`);
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await openWorkshopTool(page, "Position");
    await expandWorkshopControls(page, "Precise placement");
    await page.getByRole("button", { name: "Front", exact: true }).click();
    const cameraButton = page.getByRole("button", { name: "Camera", exact: true });
    const moveButton = page.getByRole("button", { name: "Move with mouse", exact: true });
    await cameraButton.click();
    const canvas = page.locator("canvas");
    await canvas.scrollIntoViewIfNeeded();
    const bounds = (await canvas.boundingBox())!;
    const fit = fitWorkshopCamera(scene, "front", bounds.width / bounds.height, 34);
    const camera = new PerspectiveCamera(34, bounds.width / bounds.height, .1, 100);
    camera.position.copy(fit.position); camera.lookAt(fit.target); camera.updateMatrixWorld();
    const project = (x: number, y: number, z: number) => {
      const point = new Vector3(x, y, z).project(camera);
      return { x: bounds.x + (point.x + 1) * bounds.width / 2, y: bounds.y + (1 - point.y) * bounds.height / 2 };
    };
    await page.mouse.click(bounds.x + 80, bounds.y + 80, { button: "right" });
    await expect(cameraButton).toHaveAttribute("aria-pressed", "true");
    const item = project(weight.x, weight.y + .2, weight.z);
    await page.mouse.click(item.x, item.y, { button: "right" });
    await expect(moveButton).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Selected item").getByRole("heading", { level: 2 })).toHaveText("Dumbbell");
    await expandWorkshopControls(page, "Precise placement");
    await expect(page.getByRole("textbox", { name: "Position X meters", exact: true })).toHaveValue("1.4");
    await expect(page.getByRole("textbox", { name: "Position Y meters", exact: true })).toHaveValue("1.1");
    await cameraButton.click();
    const body = project(0, 1.9, .1);
    await page.mouse.click(body.x, body.y, { button: "right" });
    await expect(moveButton).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Selected item").getByRole("heading", { level: 2 })).toHaveText("Anatomical figure");
    await expandWorkshopControls(page, "Precise placement");
    await expect(page.getByRole("textbox", { name: "Position X meters", exact: true })).toHaveValue("0");
    const metrics = page.locator('[data-camera-position]');
    const before = await metrics.getAttribute("data-camera-position");
    await page.mouse.move(body.x, body.y);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(body.x + 100, body.y + 30, { steps: 10 });
    await page.mouse.up({ button: "right" });
    await expect.poll(() => metrics.getAttribute("data-camera-position")).not.toBe(before);
    await expect(moveButton).toHaveAttribute("aria-pressed", "true");
    expect(errors).toEqual([]);
  } finally {
    try {
      await page.close();
    } finally {
      await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password });
    }
  }
});
