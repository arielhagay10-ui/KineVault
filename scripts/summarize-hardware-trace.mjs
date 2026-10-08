import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { summarizeHardwareTrace } from "./lib/hardware-trace.mjs";

const files = process.argv.slice(2);
if (!files.length) throw new Error("Supply Chrome trace JSON files");
for (const file of files) {
  const summary = summarizeHardwareTrace(JSON.parse(readFileSync(file, "utf8")));
  const output = resolve(dirname(file), "trace-summary.json");
  writeFileSync(output, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ file, summary: output,
    relevantEvents: summary.events.filter(event => /EventDispatch|FunctionCall|FireAnimationFrame|DrawFrame|GPUTask|RunTask|DoCommands/i.test(event.name)).slice(0, 20),
    cpuSelfTime: summary.cpuSelfTime.slice(0, 12), note: summary.note }, null, 2));
}
