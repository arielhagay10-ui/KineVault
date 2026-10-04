import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
export default defineConfig({
  testDir: "./tests/performance", testMatch: "*.spec.ts", workers: 1, timeout: 120_000,
  use: { baseURL: "http://127.0.0.1:3000", viewport: { width: 1440, height: 1000 },
    ...(process.platform === "win32" ? { channel: "chrome" } : {}),
    launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] },
  },
});
