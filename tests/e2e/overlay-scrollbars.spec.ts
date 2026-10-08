import { expect, test, type Page } from "@playwright/test";

async function prepareFixture(page: Page) {
  await page.goto("/sign-in");
  await expect(page.locator(".os-scrollbar").first()).toBeAttached();
  await page.evaluate(() => {
    const container = document.createElement("section");
    container.id = "scrollbar-click-fixture";
    container.style.cssText = "position:fixed;top:40px;left:40px;width:240px;height:100px;overflow:visible;z-index:9999;background:white";
    const button = document.createElement("button");
    button.textContent = "Scroll fixture clicks: 0";
    button.style.cssText = "width:220px;height:44px";
    button.addEventListener("pointerdown", event => { container.dataset.pointerId = String(event.pointerId); });
    button.addEventListener("click", () => { button.textContent = "Scroll fixture clicks: 1"; });
    container.append(button);
    document.body.append(container);
  });
  const button = page.getByRole("button", { name: "Scroll fixture clicks: 0", exact: true });
  await button.hover();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  return button;
}

async function queueSetup(page: Page) {
  await page.evaluate(async () => {
    const container = document.getElementById("scrollbar-click-fixture")!;
    container.style.overflow = "auto";
    container.dispatchEvent(new Event("scroll"));
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

test("scrollbar setup preserves a click during an active pointer gesture", async ({ page }) => {
  await prepareFixture(page);
  await page.mouse.down();
  try {
    await queueSetup(page);
    await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  } finally { await page.mouse.up(); }
  await expect(page.getByRole("button", { name: "Scroll fixture clicks: 1", exact: true })).toBeVisible();
  await expect(page.locator("#scrollbar-click-fixture")).toHaveAttribute("data-overlayscrollbars", "");
});

for (const ending of ["pointer cancellation", "window blur"] as const) {
  test(`scrollbar setup resumes after ${ending}`, async ({ page }) => {
    const button = await prepareFixture(page);
    await page.mouse.down();
    try {
      await queueSetup(page);
      await page.evaluate(kind => {
        const container = document.getElementById("scrollbar-click-fixture")!;
        if (kind === "window blur") window.dispatchEvent(new Event("blur"));
        else container.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: Number(container.dataset.pointerId) }));
      }, ending);
      await expect(page.locator("#scrollbar-click-fixture")).toHaveAttribute("data-overlayscrollbars", "");
    } finally { await page.mouse.up(); }
    await button.click();
    await expect(page.getByRole("button", { name: "Scroll fixture clicks: 1", exact: true })).toBeVisible();
  });
}
