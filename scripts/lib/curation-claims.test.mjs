import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const scripts = ["author-seated-curl.mjs", "curate-local-demos.mjs"];
let sequence = 0;

// Execute the actual entry points; replace only Docker, services, disk and capture.
async function runScript(script, mode, item, options = {}) {
  const key = `curationFixture${sequence++}`;
  const entry = pathToFileURL(resolve("scripts", script)).href;
  const calls = { captures: 0, uploads: [], completions: [], claims: 0, writes: [] };
  const manifest = script === "author-seated-curl.mjs"
    ? { slug: "seated-dumbbell-curl", ...item }
    : { userId: "00000000-0000-4000-8000-000000000001", items: [{ slug: "dumbbell-curl", ...item }] };
  const current = { status: "running", claim_id: "claim-one", started_at: new Date().toISOString(), ...options.current };
  const client = {
    auth: { admin: { createUser: async () => ({ data: { user: { id: "00000000-0000-4000-8000-000000000001" } }, error: null }) } },
    from: () => ({ select() { return this; }, eq() { return this; },
      async maybeSingle() { return { data: current, error: null }; } }),
    rpc: async (name, args) => {
      if (name === "claim_render_job") {
        calls.claims++;
        return { data: [{ job_id: "job-one", submission_id: "submission-one", claim_id: "claim-one" }], error: null };
      }
      if (name === "read_render_scene") return { data: { durationMs: 250 }, error: null };
      if (name === "complete_render_job") {
        calls.completions.push(args);
        if (args.p_claim_id !== "claim-one") return { error: new Error("completion requires the current claim identifier") };
        if (options.completionError) return { error: new Error("render claim is expired or no longer current") };
        return { error: null };
      }
      throw new Error(`Unexpected RPC ${name}`);
    },
    storage: { from: () => ({ exists: async () => ({ data: false }),
      upload: async path => { calls.uploads.push(path); return { error: null }; } }) },
  };
  const dependencies = {
    "@supabase/supabase-js": { createClient: () => client },
    "node:child_process": { execFileSync: (_command, args) => options.sql ? options.sql(args.at(-1)) : "submission-one" },
    "node:crypto": { randomUUID: () => "asset-one", createHash: () => {}, randomBytes: () => {} },
    "node:fs": { existsSync: () => mode !== "prepare" },
    "node:fs/promises": { mkdir: async () => {},
      readFile: async path => String(path).endsWith("manifest.json") ? JSON.stringify(manifest) : Buffer.from("output"),
      writeFile: async (path, contents) => { if (String(path).endsWith("manifest.json")) calls.writes.push(JSON.parse(contents)); } },
    "@playwright/test": { chromium: {} },
    "../src/lib/motion/seated-curl.ts": { seatedCurlScene: {} },
    "../src/lib/motion/incline-curl.ts": { inclineCurlScene: {} },
    "./lib/capture-motion.mjs": { captureMotion: async () => {
      calls.captures++;
      return { webm: "demo.webm", mp4: "demo.mp4", poster: "poster.webp" };
    } },
  };
  globalThis[key] = { dependencies, process: {
    loadEnvFile() {}, argv: ["node", script, mode],
    env: { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:15421", RENDER_APP_URL: "http://127.0.0.1:3000" },
  }, console: { log() {} } };
  const source = await readFile(new URL(entry), "utf8");
  const hook = registerHooks({
    resolve(specifier, context, next) {
      if (Object.hasOwn(dependencies, specifier) && context.parentURL?.startsWith(entry)) {
        return { url: `curation-fixture:${key}/${encodeURIComponent(specifier)}`, shortCircuit: true };
      }
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url === `${entry}?fixture=${key}`) return { format: "module", shortCircuit: true,
        source: `const { process, console } = globalThis.${key};\n${source}` };
      if (url.startsWith(`curation-fixture:${key}/`)) {
        const specifier = decodeURIComponent(url.split("/").slice(1).join("/"));
        return { format: "module", shortCircuit: true, source: Object.keys(dependencies[specifier])
          .map(name => `export const ${name} = globalThis.${key}.dependencies[${JSON.stringify(specifier)}].${name};`).join("\n") };
      }
      return next(url, context);
    },
  });
  let error;
  try { await import(`${entry}?fixture=${key}`); } catch (caught) { error = caught; }
  finally { hook.deregister(); delete globalThis[key]; }
  return { calls, error };
}

for (const script of scripts) {
  test(`${script} completes uploads using its persisted claim`, async () => {
    const result = await runScript(script, "render", { job: "job-one", submission: "submission-one", claimId: "claim-one" });
    assert.ifError(result.error);
    assert.deepEqual(result.calls.uploads, ["submission-one/job-one/claim-one/demo.webm",
      "submission-one/job-one/claim-one/demo.mp4", "submission-one/job-one/claim-one/poster.webp"]);
    assert.equal(result.calls.completions[0].p_claim_id, "claim-one");
    const saved = result.calls.writes.at(-1);
    assert.equal((script === "author-seated-curl.mjs" ? saved : saved.items[0]).rendered, true);
  });

  test(`${script} refuses a legacy unrendered manifest before capturing or claiming`, async () => {
    const result = await runScript(script, "render", { job: "job-one", submission: "submission-one" });
    assert.match(result.error?.message ?? "", /claim.*manifest|manifest.*claim/i);
    assert.equal(result.calls.captures, 0);
    assert.equal(result.calls.claims, 0);
    assert.deepEqual(result.calls.uploads, []);
  });

  for (const current of [
    { claim_id: "replacement-claim" }, { status: "queued" },
    { started_at: new Date(Date.now() - 11 * 60000).toISOString() },
  ]) test(`${script} refuses a stale or expired saved claim ${JSON.stringify(current)}`, async () => {
    const result = await runScript(script, "render", { job: "job-one", submission: "submission-one", claimId: "claim-one" }, { current });
    assert.match(result.error?.message ?? "", /expired|no longer current/);
    assert.equal(result.calls.captures, 0);
    assert.equal(result.calls.claims, 0);
    assert.deepEqual(result.calls.uploads, []);
  });

  test(`${script} never checkpoints success when its claim expires during capture`, async () => {
    const result = await runScript(script, "render", { job: "job-one", submission: "submission-one", claimId: "claim-one" }, { completionError: true });
    assert.match(result.error?.message ?? "", /expired/);
    assert.equal(result.calls.captures, 1);
    assert.equal(result.calls.claims, 0);
    assert.deepEqual(result.calls.writes, []);
  });
}

test("single-exercise claiming checkpoints the generation returned by the RPC", async () => {
  const result = await runScript("author-seated-curl.mjs", "claim", { submission: "submission-one" });
  assert.ifError(result.error);
  assert.equal(result.calls.writes.at(-1).claimId, "claim-one");
});

test("catalog preparation checkpoints the generation returned by the RPC", async () => {
  const result = await runScript("curate-local-demos.mjs", "prepare", {}, { sql(query) {
    if (query.startsWith("begin;")) return JSON.stringify(query.includes("submit_private_exercise") ? "submission-one" : "draft-one");
    if (query.startsWith("update public.roles")) return "";
    if (query.includes("slug='dumbbell-curl'")) return query.includes("pending_media") ? "candidate-one" : "";
    return "existing-published-exercise";
  } });
  assert.ifError(result.error);
  assert.equal(result.calls.writes.at(-1).items[0].claimId, "claim-one");
});

test("legacy single-exercise claiming never adopts the database's current claim", async () => {
  const result = await runScript("author-seated-curl.mjs", "claim", { job: "job-one", submission: "submission-one" });
  assert.match(result.error?.message ?? "", /manifest.*claim/i);
  assert.equal(result.calls.claims, 0);
  assert.deepEqual(result.calls.writes, []);
});

test("single-exercise claiming leaves unrelated queued jobs untouched", async () => {
  const result = await runScript("author-seated-curl.mjs", "claim", { submission: "submission-one" }, { sql: () => "unrelated-submission" });
  assert.match(result.error?.message ?? "", /Unrelated jobs/);
  assert.equal(result.calls.claims, 0);
});
