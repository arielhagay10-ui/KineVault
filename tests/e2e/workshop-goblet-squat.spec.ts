import { mkdirSync } from "node:fs";
import { expect } from "@playwright/test";
import { test } from "../readiness/workshop.fixture";
import { dismissWorkshopTutorial, jointField, openWorkshopTool, selectWorkshopJoint, selectWorkshopMoment, selectWorkshopObject } from "./workshop-menu.helpers";

test("a fresh two-hand hold can be authored into a goblet squat and reloaded", async ({ page, workshop }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await selectWorkshopObject(page, "Dumbbell");
  await expect(page.getByRole("combobox", { name: "Selected item", exact: true })).toHaveValue(workshop.weight.id);
  await page.getByRole("button", { name: "Hold with both hands", exact: true }).click();
  const contact = page.locator('section[aria-label="Selected item"]');
  await expect(contact).toHaveAttribute("data-grip-reachable", "true");
  await page.getByRole("button", { name: "Capture start", exact: true }).click();
  await openWorkshopTool(page, "Settings");
  await page.getByRole("combobox", { name: /^Movement setup/ }).selectOption("squat");
  await selectWorkshopMoment(page, "Finish");
  await selectWorkshopJoint(page, "Torso");
  await jointField(page, "x").fill("35"); await jointField(page, "x").press("Enter");
  await page.getByRole("button", { name: "Capture pose", exact: true }).click();
  await selectWorkshopObject(page, "Dumbbell");
  await openWorkshopTool(page, "Timeline");
  await page.getByRole("toolbar", { name: "Movement tools", exact: true }).getByRole("button", { name: "Camera", exact: true }).click();
  const time = page.getByLabel("Preview time", { exact: true });
  const duration = Number(await time.getAttribute("max"));
  expect(duration).toBeGreaterThan(0);
  const artifacts = ".local-artifacts/goblet-clearance";
  mkdirSync(artifacts, { recursive: true });
  for (const view of ["Front", "Three-quarter", "Side"]) {
    await page.getByRole("button", { name: view, exact: true }).click();
    for (let step = 0; step <= 16; step++) {
      await time.fill(String(Math.round(duration * step / 16)));
      await expect(contact).toHaveAttribute("data-grip-reachable", "true");
      if (step % 2 === 0) await page.locator("canvas").screenshot({ path: `${artifacts}/goblet-${view}-${step}.png` });
    }
  }
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const initial = await time.inputValue();
  await expect.poll(() => time.inputValue()).not.toBe(initial);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Save exercise", exact: true }).click();
  await expect(page.getByText(/Saved at.*Private/)).toBeVisible();
  await page.reload(); await dismissWorkshopTutorial(page);
  await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
  await selectWorkshopObject(page, "Dumbbell"); await openWorkshopTool(page, "Contacts");
  await expect(page.getByRole("button", { name: "Hold with both hands", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(contact).toHaveAttribute("data-grip-reachable", "true");
  await page.locator("canvas").screenshot({ path: `${artifacts}/goblet-reloaded.png` });
});
