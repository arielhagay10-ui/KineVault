import { mkdirSync } from "node:fs";
import { expect } from "@playwright/test";
import { test } from "../readiness/workshop.fixture";
import { dismissWorkshopTutorial, jointField, openWorkshopTool, selectWorkshopJoint, selectWorkshopMoment, selectWorkshopObject } from "./workshop-menu.helpers";

test("repeated shared shoulder and palm edits return the weight to its original position", async ({ page, workshop }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await selectWorkshopObject(page, "Dumbbell");
  await openWorkshopTool(page, "Contacts");
  await page.getByRole("button", { name: "Hold with both hands", exact: true }).click();
  const position = async () => {
    await selectWorkshopObject(page, "Dumbbell");
    await openWorkshopTool(page, "Position");
    return Promise.all(["X", "Y", "Z"].map(async axis => Number(await page.getByRole("textbox", { name: `Position ${axis} meters`, exact: true }).inputValue())));
  };
  for (const part of ["shoulder", "wrist"]) {
    const edit = async (value: number) => {
      await selectWorkshopJoint(page, `Left ${part}`);
      await page.getByRole("group", { name: "Body side", exact: true }).getByRole("button", { name: "Both", exact: true }).click();
      await jointField(page, "x").fill(String(value));
      await jointField(page, "x").press("Enter");
    };
    await edit(30);
    const before = await position();
    for (const value of [90, 30, 90, 30]) await edit(value);
    const after = await position();
    after.forEach((value, axis) => expect(value).toBeCloseTo(before[axis], 2));
  }
  await page.getByRole("button", { name: "Save exercise", exact: true }).click();
  await expect(page.getByText(/Saved at.*Private/)).toBeVisible();
  const beforeReload = await position();
  await page.goto(`/my-exercises/${workshop.draftId}/workshop`);
  await dismissWorkshopTutorial(page);
  await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
  const afterReload = await position();
  afterReload.forEach((value, axis) => expect(value).toBeCloseTo(beforeReload[axis], 2));
});

test("a fresh shared dumbbell hold stays stable through shoulder and elbow button edits", async ({ page, workshop }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await selectWorkshopObject(page, "Dumbbell");
  await expect(page.getByRole("combobox", { name: "Selected item", exact: true })).toHaveValue(workshop.weight.id);
  await openWorkshopTool(page, "Contacts");
  await page.getByRole("button", { name: "Hold with both hands", exact: true }).click();
  const contact = page.locator('section[aria-label="Selected item"]');
  await expect(contact).toHaveAttribute("data-grip-reachable", "true");
  const artifacts = ".local-artifacts/grip-followup";
  mkdirSync(artifacts, { recursive: true });
  await page.locator("canvas").screenshot({ path: `${artifacts}/default-hold.png` });
  for (const part of ["shoulder", "elbow"] as const) {
    for (const side of ["Right", "Left"]) {
      await selectWorkshopJoint(page, `${side} ${part}`);
      await page.getByRole("group", { name: "Body side", exact: true }).getByRole("button", { name: "Both", exact: true }).click();
      const field = jointField(page, "x");
      const initial = Number(await field.inputValue());
      for (const direction of [1, 1, -1, -1]) {
        const before = Number(await field.inputValue());
        await page.getByRole("button", { name: new RegExp(`^${direction > 0 ? "Increase" : "Decrease"} Bend Both ${part}s degrees by 1$`) }).click();
        await expect.poll(async () => Math.abs(Number(await field.inputValue()) - before - direction)).toBeLessThan(.02);
        await expect(contact).toHaveAttribute("data-grip-reachable", "true");
      }
      expect(Math.abs(Number(await field.inputValue()) - initial)).toBeLessThan(.03);
    }
  }
  for (const [part, value] of [["shoulder", "-87"], ["elbow", "44"], ["shoulder", "-146"], ["elbow", "85"]]) {
    await selectWorkshopJoint(page, `Left ${part}`);
    await page.getByRole("group", { name: "Body side", exact: true }).getByRole("button", { name: "Both", exact: true }).click();
    await jointField(page, "x").fill(value); await jointField(page, "x").press("Enter");
    await expect.poll(async () => Math.abs(Number(await jointField(page, "x").inputValue()) - Number(value))).toBeLessThan(.02);
    await expect(contact).toHaveAttribute("data-grip-reachable", "true");
    await page.locator("canvas").screenshot({ path: `${artifacts}/${part}-${value}.png` });
  }
  await selectWorkshopMoment(page, "Finish");
  for (const [part, value] of [["shoulder", "-87"], ["elbow", "44"]]) {
    await selectWorkshopJoint(page, `Left ${part}`);
    await page.getByRole("group", { name: "Body side", exact: true }).getByRole("button", { name: "Both", exact: true }).click();
    await jointField(page, "x").fill(value); await jointField(page, "x").press("Enter");
  }
  await openWorkshopTool(page, "Timeline");
  for (const view of ["Three-quarter", "Side"]) {
    await page.getByRole("button", { name: view, exact: true }).click();
    for (let step = 0; step <= 16; step++) {
      await page.getByLabel("Preview time", { exact: true }).fill(String(step * 200));
      await expect(contact).toHaveAttribute("data-grip-reachable", "true");
      if (step % 2 === 0) await page.locator("canvas").screenshot({ path: `${artifacts}/authored-${view}-${step}.png` });
    }
  }
  await page.getByRole("button", { name: "Save exercise", exact: true }).click();
  await expect(page.getByText(/Saved at.*Private/)).toBeVisible();
  await page.reload(); await dismissWorkshopTutorial(page);
  await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
  await selectWorkshopObject(page, "Dumbbell"); await openWorkshopTool(page, "Contacts");
  await expect(page.getByRole("button", { name: "Hold with both hands", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(contact).toHaveAttribute("data-grip-reachable", "true");
});
