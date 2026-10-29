import { expect } from "@playwright/test";
import { PerspectiveCamera, Vector3 } from "three";
import { fitWorkshopCamera } from "../../src/lib/motion/workshop-camera";
import { enableWorkshopFreeDrag, expandWorkshopControls, openWorkshopMenu, openWorkshopTool } from "../e2e/workshop-menu.helpers";
import { expectModalFocus } from "./accessibility.helpers";
import { test } from "./workshop.fixture";

test("More menu prevents focus behind its overlay and restores editor access on Escape", async ({ page, workshop }, testInfo) => {
  expect(workshop.draftId).toBeTruthy();
  await openWorkshopTool(page, "Item settings");
  const equipment = page.getByRole("tab", { name: "Item settings", exact: true, includeHidden: true });
  await openWorkshopMenu(page);
  await page.screenshot({ path: testInfo.outputPath("more-menu.png") });
  await equipment.focus();
  await expect(equipment).not.toBeFocused();
  await page.locator("[data-workshop-menu] > summary").press("Escape");
  await expect(page.getByRole("region", { name: "Workshop editor", exact: true }).locator("[inert]")).toHaveCount(0);
  await equipment.focus();
  await expect(equipment).toBeFocused();
});

test("equipment dialog traps focus, dismisses search with Escape and restores its trigger", async ({ page, workshop }) => {
  expect(workshop.draftId).toBeTruthy();
  await openWorkshopTool(page, "Item settings");
  const trigger = page.getByRole("button", { name: "Add equipment", exact: true }).filter({ visible: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Choose equipment", exact: true });
  const search = dialog.getByRole("searchbox", { name: "Search equipment", exact: true });
  const close = dialog.getByRole("button", { name: "Close", exact: true });
  await expect(search).not.toBeFocused();
  await expect(close).toBeFocused();
  await trigger.focus();
  await expect(trigger).not.toBeFocused();
  await expect(close).toBeFocused();
  for (let index = 0; index < 20; index++) {
    await page.keyboard.press("Tab");
    await expectModalFocus(page, "Choose equipment");
  }
  for (let index = 0; index < 20; index++) {
    await page.keyboard.press("Shift+Tab");
    await expectModalFocus(page, "Choose equipment");
  }
  await search.fill("dumbbell");
  await search.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("canvas selection preserves placement and stays available through named controls", async ({ page, hasTouch, workshop }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await openWorkshopTool(page, "Position");
  const previewSwitch = page.getByRole("button", { name: "Preview", exact: true });
  if (await previewSwitch.isVisible()) await previewSwitch.click();
  await page.getByRole("button", { name: "Front", exact: true }).click();
  await page.getByRole("button", { name: "Camera", exact: true }).click();
  if (hasTouch) {
    await enableWorkshopFreeDrag(page, "tap");
    await expect(page.getByRole("button", { name: "Move with mouse", exact: true, includeHidden: true })).toHaveAttribute("aria-pressed", "true");
  }
  const canvas = page.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  // Camera mode changes preview height; project only after its renderer resizes.
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => {
    const bounds = element.getBoundingClientRect();
    return Math.abs(element.width / element.height - bounds.width / bounds.height);
  })).toBeLessThan(.005);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Workshop canvas has no visible bounds");
  const fit = fitWorkshopCamera(workshop.scene, "front", bounds.width / bounds.height, 34);
  const camera = new PerspectiveCamera(34, bounds.width / bounds.height, .1, 100);
  camera.position.copy(fit.position);
  camera.lookAt(fit.target);
  camera.updateMatrixWorld();
  const point = new Vector3(workshop.weight.x, workshop.weight.y + .2, workshop.weight.z).project(camera);
  const x = bounds.x + (point.x + 1) * bounds.width / 2;
  const y = bounds.y + (1 - point.y) * bounds.height / 2;
  if (hasTouch) {
    await page.touchscreen.tap(x, y);
  } else {
    await page.mouse.dblclick(x, y);
    await expect(page.getByRole("button", { name: "Camera", exact: true })).toHaveAttribute("aria-pressed", "true");
  }
  const editSwitch = page.getByRole("button", { name: "Edit controls", exact: true });
  if (await editSwitch.isVisible()) await editSwitch.click();
  await expect(page.getByRole("region", { name: "Selected item", exact: true }).getByRole("heading", { level: 2 })).toHaveText("Dumbbell");
  await openWorkshopTool(page, "Position");
  await expandWorkshopControls(page, "Precise placement");
  await expect(page.getByRole("textbox", { name: "Position X meters", exact: true })).toHaveValue("1.4");
  await expect(page.getByRole("textbox", { name: "Position Y meters", exact: true })).toHaveValue("1.1");
  await openWorkshopTool(page, "Item settings");
  const objects = page.getByRole("combobox", { name: "Selected item", exact: true });
  await objects.focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(objects.locator("option:checked")).toHaveText("Anatomical figure");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(objects.locator("option:checked")).toHaveText("Dumbbell");
  await expect(page.getByRole("region", { name: "Selected item", exact: true }).getByRole("heading", { level: 2 })).toHaveText("Dumbbell");
  expect(errors).toEqual([]);
});
