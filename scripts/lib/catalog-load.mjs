import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { summarizeLoad } from "./catalog-load-metrics.mjs";

const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const rpc = args => `select * from public.explore_exercises(${args});`;

export function runCatalogLoad({ container, database, options, deadline }) {
  if (!/^kinevault_checks_[a-f0-9]{32}$/.test(database)) throw new Error("Load test requires an isolated database");
  const suffix = database.slice("kinevault_checks_".length);
  const remote = `/tmp/kinevault_catalog_load_${suffix}`;
  const directory = resolve(".local-artifacts", "catalog-load", suffix);
  const staging = join(directory, "input");
  mkdirSync(staging, { recursive: true });
  const remaining = () => {
    const ms = deadline - Date.now();
    if (ms <= 0) throw new Error("Catalog load test exceeded its total deadline");
    return Math.max(1, Math.min(ms, 120000));
  };
  const docker = args => execFileSync("docker", args, { encoding: "utf8", timeout: remaining(), maxBuffer: 32 * 1024 * 1024 });
  const sql = input => execFileSync("docker", ["exec", "-i", container, "psql", "-X", "-U", "supabase_admin",
    "-d", database, "-v", "ON_ERROR_STOP=1", "-qAt"], {
    input, encoding: "utf8", timeout: remaining(), maxBuffer: 32 * 1024 * 1024,
  }).trim();
  const report = {
    schemaVersion: 1, startedAt: new Date().toISOString(), database, options,
    metric: "pgbench transaction latency over persistent local connections as role anon; no HTTP or rendering",
    fixture: null, cases: [], passed: false,
  };
  const save = () => writeFileSync(join(directory, "results.json"), JSON.stringify(report, null, 2) + "\n");
  let copied = false;
  try {
    report.postgresVersion = sql("select version();");
    report.pgbenchVersion = docker(["exec", container, "pgbench", "--version"]).trim();
    report.fixture = JSON.parse(sql(readFileSync("tests/performance/catalog-load-fixture.sql", "utf8")
      .replace("__FIXTURE_ROWS__", String(options.rows))));
    if (report.fixture.syntheticRows !== options.rows) throw new Error("Catalog load fixture row count mismatch");
    const cursor = (order, offset) => JSON.parse(sql(`select row_to_json(c) from (
      select s.normalized_name,e.id,e.published_at,e.favorite_count from public.exercises e
      join public.exercise_search s on s.exercise_id=e.id where e.status='published'
      order by ${order} offset ${offset} limit 1) c;`));
    const alpha = cursor("s.normalized_name,e.id", 23);
    const deepOffset = Math.floor(report.fixture.published * 0.9);
    const deepAlpha = cursor("s.normalized_name,e.id", deepOffset);
    const deepNewest = cursor("e.published_at desc,e.id desc", deepOffset);
    const deepFavorites = cursor("e.favorite_count desc,e.id desc", deepOffset);
    const searchCursor = JSON.parse(sql("set role anon; select row_to_json(c) from (select * from public.explore_exercises(search_text=>'press') offset 23 limit 1) c;"));
    const alphaArgs = c => `cursor_name=>${literal(c.normalized_name)},cursor_id=>${literal(c.id ?? c.exercise_id)}::uuid`;
    const cases = [
      { name: "alphabetical", args: "page_size=>24" },
      { name: "exact_name", args: "search_text=>'Dumbbell Lateral Raise'" },
      { name: "broad_search", args: "search_text=>'press'" },
      { name: "alias", args: "search_text=>'side lift'" },
      { name: "fuzzy", args: "search_text=>'dumbell lateral raise'" },
      { name: "no_match", args: "search_text=>'zzzxqv999absent'", empty: true },
      { name: "common_equipment", args: "equipment_slugs=>array['cable']" },
      { name: "joint_and_cable", args: "joint_action_slugs=>array['shoulder-abduction'],equipment_slugs=>array['cable']" },
      { name: "combined_anatomy", args: "primary_muscle_slugs=>array['lateral-deltoid'],joint_action_slugs=>array['shoulder-abduction'],equipment_slugs=>array['cable'],resistance_profiles=>array['unknown']::public.resistance_profile[]" },
      { name: "next_page", args: alphaArgs(alpha) },
      { name: "search_next_page", args: `search_text=>'press',${alphaArgs(searchCursor)}` },
      { name: "deep_alphabetical", args: alphaArgs(deepAlpha), cursorOffset: deepOffset },
      { name: "deep_newest", args: `sort_key=>'newest',cursor_published_at=>${literal(deepNewest.published_at)}::timestamptz,cursor_id=>${literal(deepNewest.id)}::uuid`, cursorOffset: deepOffset },
      { name: "deep_favorites", args: `sort_key=>'most_favorited',cursor_favorite_count=>${deepFavorites.favorite_count},cursor_id=>${literal(deepFavorites.id)}::uuid`, cursorOffset: deepOffset },
    ];
    for (const item of cases) {
      // The preflight also verifies fixtures really exercise each intended branch.
      const rows = Number(sql(`set role anon; select count(*) from public.explore_exercises(${item.args});`));
      if (!Number.isInteger(rows) || (item.empty ? rows !== 0 : rows < 1 || rows > 25)) {
        throw new Error(`Invalid fixture result for ${item.name}: ${rows}`);
      }
      item.preflightRows = rows;
      writeFileSync(join(staging, `${item.name}.sql`), rpc(item.args) + "\n");
    }
    // Also clean a partially copied directory if the docker client times out.
    copied = true;
    docker(["cp", staging, `${container}:${remote}`]);
    const pgbench = (item, count, log) => spawnSync("docker", ["exec",
      "-e", `PGOPTIONS=-c role=anon -c statement_timeout=${options.statementTimeoutMs} -c application_name=kinevault_catalog_load`,
      container, "pgbench", "-U", "supabase_admin", "-d", database, "-n", "-c", String(options.clients),
      "-j", String(Math.min(options.clients, 4)), "-t", String(count), "--random-seed=42", "--max-tries=1",
      "-f", `${remote}/${item.name}.sql`, ...(log ? ["-l", `--log-prefix=${remote}/${item.name}.log`] : [])],
    { encoding: "utf8", timeout: Math.max(1, deadline - Date.now()), maxBuffer: 32 * 1024 * 1024 });
    for (const item of cases) {
      remaining();
      if (options.warmup) {
        const warmup = pgbench(item, options.warmup, false);
        if (warmup.error || warmup.status !== 0 || /\baborted\b/i.test(warmup.stderr)) {
          throw new Error(`Warmup failed for ${item.name}: ${warmup.error?.message ?? warmup.stderr.slice(-1000)}`);
        }
      }
      const started = performance.now();
      const result = pgbench(item, options.requests, true);
      const elapsedMs = performance.now() - started;
      writeFileSync(join(directory, `${item.name}.txt`), (result.stdout ?? "") + (result.stderr ?? ""));
      // Copy raw logs after each case so interrupted runs retain completed evidence.
      docker(["cp", `${container}:${remote}/.`, staging]);
      const logs = readdirSync(staging).filter(file => file.startsWith(`${item.name}.log.`))
        .map(file => readFileSync(join(staging, file), "utf8")).join("\n");
      const successfulProcess = !result.error && result.status === 0 && !/\baborted\b/i.test(result.stderr ?? "");
      const metrics = summarizeLoad(logs, options.clients * options.requests, options.thresholds, successfulProcess);
      report.cases.push({ name: item.name, sql: rpc(item.args), preflightRows: item.preflightRows,
        cursorOffset: item.cursorOffset, ...metrics, elapsedMs: Math.round(elapsedMs),
        throughputPerSecond: result.stdout?.match(/tps = ([\d.]+)/)?.[1]
          ? Number(result.stdout.match(/tps = ([\d.]+)/)[1]) : null,
        processError: result.error?.message });
      save();
      process.stdout.write(`${item.name}: p50=${metrics.p50Ms} p95=${metrics.p95Ms} p99=${metrics.p99Ms}ms errors=${metrics.errors}/${metrics.expected} ${metrics.passed ? "PASS" : "FAIL"}\n`);
      if (result.error) throw result.error;
    }
    report.passed = report.cases.length === cases.length && report.cases.every(item => item.passed);
  } catch (error) {
    report.failure = error.message;
    throw error;
  } finally {
    report.finishedAt = new Date().toISOString();
    save();
    process.stdout.write(`Catalog load results: ${join(directory, "results.json")}\n`);
    if (copied && /^\/tmp\/kinevault_catalog_load_[a-f0-9]{32}$/.test(remote)) {
      execFileSync("docker", ["exec", container, "rm", "-rf", "--", remote], { timeout: 30000 });
    }
  }
  if (!report.passed) throw new Error("Catalog load thresholds failed; inspect results.json");
}
