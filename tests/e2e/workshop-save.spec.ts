import { expect, type Page } from "@playwright/test";
import { test } from "../readiness/workshop.fixture";
import { openWorkshopTool, setWorkshopMode } from "./workshop-menu.helpers";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });

async function saveDuringAutosave(page: Page, draftId: string, trigger: "button" | "keyboard" | "quick create") {
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
    await expect(page.getByText("Saving…", { exact: true })).toBeVisible();
    const position = page.getByRole("textbox", { name: "Position X meters", exact: true });
    await position.fill("0.45");
    if (trigger === "quick create") {
      await setWorkshopMode(page, "quick");
      await page.getByRole("button", { name: "Name and save", exact: true }).click();
    }
    const save = page.getByRole("button", { name: trigger === "quick create" ? /^(Save privately|Saving…)$/ : "Save", exact: true });
    await expect(save).toBeEnabled();
    const saved = page.waitForResponse(response => response.request().method() === "POST"
      && hasEditedPosition(response.request().postData() ?? "") && response.ok());
    if (trigger === "keyboard") await position.press("Control+s");
    else await save.click();
    releaseFirst();
    await editedStarted;
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page.getByText("Saving…", { exact: true })).toBeVisible();
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

for (const trigger of ["button", "keyboard", "quick create"] as const) {
  test(`manual Save by ${trigger} queues a numeric edit behind an autosave`, async ({ page, workshop }) => {
    await saveDuringAutosave(page, workshop.draftId, trigger);
  });
}
