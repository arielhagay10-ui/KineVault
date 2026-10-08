import { execFileSync, spawn } from "node:child_process";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runHttpCase, summarizeHttpSamples } from "./catalog-http-load-metrics.mjs";

const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
const sqlArgs = body => Object.entries(body).map(([key, value]) => `${key}=>${Array.isArray(value)
  ? `array[${value.map(literal).join(",")}]${key === "resistance_profiles" ? "::public.resistance_profile[]" : ""}`
  : typeof value === "number" ? value : literal(value)}`).join(",");

export function buildHttpDatabaseUri(uri, container, database, timeout, name) {
  const connection = new URL(uri);
  connection.hostname = container;
  connection.port = "5432";
  connection.pathname = "/" + database;
  // libpq URI parsing does not decode form-style '+' into a space.
  connection.search = "?options=" + encodeURIComponent(`-c statement_timeout=${timeout} -c application_name=${name}`);
  return connection.toString();
}

export async function runCatalogHttpLoad({ container, database, options, deadline }) {
  if (!/^kinevault_checks_[a-f0-9]{32}$/.test(database)) throw new Error("HTTP load requires an isolated database");
  const suffix = database.slice("kinevault_checks_".length);
  const name = `kinevault_catalog_http_${suffix}`;
  const directory = resolve(".local-artifacts", "catalog-http-load", suffix);
  mkdirSync(directory, { recursive: true });
  const remaining = () => {
    if (deadline <= Date.now()) throw new Error("Catalog HTTP load exceeded its total deadline");
    return Math.max(1, Math.min(120000, deadline - Date.now()));
  };
  const docker = args => execFileSync("docker", args, { encoding: "utf8", timeout: remaining(), maxBuffer: 32 * 1024 * 1024 });
  const sql = input => execFileSync("docker", ["exec", "-i", container, "psql", "-X", "-U", "supabase_admin",
    "-d", database, "-v", "ON_ERROR_STOP=1", "-qAt"], { input, encoding: "utf8", timeout: remaining(), maxBuffer: 32 * 1024 * 1024 }).trim();
  const oracle = body => JSON.parse(sql(`set role anon; select coalesce(json_agg(row_to_json(r)), '[]'::json) from
    (select * from public.explore_exercises(${sqlArgs(body)})) r;`));
  const report = { schemaVersion: 1, startedAt: new Date().toISOString(), database, options,
    metric: "Loopback HTTP POST to PostgREST explore_exercises, full JSON body and correctness check; persistent HTTP clients",
    coverage: { postgrestInternalPool: true, externalSupabasePooler: false, remoteNetwork: false, nextRendering: false, mediaHydration: false },
    fixture: null, checks: [], cases: [], passed: false };
  const save = () => writeFileSync(join(directory, "results.json"), JSON.stringify(report, null, 2) + "\n");
  let created = false;
  let server;
  let serverFailure = false;
  try {
    report.postgresVersion = sql("select version();");
    report.fixture = JSON.parse(sql(readFileSync("tests/performance/catalog-load-fixture.sql", "utf8")
      .replace("__FIXTURE_ROWS__", String(options.rows))));
    if (report.fixture.syntheticRows !== options.rows || report.fixture.unpublished < 1) throw new Error("Invalid HTTP load fixture");
    const image = docker(["inspect", "--format", "{{.Config.Image}}", "supabase_rest_kinevault"]).trim();
    if (!image || /\s/.test(image)) throw new Error("Invalid local PostgREST image");
    report.postgrestImage = image;
    const networks = JSON.parse(docker(["inspect", "--format", "{{json .NetworkSettings.Networks}}", container]));
    const network = Object.keys(networks).find(key => key === "supabase_network_kinevault");
    if (!network) throw new Error("Local Supabase network unavailable");
    // Read only this field, never serialize Docker config or credentials into evidence.
    const env = JSON.parse(docker(["inspect", "--format", "{{json .Config.Env}}", "supabase_rest_kinevault"]));
    const connection = new URL(buildHttpDatabaseUri(env.find(value => value.startsWith("PGRST_DB_URI="))?.slice("PGRST_DB_URI=".length),
      container, database, options.statementTimeoutMs, name));
    if (!["postgres:", "postgresql:"].includes(connection.protocol) || decodeURIComponent(connection.username) !== "authenticator") {
      throw new Error("Local PostgREST must connect as authenticator");
    }
    const secret = randomBytes(48).toString("base64url");
    const config = `db-uri = ${JSON.stringify(connection.toString())}\ndb-schemas = "public"\ndb-extra-search-path = "public,extensions"\ndb-anon-role = "anon"\ndb-config = false\ndb-pool = ${options.pool}\ndb-pool-acquisition-timeout = 5\njwt-secret = ${JSON.stringify(secret)}\nserver-port = 3000\n`;
    // Config travels through stdin, never command arguments, env files or artifacts.
    created = true;
    docker(["create", "--pull=never", "--name", name, "--network", network, "-i", "-p", "127.0.0.1::3000", image, "/bin/postgrest", "/dev/stdin"]);
    server = spawn("docker", ["start", "-ai", name], { stdio: ["pipe", "ignore", "pipe"] });
    let startupLog = "";
    server.stderr.on("data", chunk => {
      startupLog = (startupLog + chunk.toString()).slice(-4096);
    });
    server.on("error", () => { serverFailure = true; });
    server.stdin.on("error", () => { serverFailure = true; });
    server.stdin.end(config);
    const binding = JSON.parse(docker(["inspect", "--format", "{{json (index .NetworkSettings.Ports \"3000/tcp\")}}", name]));
    let port = binding?.find(item => item.HostIp === "127.0.0.1")?.HostPort;
    // Docker may assign the random host port only after start has completed.
    const readyDeadline = Math.min(deadline, Date.now() + 30000);
    let ready = false;
    while (Date.now() < readyDeadline && !ready) {
      if (serverFailure || server.exitCode !== null) throw new Error("Disposable PostgREST failed to start");
      if (!port) {
        port = JSON.parse(docker(["inspect", "--format", "{{json (index .NetworkSettings.Ports \"3000/tcp\")}}", name]))
          ?.find(item => item.HostIp === "127.0.0.1")?.HostPort;
      }
      if (port) {
        const samples = await runHttpCase({ url: `http://127.0.0.1:${port}/rpc/explore_exercises`, body: { page_size: 24 },
          expected: oracle({ page_size: 24 }), clients: 1, requests: 1, timeoutMs: 1000, deadline: readyDeadline });
        ready = samples[0]?.ok === true;
        if (!ready) report.readinessFailure = { status: samples[0]?.status, failure: samples[0]?.failure };
      }
      if (!ready) await new Promise(resolve => setTimeout(resolve, 200));
    }
    if (!ready) {
      report.startupDiagnostic = startupLog.split(connection.toString()).join("[redacted URI]")
        .split(secret).join("[redacted secret]").split(decodeURIComponent(connection.password)).join("[redacted password]");
      throw new Error("Disposable PostgREST HTTP readiness failed");
    }
    delete report.readinessFailure;
    const origin = `http://127.0.0.1:${port}`;
    const authenticatedClaims = Buffer.from(JSON.stringify({ role: "authenticated", sub: randomUUID(), exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    const tokenBody = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url") + "." + authenticatedClaims;
    const authenticatedHeaders = { authorization: "Bearer " + tokenBody + "." + createHmac("sha256", secret).update(tokenBody).digest("base64url") };
    const check = async (name, url, expected, headers = {}, body = {}, method = "POST") => {
      const samples = await runHttpCase({ url, expected, headers, body, method, clients: 1, requests: 1,
        timeoutMs: options.statementTimeoutMs, deadline });
      const passed = samples[0]?.ok === true;
      report.checks.push({ name, passed });
      save();
      if (!passed) throw new Error(`HTTP correctness check failed: ${name}`);
    };
    const hidden = JSON.parse(sql("select json_agg(id) from (select id from public.exercises where status <> 'published' order by id limit 3) r;"));
    for (const [role, headers] of [["anon", {}], ["authenticated", authenticatedHeaders]]) {
      await check(`${role}_published_catalog`, origin + "/rpc/explore_exercises", oracle({ page_size: 24 }), headers, { page_size: 24 });
      await check(`${role}_unpublished_hidden`, origin + "/exercises?select=id&id=in.(" + hidden.join(",") + ")", [], headers, {}, "GET");
    }
    const cursor = (sort, offset) => JSON.parse(sql(`select row_to_json(r) from (select e.id exercise_id,s.normalized_name,
      e.published_at,e.favorite_count from public.exercises e join public.exercise_search s on s.exercise_id=e.id
      where e.status='published' order by ${sort === "alphabetical" ? "s.normalized_name,e.id" : sort === "newest" ? "e.published_at desc,e.id desc" : "e.favorite_count desc,e.id desc"}
      offset ${offset} limit 1) r;`));
    const cursorBody = (sort, row) => ({ sort_key: sort, cursor_id: row.exercise_id, ...sort === "alphabetical"
      ? { cursor_name: row.normalized_name } : sort === "newest" ? { cursor_published_at: row.published_at } : { cursor_favorite_count: row.favorite_count } });
    const deepOffset = Math.floor(report.fixture.published * 0.9);
    const cases = [
      { name: "alphabetical", body: {} },
      { name: "exact_name", body: { search_text: "Dumbbell Lateral Raise" } },
      { name: "broad_search", body: { search_text: "press" } },
      { name: "alias", body: { search_text: "side lift" } },
      { name: "fuzzy", body: { search_text: "dumbell lateral raise" } },
      { name: "no_match", body: { search_text: "zzzxqv999absent" }, empty: true },
      { name: "common_equipment", body: { equipment_slugs: ["cable"] } },
      { name: "joint_and_cable", body: { joint_action_slugs: ["shoulder-abduction"], equipment_slugs: ["cable"] } },
      { name: "combined_anatomy", body: { primary_muscle_slugs: ["lateral-deltoid"], joint_action_slugs: ["shoulder-abduction"], equipment_slugs: ["cable"], resistance_profiles: ["unknown"] } },
    ];
    for (const sort of ["alphabetical", "newest", "most_favorited"]) {
      const first = oracle({ sort_key: sort, page_size: 48 });
      if (first.length !== 49) throw new Error("Pagination fixtures require at least 49 rows");
      const body = { ...cursorBody(sort, first[23]), page_size: 24 };
      await check(`${sort}_next_page_no_gaps`, origin + "/rpc/explore_exercises", first.slice(24, 49), {}, body);
      cases.push({ name: `${sort}_next_page`, body });
      cases.push({ name: `deep_${sort}`, body: cursorBody(sort, cursor(sort, deepOffset)), cursorOffset: deepOffset });
    }
    const searchRows = oracle({ search_text: "press", page_size: 48 });
    const searchBody = { search_text: "press", ...cursorBody("alphabetical", searchRows[23]), page_size: 24 };
    await check("search_next_page_no_gaps", origin + "/rpc/explore_exercises", searchRows.slice(24, 49), {}, searchBody);
    cases.push({ name: "search_next_page", body: searchBody });
    for (const item of cases) {
      remaining();
      const body = { page_size: 24, ...item.body };
      const expected = oracle(body);
      if (item.empty ? expected.length !== 0 : expected.length < 1 || expected.length > 25) throw new Error(`Invalid fixture case: ${item.name}`);
      const run = requests => runHttpCase({ url: origin + "/rpc/explore_exercises", body, expected,
        clients: options.clients, requests, timeoutMs: options.statementTimeoutMs, deadline });
      if (options.warmup) {
        const samples = await run(options.warmup);
        if (samples.length !== options.clients * options.warmup || samples.some(sample => !sample.ok)) throw new Error(`HTTP warmup failed: ${item.name}`);
      }
      const started = performance.now();
      const samples = await run(options.requests);
      const elapsedMs = performance.now() - started;
      writeFileSync(join(directory, `${item.name}.samples.jsonl`), samples.map(sample => JSON.stringify(sample)).join("\n") + "\n");
      const metrics = summarizeHttpSamples(samples, options.clients * options.requests, options.thresholds);
      report.cases.push({ name: item.name, body, preflightRows: expected.length, cursorOffset: item.cursorOffset,
        ...metrics, elapsedMs, throughputPerSecond: metrics.completed / (elapsedMs / 1000) });
      save();
      process.stdout.write(`${item.name}: p50=${metrics.p50Ms} p95=${metrics.p95Ms} p99=${metrics.p99Ms}ms errors=${metrics.errors}/${metrics.expected} ${metrics.passed ? "PASS" : "FAIL"}\n`);
    }
    report.passed = report.checks.every(check => check.passed) && report.cases.length === cases.length && report.cases.every(item => item.passed);
  } catch (error) {
    // Never retain child-process errors: their command/config may contain secrets.
    report.failure = error.message.startsWith("Command failed") ? "Local Docker/SQL operation failed" : error.message;
    throw new Error(report.failure);
  } finally {
    report.finishedAt = new Date().toISOString();
    try {
      if (created && /^kinevault_catalog_http_[a-f0-9]{32}$/.test(name)) {
        execFileSync("docker", ["rm", "--force", name], { timeout: 30000, stdio: "ignore" });
      }
      report.containerRemoved = true;
    } catch {
      report.containerRemoved = false;
      report.passed = false;
      report.cleanupFailure = "Could not remove the disposable HTTP container";
      throw new Error(report.cleanupFailure);
    } finally {
      server?.kill();
      save();
      process.stdout.write(`Catalog HTTP load results: ${join(directory, "results.json")}\n`);
    }
  }
  if (!report.passed) throw new Error("Catalog HTTP load thresholds failed; inspect results.json");
}
