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

export async function addWorkshopEquipment(page: Page, name: string) {
  await page.getByRole("button", { name: "Add equipment", exact: true }).filter({ visible: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("searchbox").fill(name);
  await dialog.getByRole("button", { name, exact: true }).click();
}

export async function setWorkshopMode(page: Page, mode: "quick" | "advanced") {
  const button = page.getByRole("button", { name: mode === "quick" ? "Quick create" : "Advanced editing", exact: true });
  if (await button.getAttribute("aria-pressed") !== "true") await button.click();
  const menu = page.locator("[data-workshop-menu]");
  if (await menu.evaluate(element => (element as HTMLDetailsElement).open)) await menu.locator(":scope > summary").click();
}

export async function inspectMachineMoment(page: Page, name: string, moment: "Start" | "Finish") {
  await setWorkshopMode(page, "advanced");
  await page.getByLabel("Selected equipment", { exact: true }).selectOption({ label: name });
  await page.getByRole("region", { name: "Playback controls" }).getByRole("button", { name: `View ${moment.toLowerCase()}`, exact: true }).click();
  await openWorkshopTool(page, "Timeline");
}

export async function editRowTravel(page: Page, value: string) {
  await inspectMachineMoment(page, "Cable row", "Finish");
  const animate = page.getByRole("button", { name: "Animate selected item", exact: true });
  if (await animate.isVisible()) await animate.click();
  const field = page.getByLabel("Row pull percent", { exact: true });
  await field.fill(value);
  await field.press("Enter");
  await setWorkshopMode(page, "quick");
}

export async function expectRowTravel(page: Page, value: string) {
  await inspectMachineMoment(page, "Cable row", "Finish");
  await expect(page.getByLabel("Row pull percent", { exact: true })).toHaveValue(value);
  await setWorkshopMode(page, "quick");
}

export async function openWorkshopTool(page: Page, name: string) {
  await setWorkshopMode(page, "advanced");
  const tab = page.getByRole("tab", { name, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  if (name === "Position") await expandWorkshopControls(page, "Precise placement");
  if (name === "Settings") {
    const details = page.locator('[data-workshop-panel="settings"] details');
    if (!await details.evaluate(element => (element as HTMLDetailsElement).open)) await details.locator("summary").click();
  }
}

export async function expandWorkshopControls(page: Page, name: string) {
  const button = page.getByRole("button", { name, exact: true, includeHidden: true });
  if (await button.count() === 0) return;
  await expect(button).toBeVisible();
  // Native exclusive disclosures can close before React receives onToggle.
  const isOpen = () => button.evaluate(element => element.closest("details")!.open);
  if (!await isOpen()) await button.click();
  await expect.poll(isOpen).toBe(true);
}

export function cableAttachmentButton(page: Page, attachment: CableAttachment) {
  return page.getByRole("group", { name: "Cable attachment", exact: true }).getByRole("button", { name: cableAttachmentNames[attachment], exact: true });
}

export async function selectWorkshopObject(page: Page, name: string) {
  await openWorkshopTool(page, "Equipment");
  await page.getByLabel("Scene objects").getByRole("button", { name, exact: true }).click();
}

export async function selectWorkshopJoint(page: Page, name: string) {
  await openWorkshopTool(page, "Pose");
  await page.getByRole("combobox", { name: "Body joint", exact: true }).selectOption(name.toLowerCase().replaceAll(" ", "-"));
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
}
