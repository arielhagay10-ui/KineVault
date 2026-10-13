import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { configuration, WorkshopBrowser } from "./browser.js";

const config = configuration();
if (!config.auth) throw new Error("Set KV_WORKSHOP_AUTH to a file path, or unset it to use the default auth file.");
const browser = new WorkshopBrowser({ ...config, headless: false });
process.once("SIGINT", () => void browser.close());
process.once("SIGTERM", () => void browser.close());
try {
  const page = await browser.page();
  console.error("Sign in with a test account in the browser. Authentication will be saved once the workshop opens. Keep auth.json private.");
  await page.goto(`${config.origin}/my-exercises/new`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-workshop="studio"]').waitFor({ state: "visible", timeout: 300_000 });
  browser.assertOrigin(page.url());
  await mkdir(dirname(config.auth), { recursive: true });
  const state = await page.context().storageState();
  await writeFile(config.auth, JSON.stringify(state), { mode: 0o600 });
  await chmod(config.auth, 0o600);
  console.error(`Login saved to ${config.auth}. Restart agent MCP sessions to use it.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Login failed.");
  process.exitCode = 1;
} finally {
  await browser.close();
}
