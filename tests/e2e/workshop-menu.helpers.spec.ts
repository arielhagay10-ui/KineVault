import { expect, test } from "@playwright/test";
import { expandWorkshopControls, openWorkshopTool, setWorkshopLanguage } from "./workshop-menu.helpers";

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

test("language selection waits for the editor to accept keyboard input", async ({ page }) => {
  await page.setContent(`<section data-workshop="studio" lang="en"><details data-workshop-menu><summary>More</summary>
    <select aria-label="Workshop language" onchange="this.closest('[data-workshop]').lang=this.value"><option value="en">English</option><option value="he">עברית</option></select>
  </details><div inert><aside data-workshop-controls-scroll><button role="tab">Equipment</button></aside></div></section>`);
  await page.locator("[data-workshop-menu] > summary").click();
  await page.evaluate(() => {
    document.querySelector("details")!.addEventListener("toggle", event => {
      if (!(event.target as HTMLDetailsElement).open) setTimeout(() => document.querySelector("[inert]")?.removeAttribute("inert"), 150);
    });
  });

  await setWorkshopLanguage(page, "he");

  expect(await page.locator("[data-workshop-controls-scroll]").evaluate(element => element.closest("[inert]") === null)).toBe(true);
  await page.getByRole("tab", { name: "Equipment" }).focus();
  await expect(page.getByRole("tab", { name: "Equipment" })).toBeFocused();
});
