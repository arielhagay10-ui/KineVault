import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const productionServer = process.env.KINEVAULT_E2E_PRODUCTION === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  // The CI workflow checks this development-only regression separately.
  testIgnore: productionServer ? "**/workshop-preview-regression.spec.ts" : undefined,
  timeout: 30_000,
  // Software-rendered workshop canvases need the runner's full CPU budget.
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: "http://127.0.0.1:3000",
    navigationTimeout: 60_000,
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    ...(process.platform === "win32" ? { channel: "chrome" } : {}),
  },
  webServer: {
    command: productionServer ? "npm run start" : "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI && !productionServer,
    timeout: 60_000,
  },
});
