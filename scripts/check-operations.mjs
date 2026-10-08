import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve, join } from "node:path";
import { localOrigin, evaluateQueues, queueSnapshotSql } from "./lib/operations-validation.mjs";

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("Usage: node scripts/check-operations.mjs [--target http://127.0.0.1:3000] [--max-age-seconds 900]\nRead-only local queue aggregates and optional liveness. Reports cannot certify alert receipt or inbox delivery.");
  process.exit(0);
}
const report = { version: 1, checkedAt: new Date().toISOString(), scope: "local", passed: false };
try {
  if (args.some((arg, index) => index % 2 === 0 && !["--target", "--max-age-seconds"].includes(arg)) || args.length % 2) throw new Error("Invalid arguments");
  const maxAge = args.includes("--max-age-seconds") ? Number(args[args.indexOf("--max-age-seconds") + 1]) : 900;
  const target = args.includes("--target") ? localOrigin(args[args.indexOf("--target") + 1]) : null;
  const result = execFileSync("docker", ["exec", "-i", "supabase_db_kinevault", "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"], {
    input: queueSnapshotSql, encoding: "utf8", timeout: 10000, maxBuffer: 1024 * 1024, stdio: ["pipe", "pipe", "pipe"],
  });
  report.queues = evaluateQueues(JSON.parse(result.trim()), maxAge);
  report.health = { status: "pending", detail: "Supply --target for a local liveness check." };
  if (target) {
    try {
      const response = await fetch(`${target}/api/health`, { redirect: "error", signal: AbortSignal.timeout(10000) });
      const healthy = response.ok && response.headers.get("content-type")?.includes("application/json") && (await response.json()).status === "ok";
      report.health = { status: healthy ? "passed" : "failed", detail: "HTTP liveness only; queue aggregates are checked separately." };
    } catch {
      report.health = { status: "failed", detail: "Local liveness request failed, redirected or timed out." };
    }
  }
  report.passed = report.queues.passed && report.health.status === "passed";
} catch {
  report.error = "Local checks failed. Verify arguments, Docker, schema and app availability. Sensitive errors omitted.";
}
const directory = resolve(".local-artifacts", "operations", randomUUID());
mkdirSync(directory, { recursive: true });
writeFileSync(join(directory, "health.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ ...report, artifact: join(directory, "health.json") }, null, 2));
process.exitCode = report.passed ? 0 : 1;
