import { parseArgs } from "node:util";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { checkDeployment } from "./lib/deployment-readiness.mjs";

try {
  const { values } = parseArgs({ options: {
    target: { type: "string" }, evidence: { type: "string" }, online: { type: "boolean", default: false },
    json: { type: "boolean", default: false }, help: { type: "boolean", default: false },
  }, strict: true });
  if (values.help) {
    console.log("Usage: node [--env-file=FILE] scripts/check-deployment.mjs --target https://your-site [--evidence FILE] [--online] [--json]\nOffline by default. --online makes only public GET requests. Exit 0 requires every check, including operator evidence, to pass.\nSee docs/deployment-readiness.md.");
  } else {
    const directory = resolve("supabase/migrations");
    const names = (await readdir(directory)).filter(name => name.endsWith(".sql"));
    const migrations = await Promise.all(names.map(async name => ({ name, sql: await readFile(resolve(directory, name), "utf8") })));
    const evidence = values.evidence ? JSON.parse(await readFile(resolve(values.evidence), "utf8")) : undefined;
    const report = await checkDeployment({ env: process.env, target: values.target, migrations, evidence, online: values.online });
    if (values.json) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(report.passed ? "Deployment preflight passed. Operator evidence remains an attestation." : "Deployment preflight incomplete or failed.");
      if (report.migrationManifest) console.log(`Migration digest: ${report.migrationManifest.digest}`);
      for (const check of report.checks) console.log(`${check.status.toUpperCase()} ${check.id} [${check.source}]: ${check.detail}`);
    }
    process.exitCode = report.passed ? 0 : 1;
  }
} catch {
  // Errors can contain URLs, env file values or evidence contents. Keep output safe.
  console.error("Deployment preflight could not read its inputs. Check flags, env/evidence file access and JSON syntax. Use --help.");
  process.exitCode = 1;
}
