import { mkdirSync } from "node:fs";
import { expect } from "@playwright/test";
import { test } from "../readiness/workshop.fixture";
import { enableWorkshopFreeDrag, openWorkshopMenu, openWorkshopTool } from "./workshop-menu.helpers";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });

test("workspace protects the canvas and completes desktop, mobile and fullscreen editing", async ({ page, workshop }) => {
  test.setTimeout(180_000);
  expect(workshop.draftId).toBeTruthy();
  const folder = ".local-artifacts/workshop-implementation/layout";
  mkdirSync(folder, { recursive: true });
  const toolbar = page.getByRole("toolbar", { name: "Movement tools", exact: true });
  const preview = page.locator("[data-workshop-figure-preview]");
  for (const fullscreen of [false, true]) {
    for (const [width, height] of [[1280, 720], [800, 900], [390, 844]] as const) {
      await page.setViewportSize({ width, height });
      if (fullscreen) {
        await openWorkshopMenu(page);
        await page.getByRole("button", { name: "Full screen", exact: true }).click();
        await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
        await page.locator("[data-workshop-menu] > summary").click();
      }
      for (const mode of ["Select", "Move", "Rotate", "Move with mouse", "Pose hands and feet", "Camera"]) {
        if (mode === "Move with mouse") await enableWorkshopFreeDrag(page);
        else await toolbar.getByRole("button", { name: mode, exact: true }).click();
        await expect(toolbar.getByRole("button", { name: mode, exact: true, includeHidden: true })).toHaveAttribute("aria-pressed", "true");
        if (mode === "Pose hands and feet") {
          // Phones carry the instruction in the canvas chip instead of a line above the canvas.
          if (width >= 640) {
            const guidance = preview.getByText(/^Select a hand or foot, then use arrows/);
            await expect(guidance).toBeVisible();
            await expect(guidance).toContainText("Direction locks movement");
          } else await expect(preview.getByText("Select a hand or foot", { exact: true })).toBeVisible();
          await expect(page.getByRole("button", { name: /^Select (Left|Right) (hand|foot)$/ })).toHaveCount(4);
          await expect(page.getByRole("button", { name: /^Drag (Left|Right) (hand|foot)$/ })).toHaveCount(0);
          // Let the canvas resize observer settle before measuring the final layout.
          await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
          await expect.poll(async () => (await page.locator("canvas").boundingBox())!.height,
            { message: `${width}×${height} useful canvas height` }).toBeGreaterThanOrEqual(width < 768 ? 220 : 300);
          await page.screenshot({ path: `${folder}/${fullscreen ? "fullscreen" : "window"}-${width}.png` });
        }
        if (mode === "Camera") await expect(preview.getByText("Drag to look around. Choose Select to edit the scene.", { exact: true })).toBeVisible();
      }
      if (width < 768) {
        // Phones keep the preview pinned above the controls while editing.
        await openWorkshopTool(page, "Pose");
        await expect(page.getByLabel("Body joint", { exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Save exercise", exact: true })).toBeInViewport();
        await expect(page.getByRole("button", { name: "Play", exact: true })).toBeInViewport();
        await expect(page.locator("canvas")).toBeInViewport();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      if (fullscreen) await page.evaluate(() => document.exitFullscreen());
    }
  }
});
