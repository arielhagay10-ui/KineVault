import { test } from "node:test";
import assert from "node:assert/strict";
import { checkDeployment, migrationManifest } from "./deployment-readiness.mjs";

const now = new Date("2026-10-06T12:00:00Z");
const env = {
  NEXT_PUBLIC_SITE_URL: "https://kinevault.example.org",
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_public",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_private",
  RENDER_WORKER_TOKEN: "a".repeat(32),
  RENDER_APP_URL: "http://127.0.0.1:3000",
  RESEND_API_KEY: "re_private",
  NOTIFICATION_EMAIL_FROM: "KineVault <reviews@example.org>",
};
const migrations = [{ name: "202609270001_initial.sql", sql: "select 1;" }];
const proof = () => ({ checkedAt: now.toISOString(), reference: "private/run-123", passed: true });
function evidence() {
  return {
    version: 1, operator: "release-owner", siteUrl: env.NEXT_PUBLIC_SITE_URL,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL, migrationDigest: migrationManifest(migrations).digest,
    migrations: { versions: ["202609270001"], emptyReplay: proof(), upgrade: proof() },
    backups: { databaseRestore: proof(), storageRestore: proof(), rpoMinutes: 60, rtoMinutes: 120 },
    monitoring: { alertDrill: proof() },
    auth: { customSmtp: proof(), redirectAllowlist: proof(), signupInbox: proof(), recoveryInbox: proof() },
    workers: { renderSmoke: proof(), notificationInbox: proof() },
    release: { browserMedia: proof(), productionBuild: proof() },
  };
}
const options = () => ({ env, target: env.NEXT_PUBLIC_SITE_URL, migrations, evidence: evidence(), now });
const healthyFetch = async (url, init) => {
  assert.equal(init.method, "GET");
  assert.equal(init.redirect, "error");
  assert.ok(init.signal);
  assert.ok(!JSON.stringify(init).includes(env.SUPABASE_SERVICE_ROLE_KEY));
  return new Response(url.endsWith("/auth/v1/settings")
    ? JSON.stringify({ external: { email: true }, mailer_autoconfirm: false })
    : url.endsWith("/api/health") ? JSON.stringify({ status: "ok" }) : "<html>KineVault</html>",
  { status: 200, headers: { "content-type": url.endsWith("/settings") || url.endsWith("/api/health") ? "application/json" : "text/html" } });
};

test("offline checks stay pending without making network calls", async () => {
  const report = await checkDeployment({ ...options(), fetcher: () => assert.fail("unexpected network") });
  assert.equal(report.passed, false);
  assert.ok(report.checks.some(check => check.status === "pending" && check.id === "online"));
});

test("online preflight uses only public GETs and complete evidence", async () => {
  const report = await checkDeployment({ ...options(), online: true, fetcher: healthyFetch });
  assert.equal(report.passed, true);
  assert.ok(report.checks.some(check => check.id === "online.health" && check.status === "passed"));
  assert.ok(!JSON.stringify(report).includes(env.SUPABASE_SERVICE_ROLE_KEY));
  assert.ok(!JSON.stringify(report).includes(env.RESEND_API_KEY));
});

test("the existing Compose private renderer destination is supported", async () => {
  const report = await checkDeployment({ ...options(), env: { ...env, RENDER_APP_URL: "http://web:3000" }, online: true, fetcher: healthyFetch });
  assert.equal(report.passed, true);
});

test("secret copies in unexpected public variables and missing worker config fail safely", async () => {
  for (const patch of [{ NEXT_PUBLIC_MISTAKE: env.RESEND_API_KEY }, { RENDER_WORKER_TOKEN: "short" }, { SUPABASE_SERVICE_ROLE_KEY: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }]) {
    const report = await checkDeployment({ ...options(), env: { ...env, ...patch }, online: true, fetcher: () => assert.fail("unsafe request") });
    assert.equal(report.passed, false);
    assert.ok(!JSON.stringify(report).includes(env.RESEND_API_KEY));
  }
});

test("wrong target, unsafe origins and privileged public keys block all requests", async () => {
  for (const patch of [
    { target: "https://other.example.org" },
    { env: { ...env, NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000" } },
    { env: { ...env, NEXT_PUBLIC_SUPABASE_URL: "https://user:password@project.supabase.co" } },
    { env: { ...env, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_do-not-print" } },
    { env: { ...env, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature` } },
  ]) {
    const report = await checkDeployment({ ...options(), ...patch, online: true, fetcher: () => assert.fail("unsafe request") });
    assert.equal(report.passed, false);
    assert.ok(report.checks.some(check => check.id === "configuration" && check.status === "failed"));
    assert.ok(!JSON.stringify(report).includes("do-not-print"));
  }
});

test("missing, stale, wrong-project and edited-migration evidence cannot pass", async () => {
  for (const change of [
    () => undefined,
    value => ({ ...value, siteUrl: "https://other.example.org" }),
    value => ({ ...value, migrationDigest: "0".repeat(64) }),
    value => ({ ...value, migrations: { ...value.migrations, versions: [] } }),
    value => ({ ...value, auth: { ...value.auth, recoveryInbox: { ...proof(), checkedAt: "2026-09-01T12:00:00Z" } } }),
    value => ({ ...value, backups: { ...value.backups, storageRestore: { ...proof(), passed: false } } }),
    value => ({ ...value, monitoring: { alertDrill: { ...proof(), checkedAt: "2026-10-07T12:00:00Z" } } }),
  ]) {
    const report = await checkDeployment({ ...options(), evidence: change(evidence()), online: true, fetcher: healthyFetch });
    assert.equal(report.passed, false);
    assert.ok(report.checks.some(check => check.id.startsWith("evidence") && check.status !== "passed"));
  }
});

test("redirects, failed health, wrong content type and disabled confirmation fail", async () => {
  for (const fetcher of [
    async () => new Response("", { status: 302 }),
    async () => new Response("", { status: 503 }),
    async () => new Response("{}", { headers: { "content-type": "application/json" } }),
    async (url, init) => url.endsWith("/settings")
      ? new Response(JSON.stringify({ external: { email: true }, mailer_autoconfirm: true }), { headers: { "content-type": "application/json" } })
      : healthyFetch(url, init),
    async () => { throw new Error(`provider error ${env.RESEND_API_KEY}`); },
  ]) {
    const report = await checkDeployment({ ...options(), online: true, fetcher });
    assert.equal(report.passed, false);
    assert.ok(!JSON.stringify(report).includes(env.RESEND_API_KEY));
  }
});

test("migration manifest rejects duplicate versions and empty migrations, normalizes line endings", () => {
  assert.throws(() => migrationManifest([...migrations, { name: "202609270001_other.sql", sql: "select 2;" }]), /duplicate/i);
  assert.throws(() => migrationManifest([{ name: "20261006123456_empty.sql", sql: " " }]), /empty/i);
  assert.throws(() => migrationManifest([{ name: "bad.sql", sql: "select 1;" }]), /name/i);
  assert.equal(migrationManifest([{ ...migrations[0], sql: "select 1;\r\n" }]).digest,
    migrationManifest([{ ...migrations[0], sql: "select 1;\n" }]).digest);
});
