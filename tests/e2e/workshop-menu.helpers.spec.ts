import { expect, test } from "@playwright/test";
import { expandWorkshopControls, openWorkshopTool } from "./workshop-menu.helpers";

test("opens a closed disclosure while its toggle ARIA state is stale", async ({ page }) => {
  await page.setContent(`<details>
    <summary role="button" aria-expanded="true">Drag options</summary>
    <input aria-label="Movement sensitivity" type="range">
  </details>`);

  await expandWorkshopControls(page, "Drag options");

  await expect(page.getByLabel("Movement sensitivity")).toBeVisible();
  await expect(page.locator("details")).toHaveJSProperty("open", true);
});

test("waits for the mobile editor before revealing its tools", async ({ page }) => {
  page.setDefaultTimeout(1500);
  await page.setContent("<main></main>");
  await page.evaluate(() => {
    setTimeout(() => {
      document.querySelector("main")!.innerHTML = `<section role="region" aria-label="Workshop editor">
        <button onclick="document.querySelector('[data-tools]').hidden = false">Edit controls</button>
        <details data-workshop-menu><summary>More</summary></details>
        <div data-tools hidden><button role="tab" aria-selected="false" onclick="this.setAttribute('aria-selected', 'true')">Equipment</button></div>
      </section>`;
    }, 100);
  });

  await openWorkshopTool(page, "Equipment");

  await expect(page.getByRole("tab", { name: "Equipment" })).toHaveAttribute("aria-selected", "true");
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
