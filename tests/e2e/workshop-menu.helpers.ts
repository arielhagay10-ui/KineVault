import { expect, type Locator, type Page } from "@playwright/test";
import { cableAttachmentNames } from "../../src/lib/motion/studio-cable";
import type { CableAttachment } from "../../src/lib/motion/workshop";

export async function dismissWorkshopTutorial(page: Page) {
  const editor = page.locator('[data-workshop="studio"]');
  await editor.waitFor({ state: "visible" });
  if (await editor.getAttribute("data-tutorial-open") === "true") {
    await page.getByRole("button", { name: "Close tutorial", exact: true }).click();
  }
}

export async function openWorkshopMenu(page: Page) {
  const menu = page.locator("[data-workshop-menu]");
  if (!await menu.evaluate(element => (element as HTMLDetailsElement).open)) await menu.locator(":scope > summary").click();
}

export async function openWorkshopRecovery(page: Page) {
  await openWorkshopMenu(page);
  const recovery = page.locator("[data-workshop-menu] details").filter({ hasText: "Recovery and shortcuts" });
  if (!await recovery.evaluate(element => (element as HTMLDetailsElement).open)) await recovery.locator("summary").click();
}

export async function openWorkshopDeviceRecovery(page: Page) {
  const recovery = page.getByRole("region", { name: "Recover draft", exact: true });
  await expect(recovery).toBeVisible();
}

export async function addWorkshopEquipment(page: Page, name: string) {
  await page.getByRole("button", { name: "Add equipment", exact: true }).filter({ visible: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("searchbox").fill(name);
  await dialog.getByRole("button", { name, exact: true }).click();
}

export async function enableWorkshopFreeDrag(page: Page, method: "click" | "tap" = "click") {
  const free = page.getByRole("button", { name: "Move with mouse", exact: true, includeHidden: true });
  const details = page.locator("details").filter({ has: free });
  if (!await details.evaluate(element => (element as HTMLDetailsElement).open)) await details.locator(":scope > summary")[method]();
  await free[method]();
  await details.locator(":scope > summary")[method]();
}

export async function inspectMachineMoment(page: Page, name: string, moment: "Start" | "Finish") {
  await openWorkshopTool(page, "Contacts");
  await page.getByRole("combobox", { name: "Selected item", exact: true }).selectOption({ label: name });
  await selectWorkshopMoment(page, moment);
  await openWorkshopTool(page, "Timeline");
}

export async function editRowTravel(page: Page, value: string) {
  await inspectMachineMoment(page, "Cable row", "Finish");
  const animate = page.getByRole("button", { name: "Animate selected item", exact: true });
  if (await animate.isVisible()) await animate.click();
  const field = page.getByLabel("Row pull percent", { exact: true });
  await field.fill(value);
  await field.press("Enter");
}

export async function expectRowTravel(page: Page, value: string) {
  await inspectMachineMoment(page, "Cable row", "Finish");
  await expect(page.getByLabel("Row pull percent", { exact: true })).toHaveValue(value);
}

/** Setups lives in Item settings and Settings in Timeline; both open as collapsible sections. */
export async function openWorkshopTool(page: Page, name: string) {
  await page.getByRole("region", { name: "Workshop editor", exact: true }).waitFor({ state: "visible" });
  const menu = page.locator("[data-workshop-menu]");
  if (await menu.evaluate(element => (element as HTMLDetailsElement).open)) await menu.locator(":scope > summary").click();
  const tabName = name === "Setups" ? "Item settings" : name === "Settings" ? "Timeline" : name;
  const tab = page.getByRole("tab", { name: tabName, exact: true, includeHidden: true });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  if (name === "Position") await expandWorkshopControls(page, "Precise placement");
  if (name === "Timeline") await expandWorkshopControls(page, "Advanced pose actions");
  const section = name === "Setups" ? page.locator("[data-workshop-setups]") : name === "Settings" ? page.locator("[data-workshop-settings]") : null;
  if (section && !await section.evaluate(element => (element as HTMLDetailsElement).open)) await section.locator(":scope > summary").click();
}

export async function expandWorkshopControls(page: Page, name: string) {
  const button = page.getByRole("button", { name, exact: true, includeHidden: true });
  const summary = page.locator("summary").filter({ hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) });
  const control = await button.count() ? button : summary;
  if (await control.count() === 0) return;
  await expect(control).toBeVisible();
  // Native exclusive disclosures can close before React receives onToggle.
  const isOpen = () => control.evaluate(element => element.closest("details")!.open);
  if (!await isOpen()) await control.click();
  await expect.poll(isOpen).toBe(true);
}

export function cableAttachmentButton(page: Page, attachment: CableAttachment) {
  return page.getByRole("group", { name: "Cable attachment", exact: true }).getByRole("button", { name: cableAttachmentNames[attachment], exact: true });
}

export async function selectWorkshopObject(page: Page, name: string) {
  await openWorkshopTool(page, "Item settings");
  const select = page.getByRole("combobox", { name: "Selected item", exact: true });
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const option = select.locator("option").filter({ hasText: new RegExp(`^${escaped}(?: · |$)`) });
  await expect(option).toHaveCount(1);
  await select.selectOption((await option.getAttribute("value"))!);
}

/** The timeline's pose markers, in time order. */
export const workshopPoses = (page: Page) => page.getByRole("group", { name: "Poses", exact: true }).getByRole("button");
export const workshopPose = (page: Page, index: number) => page.getByRole("group", { name: "Poses", exact: true }).locator(`[data-pose-index="${index}"]`);

export const currentWorkshopPose = (page: Page) => page.getByRole("group", { name: "Poses", exact: true }).locator('[aria-pressed="true"]');

export async function selectWorkshopPose(page: Page, index: number | string) {
  await workshopPose(page, Number(index)).click();
}

export async function selectWorkshopMoment(page: Page, moment: "Start" | "Finish" | "Return") {
  await page.getByRole("group", { name: "Poses", exact: true }).getByRole("button", { name: new RegExp(`^${moment} pose · `) }).click();
}

export async function selectWorkshopJoint(page: Page, name: string) {
  await openWorkshopTool(page, "Pose");
  const [side, family] = name.trim().toLowerCase().split(/\s+/, 2);
  await page.getByRole("combobox", { name: "Body joint", exact: true }).selectOption(family ?? side);
  if (family) {
    const sideName = side.charAt(0).toUpperCase() + side.slice(1);
    await page.getByRole("group", { name: "Body side", exact: true }).getByRole("button", { name: sideName, exact: true }).click();
  }
}

export function jointField(page: Page, axis: "x" | "y" | "z", range = false) {
  const names = { x: /^(Bend|Palm turn|Toes up \/ down) /, y: /^(Turn|Wrist bend|Foot turn) /, z: /^(Side to side|Wrist tilt|Foot tilt) / };
  return page.locator('[data-workshop-panel="pose"]').getByRole(range ? "slider" : "textbox", { name: names[axis] });
}

export async function setWorkshopLanguage(page: Page, language: "en" | "he") {
  await openWorkshopMenu(page);
  await page.getByRole("combobox", { name: /Workshop language|שפת הסדנה/ }).selectOption(language);
  await expect(page.locator('[data-workshop="studio"]')).toHaveAttribute("lang", language);
  if (await page.locator("[data-workshop-menu]").evaluate(element => (element as HTMLDetailsElement).open)) await page.locator("[data-workshop-menu] > summary").click();
  await expect(page.locator("[data-workshop-menu]")).toHaveJSProperty("open", false);
  await expect.poll(() => page.locator("[data-workshop-controls-scroll]").evaluate(element => element.closest("[inert]") === null)).toBe(true);
}

/** Clicks a camera action and waits for its frame's metrics; needs `?metrics=1`. Software frames can outlast a fixed sleep. */
export async function renderCameraAction(page: Page, viewer: Locator, name: "Zoom in" | "Zoom out") {
  const frames = () => viewer.getAttribute("data-render-frames").then(Number);
  const before = await frames();
  await page.getByRole("button", { name, exact: true }).click();
  await expect.poll(frames).toBeGreaterThan(before);
}
