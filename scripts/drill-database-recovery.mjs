import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve, join } from "node:path";
import { isolatedNames, verifyBytes } from "./lib/operations-validation.mjs";
import { migrationManifest } from "./lib/deployment-readiness.mjs";

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/drill-database-recovery.mjs [--baseline-version VERSION]\nCreates two UUID-named local databases, backs up synthetic prior-schema data, restores and upgrades it. Never restores into postgres. Defaults to all but the last migration.");
  process.exit(0);
}
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--baseline-version" || !/^(?:\d{12}|\d{14})$/.test(args[1]))) throw new Error("Invalid recovery arguments");
const container = "supabase_db_kinevault";
const names = isolatedNames(randomUUID());
const directory = resolve(".local-artifacts", "operations", names.suffix);
mkdirSync(directory, { recursive: true });
const deadline = Date.now() + 600000;
const report = { version: 1, scope: "local synthetic prior release", startedAt: new Date().toISOString(), passed: false, cleanupPassed: false };
const created = new Set();
let stage = "configuration";
const docker = (args, options = {}) => execFileSync("docker", args, {
  timeout: Math.max(1, Math.min(120000, deadline - Date.now())), maxBuffer: 64 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"], ...options,
});
const sql = (database, input, user = "postgres") => {
  if (![names.source, names.restore].includes(database)) throw new Error("Recovery requires its own database");
  return docker(["exec", "-i", container, "psql", "-X", "-U", user, "-d", database, "-v", "ON_ERROR_STOP=1", "-qAt"], { input, encoding: "utf8" }).trim();
};
const tableNames = ["exercise_content", "exercise_scenes", "private_exercises", "exercise_submissions", "moderation_events", "notifications", "notification_deliveries"];
const fingerprintSql = `select json_build_object(${tableNames.map(table => `'${table}',(select json_build_object('count',count(*),'digest',md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]'))) from public.${table} t)`).join(",")});`;
try {
  const migrations = readdirSync("supabase/migrations").filter(name => name.endsWith(".sql")).sort()
    .map(name => ({ name, sql: readFileSync(join("supabase/migrations", name), "utf8") }));
  const manifest = migrationManifest(migrations);
  const baselineIndex = args.length ? manifest.versions.indexOf(args[1]) : migrations.length - 2;
  if (baselineIndex < 0 || baselineIndex >= migrations.length - 1) throw new Error("Baseline must precede current release");
  report.baselineVersion = manifest.versions[baselineIndex];
  report.migrationManifest = manifest;
  report.pendingVersions = manifest.versions.slice(baselineIndex + 1);
  stage = "read platform schema";
  // Read only the platform schema from development. Never copy development rows.
  const platform = docker(["exec", container, "pg_dump", "-U", "postgres", "-d", "postgres", "--schema-only", "--exclude-schema=pg_net"]);
  created.add(names.source);
  stage = "create isolated source";
  docker(["exec", container, "createdb", "-U", "postgres", names.source]);
  stage = "restore platform schema";
  sql(names.source, platform, "supabase_admin");
  stage = "reset isolated application schema";
  sql(names.source, "set client_min_messages=warning; drop schema public cascade; drop schema private cascade; create schema public authorization postgres; grant all on schema public to supabase_admin; grant usage on schema public to anon,authenticated,service_role;");
  for (const migration of migrations.slice(0, baselineIndex + 1)) { stage = `replay ${migration.name}`; sql(names.source, migration.sql); }
  stage = "seed synthetic taxonomy";
  sql(names.source, readFileSync("supabase/seed.sql"));
  const owner = randomUUID(); const reviewer = randomUUID();
  stage = "persist synthetic recovery records";
  sql(names.source, `begin;
    insert into auth.users(id,email,aud,role) values
      ('${owner}','recovery-owner@example.test','authenticated','authenticated'),
      ('${reviewer}','recovery-reviewer@example.test','authenticated','authenticated');
    update public.roles set role='reviewer' where user_id='${reviewer}';
    set local role authenticated;
    select set_config('request.jwt.claim.sub','${owner}',true);
    select public.save_private_exercise(p_name=>'Recovery untouched draft',p_family_slug=>'lateral-raise',p_primary_muscle_slugs=>array['lateral-deltoid'],p_joint_action_slugs=>array['shoulder-abduction']);
    select set_config('test.private_id',public.save_private_exercise(p_name=>'Recovery submission',p_family_slug=>'lateral-raise',p_primary_muscle_slugs=>array['lateral-deltoid'],p_joint_action_slugs=>array['shoulder-abduction'])::text,true);
    select public.save_private_scene(current_setting('test.private_id')::uuid,'{"durationMs":1000,"cameraAngle":"front","equipment":null,"keyframes":[{"timeMs":0,"poses":{"left-shoulder":{"z":0}}},{"timeMs":1000,"poses":{"left-shoulder":{"z":-70}}}]}'::jsonb);
    select set_config('test.submission_id',public.submit_private_exercise(current_setting('test.private_id')::uuid,'new')::text,true);
    select set_config('request.jwt.claim.sub','${reviewer}',true);
    select public.begin_submission_review(current_setting('test.submission_id')::uuid);
    select public.request_submission_changes(current_setting('test.submission_id')::uuid,'poor_media','Recovery fixture requires no email.');
    commit;`);
  const before = JSON.parse(sql(names.source, fingerprintSql));
  if (!before.private_exercises.count || !before.exercise_submissions.count || !before.moderation_events.count || !before.notifications.count) throw new Error("Recovery fixture incomplete");
  const backupAt = Date.now();
  stage = "backup synthetic database";
  const dump = docker(["exec", container, "pg_dump", "-U", "postgres", "-d", names.source, "--format=custom", "--exclude-schema=pg_net"]);
  const backupFile = join(directory, "synthetic-database.dump");
  writeFileSync(backupFile, dump);
  report.backup = { ...verifyBytes(dump, readFileSync(backupFile)), completedAt: new Date().toISOString() };
  const restoreStarted = Date.now();
  created.add(names.restore);
  stage = "create isolated restore";
  docker(["exec", container, "createdb", "-U", "postgres", names.restore]);
  stage = "restore synthetic backup";
  docker(["exec", "-i", container, "pg_restore", "-U", "supabase_admin", "-d", names.restore, "--exit-on-error"], { input: readFileSync(backupFile) });
  if (JSON.stringify(before) !== JSON.stringify(JSON.parse(sql(names.restore, fingerprintSql)))) throw new Error("Restored records differ");
  for (const migration of migrations.slice(baselineIndex + 1)) { stage = `upgrade ${migration.name}`; sql(names.restore, migration.sql); }
  if (JSON.stringify(before) !== JSON.stringify(JSON.parse(sql(names.restore, fingerprintSql)))) throw new Error("Upgrade changed fixture records");
  report.records = before;
  stage = "verify restored ownership";
  const authorization = user => Number(sql(names.restore, `begin; set local role authenticated; select set_config('request.jwt.claim.sub','${user}',true) is not null; select count(*) from public.private_exercises where owner_id='${owner}'; rollback;`).split("\n").at(-1));
  if (authorization(owner) !== before.private_exercises.count || authorization(reviewer) !== 0) throw new Error("Restored ownership differs");
  report.ownershipPassed = true;
  report.workerDatabaseChecks = [];
  for (const name of ["notifications.sql", "render_claims.sql", "submissions.sql", "integrity.sql"]) {
    stage = `assert ${name}`;
    // Existing restored jobs must not be consumed by each test's worker claim.
    // This postponement is inside the test transaction and rolls back with it.
    const testSql = readFileSync(join("supabase/tests", name), "utf8").replace(/^begin;/, `begin;
      update public.notification_deliveries set next_attempt_at=now()+interval '1 day' where status='queued';
      update public.render_jobs set queued_at=now()+interval '1 day' where status='queued';
      update public.render_jobs set started_at=now()+interval '1 day' where status='running';`);
    const output = sql(names.restore, testSql);
    const planned = Number(output.match(/^1\.\.(\d+)$/m)?.[1]);
    const passed = output.match(/^ok\s+\d+\b/gm)?.length ?? 0;
    if (!planned || passed !== planned || /^not ok\b/m.test(output)) throw new Error("Restored database assertions failed");
    report.workerDatabaseChecks.push({ file: name, assertions: passed });
  }
  report.backupAgeAtRestoreSeconds = (restoreStarted - backupAt) / 1000;
  report.syntheticDataLossSeconds = 0;
  report.rtoSeconds = (Date.now() - restoreStarted) / 1000;
  report.passed = true;
} catch {
  report.failedStage = stage;
  report.error = "Isolated recovery failed. Check platform availability, baseline compatibility and fixture assertions. Sensitive command output omitted.";
} finally {
  let clean = true;
  for (const database of created) {
    if (![names.source, names.restore].includes(database) || !/^kinevault_recovery_(?:source|restore)_[a-f0-9]{32}$/.test(database)) { clean = false; continue; }
    try {
      execFileSync("docker", ["exec", container, "dropdb", "--if-exists", "--force", "-U", "postgres", database], { timeout: 30000, stdio: "pipe" });
    } catch { clean = false; }
  }
  report.cleanupPassed = clean;
  report.passed = report.passed && clean;
  report.completedAt = new Date().toISOString();
  writeFileSync(join(directory, "database-recovery.json"), JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify({ ...report, artifact: join(directory, "database-recovery.json") }, null, 2));
process.exitCode = report.passed ? 0 : 1;
