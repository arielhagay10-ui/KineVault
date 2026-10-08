import { expect, test as publicTest } from "@playwright/test";
import { openWorkshopTool } from "../e2e/workshop-menu.helpers";
import { auditAccessibility, setAppearance } from "./accessibility.helpers";
import { test } from "./workshop.fixture";

for (const appearance of ["light", "dark"] as const) {
  publicTest(`public content reflows at 320 CSS pixels in ${appearance}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/");
    await setAppearance(page, appearance);
    for (const path of ["/", "/exercises?jointAction=shoulder-abduction&equipment=cable", "/sign-in", "/sign-up", "/reset-password"]) {
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), `${path} horizontal overflow`).toBeTruthy();
      await auditAccessibility(page, testInfo, `${appearance}-320px-${path.split("?")[0]}`);
    }
    await page.goto("/exercises?jointAction=shoulder-abduction&equipment=cable");
    await page.getByRole("main").locator('a[href^="/exercises/"]').first().click();
    await expect(page).toHaveURL(/\/exercises\/[^/?]+$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBeTruthy();
    await auditAccessibility(page, testInfo, `${appearance}-320px-detail`);
  });
}

test("workshop controls remain named and operable in narrow reflow", async ({ page, workshop }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(`/my-exercises/${workshop.draftId}/workshop`);
  await expect(page.getByRole("region", { name: "Workshop editor", exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Editor mode", exact: true })).toBeVisible();
  const advanced = page.getByRole("button", { name: "Advanced editing", exact: true });
  await advanced.focus();
  await advanced.press("Enter");
  await expect(advanced).toHaveAttribute("aria-pressed", "true");
  await openWorkshopTool(page, "Equipment");
  await expect(page.getByRole("group", { name: "Scene objects", exact: true })).toBeVisible();
  const controls = [page.getByRole("button", { name: "Play", exact: true }),
    page.getByRole("combobox", { name: "Preview speed", exact: true }),
    page.getByRole("button", { name: "View start", exact: true }),
    page.getByRole("button", { name: "View finish", exact: true }),
    page.getByRole("combobox", { name: "Editing pose", exact: true })];
  for (const control of controls) {
    await control.focus();
    await control.scrollIntoViewIfNeeded();
    await expect(control).toBeFocused();
    await expect.poll(() => control.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return rect.width >= 24 && rect.height >= 24 && rect.x >= 0 && rect.right <= innerWidth + 1
        && rect.y >= 0 && rect.bottom <= innerHeight + 1 && !!hit && (hit === element || element.contains(hit));
    }), { message: "Focused playback control must have an unobscured 24px target" }).toBeTruthy();
  }
  await testInfo.attach("workshop-reading-order", { body: await page.getByRole("region", { name: "Workshop editor", exact: true }).ariaSnapshot(), contentType: "text/plain" });
});
