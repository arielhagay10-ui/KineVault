import { expect, test } from "@playwright/test";
import { expandWorkshopControls } from "./workshop-menu.helpers";

test("opens a closed disclosure while its toggle ARIA state is stale", async ({ page }) => {
  await page.setContent(`<details>
    <summary role="button" aria-expanded="true">Drag options</summary>
    <input aria-label="Movement sensitivity" type="range">
  </details>`);

  await expandWorkshopControls(page, "Drag options");

  await expect(page.getByLabel("Movement sensitivity")).toBeVisible();
  await expect(page.locator("details")).toHaveJSProperty("open", true);
});

test("waits for an existing control panel to become visible before opening it", async ({ page }) => {
  await page.setContent(`<section hidden><details>
    <summary role="button" aria-expanded="false">Drag options</summary>
    <input aria-label="Movement sensitivity" type="range">
  </details></section>`);
  await page.evaluate(() => { setTimeout(() => { document.querySelector("section")!.hidden = false; }, 100); });

  await expandWorkshopControls(page, "Drag options");

  await expect(page.getByLabel("Movement sensitivity")).toBeVisible();
});
