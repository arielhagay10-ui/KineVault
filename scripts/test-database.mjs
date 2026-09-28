import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";

// Test a fresh seed in a separate local database, leaving development records intact.
const container = "supabase_db_kinevault";
const suffix = randomUUID().replaceAll("-", "");
const database = `kinevault_checks_${suffix}`;
const docker = (args, options = {}) => execFileSync("docker", args, { maxBuffer: 32 * 1024 * 1024, ...options });
const sql = (input, user = "supabase_admin") => docker(["exec", "-i", container, "psql", "-U", user, "-d", database, "-v", "ON_ERROR_STOP=1", "-q"], { input });
let created = false;
try {
  const schema = docker(["exec", container, "pg_dump", "-U", "postgres", "-d", "postgres", "--schema-only", "--exclude-schema=pg_net"]);
  const buckets = docker(["exec", container, "pg_dump", "-U", "postgres", "-d", "postgres", "--data-only", "--table=storage.buckets"]);
  docker(["exec", container, "createdb", "-U", "postgres", database]);
  created = true;
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
  if (process.argv.includes("--benchmark")) {
    const result = spawnSync("docker", ["exec", "-i", container, "psql", "-U", "supabase_admin", "-d", database,
      "-v", "ON_ERROR_STOP=1", "-q", "-A", "-t"], { input: readFileSync("tests/performance/catalog.sql"), maxBuffer: 32 * 1024 * 1024 });
    writeFileSync("PERFORMANCE_RESULTS.txt", result.stdout ?? "");
    writeFileSync("PERFORMANCE_PLANS.txt", result.stderr ?? "");
    if (result.error || result.status !== 0) throw new Error("Benchmark failed; inspect PERFORMANCE_PLANS.txt");
    process.stdout.write("50,000-record plans saved to PERFORMANCE_RESULTS.txt\n");
  } else {
    execFileSync(process.execPath, ["node_modules/supabase/dist/supabase.js", "test", "db", "--db-url",
      `postgresql://postgres:postgres@127.0.0.1:54322/${database}`], { stdio: "inherit" });
  }
} finally {
  if (created && /^kinevault_checks_[a-f0-9]{32}$/.test(database)) {
    docker(["exec", container, "dropdb", "-U", "postgres", database]);
  }
}
