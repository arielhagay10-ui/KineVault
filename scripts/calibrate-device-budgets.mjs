import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { calibrateDeviceCaptures, checkDeviceBudget } from "../src/lib/motion/device-profile.ts";

const args = process.argv.slice(2);
const budgetArgs = args.filter(arg => arg.startsWith("--budget="));
if (budgetArgs.length > 1 || args.some(arg => arg.startsWith("--") && !arg.startsWith("--budget="))) throw new Error("Only one --budget=path option is supported.");
const files = args.filter(arg => !arg.startsWith("--"));
if (files.length < 3) throw new Error("Supply at least three downloaded device profile JSON files from the same device/scenario.");
const captures = files.map(file => JSON.parse(readFileSync(file, "utf8")));
const budget = calibrateDeviceCaptures(captures);
mkdirSync(".local-artifacts/readiness", { recursive: true });
const output = ".local-artifacts/readiness/device-budget-proposal.json";
writeFileSync(output, JSON.stringify({ ...budget, sources: files }, null, 2));
console.log(`Proposed p95 rendered-frame budget: ${budget.p95Ms} ms. Review ${output}. LOD investigation: ${budget.needsLodEvaluation}.`);
if (budgetArgs.length) {
  const budgetFile = budgetArgs[0].slice("--budget=".length);
  const result = checkDeviceBudget(captures, JSON.parse(readFileSync(budgetFile, "utf8")));
  writeFileSync(".local-artifacts/readiness/device-budget-check.json", JSON.stringify({ ...result, budgetFile, sources: files }, null, 2));
  console.log(`Hardware budget: ${result.passed ? "PASS" : "FAIL"}; observed p95 ${result.observedP95Ms} ms, limit ${result.budgetP95Ms} ms.`);
  if (!result.passed) process.exitCode = 1;
}
