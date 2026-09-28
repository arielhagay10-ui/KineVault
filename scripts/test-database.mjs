import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

// Test a fresh seed in a separate local database, leaving development records intact.
const container = "supabase_db_kinevault";
const suffix = randomUUID().replaceAll("-", "");
const database = `kinevault_checks_${suffix}`;
const docker = (args, options = {}) => execFileSync("docker", args, { maxBuffer: 32 * 1024 * 1024, ...options });
const sql = (input) => docker(["exec", "-i", container, "psql", "-U", "supabase_admin", "-d", database, "-v", "ON_ERROR_STOP=1", "-q"], { input });
let created = false;
try {
  const schema = docker(["exec", container, "pg_dump", "-U", "postgres", "-d", "postgres", "--schema-only", "--exclude-schema=pg_net"]);
  const buckets = docker(["exec", container, "pg_dump", "-U", "postgres", "-d", "postgres", "--data-only", "--table=storage.buckets"]);
  docker(["exec", container, "createdb", "-U", "postgres", database]);
  created = true;
  sql(schema);
  sql(buckets);
  sql(readFileSync("supabase/seed.sql"));
  execFileSync(process.execPath, ["node_modules/supabase/dist/supabase.js", "test", "db", "--db-url",
    `postgresql://postgres:postgres@127.0.0.1:54322/${database}`], { stdio: "inherit" });
} finally {
  if (created && /^kinevault_checks_[a-f0-9]{32}$/.test(database)) {
    docker(["exec", container, "dropdb", "-U", "postgres", database]);
  }
}
