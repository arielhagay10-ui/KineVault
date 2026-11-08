import type { Locator, Page } from "@playwright/test";

// Pull requests run representative variants; the nightly workflow sets KINEVAULT_FULL_SUITE=1, and local runs keep every variant.
export const fullSuite = !process.env.CI || process.env.KINEVAULT_FULL_SUITE === "1";
export const nightlyOnly = "Runs nightly with KINEVAULT_FULL_SUITE=1";

// CI never uploads evidence captures, so it only waits for the frame that local reviews capture.
export async function captureEvidence(target: Page | Locator, path: string) {
  const page = "page" in target ? target.page() : target;
  await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
  if (!process.env.CI) await target.screenshot({ path });
}
