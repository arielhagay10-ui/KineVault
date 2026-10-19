import { expect } from "@playwright/test";
import { test } from "../readiness/workshop.fixture";
import { automaticWeightTransform } from "../../src/lib/motion/automatic-weight-grip";
import { workshopSceneSchema } from "../../src/lib/motion/scene-schema";
import { PerspectiveCamera, Vector3 } from "three";
import { fitWorkshopCamera } from "../../src/lib/motion/workshop-camera";
import { enableWorkshopFreeDrag, expandWorkshopControls, openWorkshopTool, selectWorkshopJoint, selectWorkshopObject, jointField } from "./workshop-menu.helpers";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });

test("detail preferences retain a ready preview and the joint inspector follows playback", async ({ page, workshop }) => {
  await openWorkshopTool(page, "View");
  const detail = page.getByLabel("Preview detail", { exact: true });
  for (const quality of ["economy", "auto", "contact", "auto"]) {
    await detail.selectOption(quality);
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Front", exact: true })).toBeEnabled();
  }
  await selectWorkshopJoint(page, "Left elbow");
  const field = jointField(page, "x");
  await field.fill("80"); await field.press("Enter");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(async () => Number(await field.inputValue())).not.toBe(80);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  expect(workshop.draftId).toBeTruthy();
});

test("rejected weight carrying is visible, preserves the edit, and can be repaired", async ({ page, workshop }) => {
  test.setTimeout(90_000);
  const scene = structuredClone(workshop.scene);
  scene.keyframes = Array.from({ length: 24 }, (_, i) => ({ ...scene.keyframes[0], timeMs: i === 23 ? scene.durationMs : i * 100 }));
  const weight = { ...scene.studio!.objects[0], attachment: "left" as const };
  Object.assign(weight, automaticWeightTransform(scene.studio!.body, weight, "left", scene, 0));
  const { x: weightX, y, z, rotationX, rotationY, rotationZ, scale } = weight;
  weight.frames = [0, 50, scene.durationMs].map(timeMs => ({ x: weightX, y, z, rotationX, rotationY, rotationZ, scale, timeMs }));
  scene.studio!.objects = [weight];
  workshopSceneSchema.parse(scene);
  const key = `kinevault.workshop.draft.${workshop.userId}.${workshop.draftId}`;
  await page.evaluate(({ key, scene, privateId }) => localStorage.setItem(key, JSON.stringify({ scene, name: "Moment limit", privateId, confirmed: true, sessionId: "audit-fixture", updatedAt: Date.now() })), { key, scene, privateId: workshop.draftId });
  await page.reload();
  const recovery = page.getByLabel("Recover draft", { exact: true });
  await recovery.getByRole("button", { name: "Restore device draft", exact: true }).click();
  await selectWorkshopObject(page, "Anatomical figure");
  await openWorkshopTool(page, "Position");
  const x = page.getByRole("textbox", { name: "Position X meters", exact: true });
  await x.fill("0.1"); await x.press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "more than 24 weight moments" })).toBeVisible();
  await expect(x).toHaveValue("0.1");
  await openWorkshopTool(page, "Timeline");
  await page.getByRole("group", { name: "Saved poses", exact: true }).getByRole("button").nth(1).click();
  await page.getByRole("button", { name: "Delete pose", exact: true }).click();
  await openWorkshopTool(page, "Position");
  await x.fill("0.2"); await x.press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "more than 24 weight moments" })).toHaveCount(0);
  await expect(x).toHaveValue("0.2");
});

test("a long object gesture checkpoints live placement, releases once, and cancels on blur", async ({ page, workshop }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await selectWorkshopObject(page, "Dumbbell");
  await openWorkshopTool(page, "Position");
  await page.getByRole("button", { name: "Front", exact: true }).click();
  await enableWorkshopFreeDrag(page);
  await expandWorkshopControls(page, "Precise placement");
  const xField = page.getByRole("textbox", { name: "Position X meters", exact: true });
  const original = await xField.inputValue();
  const historyRows = page.locator('[aria-label="Edit history"] ol li');
  const originalHistoryCount = await historyRows.count();
  const bounds = (await page.locator("canvas").boundingBox())!;
  const fit = fitWorkshopCamera(workshop.scene, "front", bounds.width / bounds.height, 34);
  const camera = new PerspectiveCamera(34, bounds.width / bounds.height, .1, 100);
  camera.position.copy(fit.position); camera.lookAt(fit.target); camera.updateMatrixWorld();
  const point = new Vector3(workshop.weight.x, workshop.weight.y + .2, workshop.weight.z).project(camera);
  const start = { x: bounds.x + (point.x + 1) * bounds.width / 2, y: bounds.y + (1 - point.y) * bounds.height / 2 };
  const key = `kinevault.workshop.draft.${workshop.userId}.${workshop.draftId}`;
  const deviceX = () => page.evaluate(({ key, id }) => {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    return value?.scene?.studio?.objects.find((item: { id: string }) => item.id === id)?.x ?? null;
  }, { key, id: workshop.weight.id });
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(start.x + 80, start.y - 30, { steps: 8 });
  await expect.poll(deviceX).not.toBeNull();
  await expect.poll(deviceX).not.toBe(workshop.weight.x);
  await page.mouse.up();
  await expect.poll(async () => Number(await xField.inputValue())).not.toBe(Number(original));
  await expect(historyRows).toHaveCount(originalHistoryCount + 1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(xField).toHaveValue(original);
  await expect(historyRows).toHaveCount(originalHistoryCount);
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(start.x + 55, start.y - 25, { steps: 6 });
  await expect.poll(deviceX).not.toBeNull();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.mouse.up();
  await expect(xField).toHaveValue(original);
  await expect(historyRows).toHaveCount(originalHistoryCount);
});
