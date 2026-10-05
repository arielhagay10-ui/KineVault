import { expect, type Page } from "@playwright/test";
import { cableAttachmentNames } from "../../src/lib/motion/studio-cable";
import type { CableAttachment } from "../../src/lib/motion/workshop";

export async function openWorkshopMenu(page: Page) {
  const menu = page.locator("[data-workshop-menu]");
  if (!await menu.evaluate(element => (element as HTMLDetailsElement).open)) await menu.locator("summary").click();
}

export async function setWorkshopMode(page: Page, mode: "quick" | "advanced") {
  const button = page.getByRole("button", { name: mode === "quick" ? "Quick create" : "Advanced editing", exact: true });
  if (await button.getAttribute("aria-pressed") !== "true") await button.click();
  const menu = page.locator("[data-workshop-menu]");
  if (await menu.evaluate(element => (element as HTMLDetailsElement).open)) await menu.locator("summary").click();
}

export async function openWorkshopTool(page: Page, name: string) {
  await setWorkshopMode(page, "advanced");
  await page.getByRole("tab", { name, exact: true }).click();
  if (name === "Position") await expandWorkshopControls(page, "Precise placement");
  if (name === "Settings") {
    const details = page.locator('[data-workshop-panel="settings"] details');
    if (!await details.evaluate(element => (element as HTMLDetailsElement).open)) await details.locator("summary").click();
  }
}

export async function expandWorkshopControls(page: Page, name: string) {
  const button = page.getByRole("button", { name, exact: true });
  if (await button.isVisible() && await button.getAttribute("aria-expanded") === "false") await button.click();
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
