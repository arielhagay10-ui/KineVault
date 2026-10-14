import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { redactEvidence } from "../../scripts/lib/redact-evidence.mjs";

export async function auditAccessibility(page: Page, testInfo: TestInfo, name: string) {
  // Client navigation may commit content before streamed metadata reaches the head.
  await expect(page).toHaveTitle(/\S/);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  await testInfo.attach(name, {
    body: redactEvidence({ url: page.url(), violations: results.violations, incomplete: results.incomplete }),
    contentType: "application/json",
  });
  expect(results.violations, `${name}: ${results.violations.map(rule => `${rule.id}: ${rule.nodes.map(node => node.target.join(" ")).join(", ")}`).join("\n")}`).toEqual([]);
  expect(results.incomplete.filter(rule => rule.id === "aria-prohibited-attr"), "Labelled controls need roles that expose their names to assistive technology").toEqual([]);
}

export async function setAppearance(page: Page, appearance: "light" | "dark") {
  await page.getByRole("button", { name: "Site menu", exact: true }).click();
  await page.getByRole("combobox", { name: "Appearance", exact: true }).selectOption(appearance);
  await page.getByRole("button", { name: "Close menu", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", appearance);
}

export async function expectModalFocus(page: Page, label: string) {
  await expect.poll(() => page.getByRole("dialog", { name: label, exact: true })
    // Native dialogs permit Tab into browser chrome, represented by BODY.
    .evaluate(dialog => ({ modal: dialog.matches(":modal"),
      contained: document.activeElement === document.body || dialog.contains(document.activeElement),
      focusedElement: document.activeElement?.outerHTML.slice(0, 300),
    }))).toEqual(expect.objectContaining({ modal: true, contained: true }));
}
