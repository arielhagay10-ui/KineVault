import type { Locator, Page } from "@playwright/test";

// CI never uploads evidence captures, so it only waits for the frame that local reviews capture.
export async function captureEvidence(target: Page | Locator, path: string) {
  const page = "page" in target ? target.page() : target;
  await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
  if (!process.env.CI) await target.screenshot({ path });
}
