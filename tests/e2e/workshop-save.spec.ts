import { selectWorkshopMoment } from "./workshop-menu.helpers";
import { expect, type Page } from "@playwright/test";
import { test } from "../readiness/workshop.fixture";
import { dismissWorkshopTutorial, openWorkshopTool } from "./workshop-menu.helpers";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });

test("a new saved workshop draft keeps its equipment after refresh", async ({ page, workshop }) => {
  test.setTimeout(120_000);
  await page.goto("/my-exercises/new");
  await dismissWorkshopTutorial(page);
  await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Add equipment", exact: true }).click();
  await page.getByRole("button", { name: "Dumbbell", exact: true }).click();
  await page.getByRole("button", { name: "Hold with both hands", exact: true }).click();
  await page.getByLabel("Exercise name", { exact: true }).fill("New shared hold save fixture");
  await page.getByRole("button", { name: "Save exercise", exact: true }).click();
  await expect(page).toHaveURL(/\/my-exercises\/[\da-f-]+\/workshop$/);
  await expect(page).not.toHaveURL(new RegExp(workshop.draftId));
  await expect(page.getByText(/Saved at.*Private/)).toBeVisible();
  await page.reload();
  await dismissWorkshopTutorial(page);
  await expect(page.getByLabel("Exercise name", { exact: true })).toHaveValue("New shared hold save fixture");
  await page.getByRole("combobox", { name: "Selected item", exact: true }).selectOption({ label: "Dumbbell · Held with both hands" });
  await openWorkshopTool(page, "Contacts");
  await expect(page.getByRole("button", { name: "Hold with both hands", exact: true })).toHaveAttribute("aria-pressed", "true");
});

async function saveDuringAutosave(page: Page, draftId: string, trigger: "button" | "keyboard" | "captured poses") {
  test.setTimeout(120_000);
  let releaseFirst!: () => void;
  let markStarted!: () => void;
  let releaseEdited!: () => void;
  let markEdited!: () => void;
  const firstReleased = new Promise<void>(resolve => { releaseFirst = resolve; });
  const firstStarted = new Promise<void>(resolve => { markStarted = resolve; });
  const editedReleased = new Promise<void>(resolve => { releaseEdited = resolve; });
  const editedStarted = new Promise<void>(resolve => { markEdited = resolve; });
  const hasEditedPosition = (body: string) => /"body":\{[^}]*"x":0\.45(?:,|\})/.test(body);
  let holdFirst = true;
  await page.route(`**/my-exercises/${draftId}/workshop`, async route => {
    if (route.request().method() === "POST" && holdFirst) {
      holdFirst = false;
      markStarted();
      await firstReleased;
    } else if (route.request().method() === "POST" && hasEditedPosition(route.request().postData() ?? "")) {
      markEdited();
      await editedReleased;
    }
    await route.continue();
  });
  try {
    await openWorkshopTool(page, "Position");
    await page.getByLabel("Exercise name", { exact: true }).fill("Queued save fixture");
    await firstStarted;
    await expect(page.getByRole("button", { name: "Save exercise", exact: true })).toHaveAttribute("aria-busy", "true");
    const position = page.getByRole("textbox", { name: "Position X meters", exact: true });
    await position.fill("0.45");
    if (trigger === "captured poses") {
      await position.press("Tab");
      await page.getByRole("button", { name: "Capture start", exact: true }).click();
      await selectWorkshopMoment(page, "Finish");
      const finishPose = page.getByRole("button", { name: "Capture pose", exact: true });
      if (await finishPose.isEnabled()) await finishPose.click();
    }
    const save = page.getByRole("button", { name: "Save exercise", exact: true });
    await expect(save).toBeEnabled();
    const saved = page.waitForResponse(response => response.request().method() === "POST"
      && hasEditedPosition(response.request().postData() ?? "") && response.ok());
    if (trigger === "keyboard") await position.press("Control+s");
    else await save.click();
    releaseFirst();
    await editedStarted;
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page.getByRole("button", { name: "Save exercise", exact: true })).toHaveAttribute("aria-busy", "true");
    await expect(page.getByText(/Saved at.*Private/)).toHaveCount(0);
    releaseEdited();
    await saved;
    await expect(page.getByText(/Saved at.*Private/)).toBeVisible();
    await page.reload();
    await openWorkshopTool(page, "Position");
    await expect(position).toHaveValue("0.45");
  } finally {
    releaseFirst();
    releaseEdited();
    await page.unrouteAll({ behavior: "ignoreErrors" });
  }
}

for (const trigger of ["button", "keyboard", "captured poses"] as const) {
  test(`manual Save by ${trigger} queues a numeric edit behind an autosave`, async ({ page, workshop }) => {
    await saveDuringAutosave(page, workshop.draftId, trigger);
  });
}

for (const trigger of ["button", "keyboard", "details"] as const) {
  test(`unnamed Save by ${trigger} asks for a name and saves from the prompt`, async ({ page, workshop }) => {
    test.setTimeout(120_000);
    if (trigger === "details") {
      await page.goto("/my-exercises/new");
      await dismissWorkshopTutorial(page);
    }
    await page.getByLabel("Exercise name", { exact: true }).fill(" ");
    let save = page.getByRole("button", { name: "Save exercise", exact: true });
    if (trigger === "details") {
      await page.getByText("More", { exact: true }).click();
      save = page.getByRole("button", { name: "Save & add details", exact: true });
    }
    await expect(save).toBeEnabled();
    if (trigger === "keyboard") await page.getByLabel("Exercise name", { exact: true }).press("Control+s");
    else await save.click();
    const prompt = page.getByRole("dialog", { name: "Name your exercise", exact: true });
    const name = prompt.getByRole("textbox", { name: "Exercise name", exact: true });
    await expect(name).not.toBeFocused();
    await expect(prompt.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
    await name.fill(" ");
    await expect(prompt.getByRole("button", { name: "Save exercise", exact: true })).toBeDisabled();
    if (trigger === "button") {
      await page.screenshot({ path: ".local-artifacts/workshop/save-name-prompt.png" });
      await name.press("Escape");
      await expect(prompt).toHaveCount(0);
      await expect(save).toBeFocused();
      await expect(page.getByLabel("Exercise name", { exact: true })).toHaveValue(" ");
      await save.click();
    }
    await name.fill("Named from save prompt");
    const saved = page.waitForResponse(response => response.request().method() === "POST"
      && response.url().includes(trigger === "details" ? "/my-exercises/new" : `/my-exercises/${workshop.draftId}/workshop`) && response.ok());
    await name.press("Enter");
    await saved;
    if (trigger === "details") await expect(page).toHaveURL(/\/my-exercises\/[\da-f-]+\/edit\?sceneSaved=1$/);
    else {
      await expect(prompt).toHaveCount(0);
      await expect(page.getByText(/Saved at.*Private/)).toBeVisible();
      await page.reload();
      await expect(page.getByLabel("Exercise name", { exact: true })).toHaveValue("Named from save prompt");
    }
  });
}
