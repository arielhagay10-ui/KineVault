import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// Keep Chrome-specific launch options out of Firefox and WebKit.
const chromium = { launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } };

export default defineConfig({
  testDir: "./tests/readiness",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  outputDir: ".local-artifacts/readiness/results",
  reporter: [
    ["list"],
    ["html", { outputFolder: ".local-artifacts/readiness/report", open: "never" }],
    ["json", { outputFile: ".local-artifacts/readiness/results.json" }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    // Network traces can contain short-lived signed media URLs and auth payloads.
    trace: process.env.CI ? "off" : "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], ...chromium } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "android-touch", use: { ...devices["Pixel 7"], ...chromium } },
    { name: "iphone-touch", use: { ...devices["iPhone 13"] } },
  ],
});
