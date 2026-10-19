import { expect, type Page } from "@playwright/test";
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

export async function openWorkshopTool(page: Page, name: string) {
  await page.getByRole("region", { name: "Workshop editor", exact: true }).waitFor({ state: "visible" });
  const edit = page.getByRole("button", { name: "Edit controls", exact: true });
  if (await edit.isVisible()) await edit.click();
  const menu = page.locator("[data-workshop-menu]");
  if (await menu.evaluate(element => (element as HTMLDetailsElement).open)) await menu.locator(":scope > summary").click();
  if (["View", "Setups", "Settings"].includes(name)) {
    const more = page.getByRole("group", { name: "Workshop tools", exact: true }).locator("details");
    if (!await more.evaluate(element => (element as HTMLDetailsElement).open)) await more.locator(":scope > summary").click();
  }
  const tab = page.getByRole("tab", { name, exact: true, includeHidden: true });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  if (name === "Position") await expandWorkshopControls(page, "Precise placement");
  if (name === "Timeline") await expandWorkshopControls(page, "Advanced pose actions");
  if (name === "Settings") {
    const details = page.locator('[data-workshop-panel="settings"] details');
    if (!await details.evaluate(element => (element as HTMLDetailsElement).open)) await details.locator("summary").click();
  }
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
  await openWorkshopTool(page, "Equipment");
  const select = page.getByRole("combobox", { name: "Selected item", exact: true });
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const option = select.locator("option").filter({ hasText: new RegExp(`^${escaped}(?: · |$)`) });
  await expect(option).toHaveCount(1);
  await select.selectOption((await option.getAttribute("value"))!);
}

export async function selectWorkshopMoment(page: Page, moment: "Start" | "Finish" | "Return") {
  const poses = page.getByRole("combobox", { name: "Editing pose", exact: true });
  const value = await poses.locator("option").filter({ hasText: new RegExp(`^${moment}(?: ·|$)`) }).getAttribute("value");
  if (value === null) throw new Error(`Missing ${moment} pose`);
  await poses.selectOption(value);
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
