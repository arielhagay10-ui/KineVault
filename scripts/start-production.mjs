import { spawn } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const root = resolve(".next/standalone");
if (!existsSync(resolve(root, "server.js"))) throw new Error("Run npm run build before starting the optimized app.");
cpSync(".next/static", resolve(root, ".next/static"), { recursive: true });
if (existsSync("public")) cpSync("public", resolve(root, "public"), { recursive: true });
const child = spawn(process.execPath, [resolve(root, "server.js")], {
  stdio: "inherit", windowsHide: true,
  env: { ...process.env, HOSTNAME: "127.0.0.1", PORT: "3000", NODE_ENV: "production" },
});
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 0; });
