import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import { hardwareProfileOptions } from "./scripts/lib/hardware-profile.mjs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const hardware = hardwareProfileOptions(process.env);

export default defineConfig({
  testDir: "./tests/hardware",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 300_000,
  expect: { timeout: 15_000 },
  outputDir: ".local-artifacts/readiness/hardware-results",
  reporter: "list",
  use: {
    baseURL: hardware.baseURL,
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    channel: "chrome",
    launchOptions: { args: hardware.launchArgs },
    trace: "off",
    screenshot: "off",
    video: "off",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
});
