import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  // Software-rendered workshop canvases need the runner's full CPU budget.
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: "http://127.0.0.1:3000",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    ...(process.platform === "win32" ? { channel: "chrome" } : {}),
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
