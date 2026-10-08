import { expect } from "@playwright/test";
import { PerspectiveCamera, Vector3 } from "three";
import { fitWorkshopCamera } from "../../src/lib/motion/workshop-camera";
import { expandWorkshopControls, openWorkshopTool } from "../e2e/workshop-menu.helpers";
import { expectModalFocus } from "./accessibility.helpers";
import { test } from "./workshop.fixture";

test("equipment dialog traps focus, dismisses search with Escape and restores its trigger", async ({ page, workshop }) => {
  expect(workshop.draftId).toBeTruthy();
  await openWorkshopTool(page, "Equipment");
  const trigger = page.getByRole("button", { name: "Add equipment", exact: true }).filter({ visible: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Choose equipment", exact: true });
  const search = dialog.getByRole("searchbox", { name: "Search equipment", exact: true });
  await expect(search).toBeFocused();
  await trigger.focus();
  await expect(trigger).not.toBeFocused();
  await expect(search).toBeFocused();
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
  await page.getByRole("button", { name: "Front", exact: true }).click();
  await page.getByRole("button", { name: "Camera", exact: true }).click();
  if (hasTouch) {
    await page.getByRole("button", { name: "Move with mouse", exact: true }).tap();
    await expect(page.getByRole("button", { name: "Move with mouse", exact: true })).toHaveAttribute("aria-pressed", "true");
  }
  const canvas = page.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
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
  await expect(page.getByLabel("Selected item").getByRole("heading", { level: 2 })).toHaveText("Dumbbell");
  await page.getByRole("tab", { name: "Position", exact: true }).click();
  await expandWorkshopControls(page, "Precise placement");
  await expect(page.getByRole("textbox", { name: "Position X meters", exact: true })).toHaveValue("1.4");
  await expect(page.getByRole("textbox", { name: "Position Y meters", exact: true })).toHaveValue("1.1");
  await openWorkshopTool(page, "Equipment");
  const objects = page.getByLabel("Scene objects", { exact: true });
  const figure = objects.getByRole("button", { name: "Anatomical figure", exact: true });
  await figure.focus();
  await page.keyboard.press("Enter");
  await expect(figure).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("combobox", { name: "Selected equipment", exact: true }).locator("option:checked")).toHaveText("Anatomical figure");
  const dumbbell = objects.getByRole("button", { name: "Dumbbell", exact: true });
  await dumbbell.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("combobox", { name: "Selected equipment", exact: true }).locator("option:checked")).toHaveText("Dumbbell");
  await expect(page.getByLabel("Selected item").getByRole("heading", { level: 2 })).toHaveText("Dumbbell");
  expect(errors).toEqual([]);
});
