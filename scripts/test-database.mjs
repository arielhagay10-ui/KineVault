import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { parseLoadOptions } from "./lib/catalog-load-metrics.mjs";
import { runCatalogLoad } from "./lib/catalog-load.mjs";
import { parseHttpLoadOptions } from "./lib/catalog-http-load-metrics.mjs";
import { runCatalogHttpLoad } from "./lib/catalog-http-load.mjs";

// Test a fresh seed in a separate local database, leaving development records intact.
const container = "supabase_db_kinevault";
const http = process.argv.includes("--http");
const loadOptions = http ? parseHttpLoadOptions(process.argv.slice(2))
  : process.argv.includes("--load") ? parseLoadOptions(process.argv.slice(2)) : null;
const deadline = loadOptions ? Date.now() + loadOptions.timeoutSeconds * 1000 : null;
const databasePort = Number(readFileSync("supabase/config.toml", "utf8").match(/\[db\][\s\S]*?\nport\s*=\s*(\d+)/)?.[1]);
if (!Number.isInteger(databasePort) || databasePort < 1 || databasePort > 65535) throw new Error("Invalid configured database port");
const suffix = randomUUID().replaceAll("-", "");
const database = `kinevault_checks_${suffix}`;
const docker = (args, options = {}) => execFileSync("docker", args, { maxBuffer: 32 * 1024 * 1024,
  ...(deadline ? { timeout: Math.max(1, Math.min(deadline - Date.now(), 120000)) } : {}), ...options });
const sql = (input, user = "supabase_admin") => docker(["exec", "-i", container, "psql", "-U", user, "-d", database, "-v", "ON_ERROR_STOP=1", "-q"], { input });
let created = false;
try {
  const schema = docker(["exec", container, "pg_dump", "-U", "postgres", "-d", "postgres", "--schema-only", "--exclude-schema=pg_net"]);
  const buckets = docker(["exec", container, "pg_dump", "-U", "postgres", "-d", "postgres", "--data-only", "--table=storage.buckets"]);
  // A timed-out docker client can still leave createdb running in the container.
  created = true;
  docker(["exec", container, "createdb", "-U", "postgres", database]);
  sql(schema);
  if (process.argv.includes("--migrations")) {
    // The UUID-named database was created above exclusively for this check.
    sql("set client_min_messages = warning; drop schema public cascade; drop schema private cascade; create schema public authorization postgres; grant all on schema public to supabase_admin; grant usage on schema public to anon,authenticated,service_role;");
    for (const file of readdirSync("supabase/migrations").filter((file) => file.endsWith(".sql")).sort()) {
      sql(readFileSync(`supabase/migrations/${file}`), "postgres");
    }
    process.stdout.write("All migrations applied to an empty application schema.\n");
  }
  if (!process.argv.includes("--migrations")) sql(buckets);
  sql(readFileSync("supabase/seed.sql"));
  if (loadOptions) {
    if (http) await runCatalogHttpLoad({ container, database, options: loadOptions, deadline });
    else runCatalogLoad({ container, database, options: loadOptions, deadline });
  } else if (process.argv.includes("--benchmark")) {
    const result = spawnSync("docker", ["exec", "-i", container, "psql", "-U", "supabase_admin", "-d", database,
      "-v", "ON_ERROR_STOP=1", "-q", "-A", "-t"], { input: readFileSync("tests/performance/catalog.sql"), maxBuffer: 32 * 1024 * 1024 });
    writeFileSync("PERFORMANCE_RESULTS.txt", result.stdout ?? "");
    writeFileSync("PERFORMANCE_PLANS.txt", result.stderr ?? "");
    if (result.error || result.status !== 0) throw new Error("Benchmark failed; inspect PERFORMANCE_PLANS.txt");
    process.stdout.write("50,000-record plans saved to PERFORMANCE_RESULTS.txt\n");
  } else {
    execFileSync(process.execPath, ["node_modules/supabase/dist/supabase.js", "test", "db", "--db-url",
      `postgresql://postgres:postgres@127.0.0.1:${databasePort}/${database}`], { stdio: "inherit" });
  }
} finally {
  if (created && /^kinevault_checks_[a-f0-9]{32}$/.test(database)) {
    // Force-close test clients, including ones left behind by a process deadline.
    docker(["exec", container, "dropdb", "--if-exists", "--force", "-U", "postgres", database], { timeout: 30000 });
  }
}
