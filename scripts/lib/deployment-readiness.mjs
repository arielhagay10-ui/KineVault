import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";

const day = 86400000;
const proofSchema = z.object({
  checkedAt: z.iso.datetime(), reference: z.string().trim().min(1).max(500), passed: z.literal(true),
}).strict();
const evidenceSchema = z.object({
  version: z.literal(1), operator: z.string().trim().min(1).max(100),
  siteUrl: z.url(), supabaseUrl: z.url(), migrationDigest: z.string().regex(/^[a-f0-9]{64}$/),
  migrations: z.object({ versions: z.array(z.string().regex(/^\d{12,14}$/)), emptyReplay: proofSchema, upgrade: proofSchema }).strict(),
  backups: z.object({ databaseRestore: proofSchema, storageRestore: proofSchema,
    rpoMinutes: z.number().int().positive(), rtoMinutes: z.number().int().positive() }).strict(),
  monitoring: z.object({ alertDrill: proofSchema }).strict(),
  auth: z.object({ customSmtp: proofSchema, redirectAllowlist: proofSchema, signupInbox: proofSchema, recoveryInbox: proofSchema }).strict(),
  workers: z.object({ renderSmoke: proofSchema, notificationInbox: proofSchema }).strict(),
  release: z.object({ browserMedia: proofSchema, productionBuild: proofSchema }).strict(),
}).strict();

function origin(value, allowPrivateWorker = false) {
  const url = new URL(value);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const privateWorker = allowPrivateWorker && (loopback || url.hostname === "web");
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/"
    || (privateWorker ? !["http:", "https:"].includes(url.protocol)
      : url.protocol !== "https:" || isIP(url.hostname.replace(/^\[|\]$/g, ""))
        || !url.hostname.includes(".") || /\.(localhost|local|internal|test)$/.test(url.hostname))) {
    throw new Error("Invalid deployment origin");
  }
  return url.origin;
}

function keyRole(value) {
  if (typeof value !== "string" || value.trim() !== value) return null;
  if (/^sb_publishable_.+$/.test(value)) return "anon";
  if (/^sb_secret_.+$/.test(value)) return "service_role";
  try {
    const parts = value.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")).role;
  } catch { return null; }
}

function configuration(env, target) {
  const siteUrl = origin(env.NEXT_PUBLIC_SITE_URL);
  const supabaseUrl = origin(env.NEXT_PUBLIC_SUPABASE_URL);
  if (origin(target) !== siteUrl || siteUrl === supabaseUrl) throw new Error("Target mismatch");
  if (keyRole(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) !== "anon"
    || keyRole(env.SUPABASE_SERVICE_ROLE_KEY) !== "service_role"
    || typeof env.RENDER_WORKER_TOKEN !== "string" || env.RENDER_WORKER_TOKEN.length < 32
    || !env.RESEND_API_KEY?.trim()
    || !/^(?:[^<>\r\n]+ <)?[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>?$/.test(env.NOTIFICATION_EMAIL_FROM ?? "")) {
    throw new Error("Missing or invalid deployment credentials");
  }
  origin(env.RENDER_APP_URL ?? siteUrl, true);
  // NEXT_PUBLIC_* values are shipped to browsers. Catch accidental secret copies.
  const secrets = [env.SUPABASE_SERVICE_ROLE_KEY, env.RENDER_WORKER_TOKEN, env.RESEND_API_KEY];
  if (Object.entries(env).some(([name, value]) => name.startsWith("NEXT_PUBLIC_")
    && typeof value === "string" && (value.startsWith("sb_secret_")
      || keyRole(value) === "service_role" || secrets.some(secret => value.includes(secret))))) {
    throw new Error("Public environment contains a secret");
  }
  return { siteUrl, supabaseUrl, publicKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY };
}

export function migrationManifest(migrations) {
  if (!migrations.length) throw new Error("No migrations found");
  const versions = new Set();
  const files = migrations.map(({ name, sql }) => {
    const version = name.match(/^(\d{12}|\d{14})_[a-z0-9_]+\.sql$/)?.[1];
    if (!version) throw new Error("Invalid migration name");
    if (versions.has(version)) throw new Error("Duplicate migration version");
    if (!sql.trim()) throw new Error("Empty migration");
    versions.add(version);
    return { name, version, digest: createHash("sha256").update(sql.replaceAll("\r\n", "\n")).digest("hex") };
  }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  return { versions: files.map(file => file.version), count: files.length,
    digest: createHash("sha256").update(JSON.stringify(files)).digest("hex") };
}

function checkEvidence(evidence, config, manifest, now, add) {
  if (!evidence) {
    add("evidence", "pending", "Supply target-bound operator evidence for migrations, restore, alerts, auth mail and workers.", "operator");
    return;
  }
  const parsed = evidenceSchema.safeParse(evidence);
  if (!parsed.success) {
    add("evidence", "failed", "Evidence is invalid or records an unsuccessful check.", "operator");
    return;
  }
  const value = parsed.data;
  let matches = false;
  try {
    matches = origin(value.siteUrl) === config.siteUrl && origin(value.supabaseUrl) === config.supabaseUrl
      && value.migrationDigest === manifest.digest
      && JSON.stringify([...value.migrations.versions].sort()) === JSON.stringify([...manifest.versions].sort());
  } catch { /* Report only safe messages, never operator input. */ }
  add("evidence.target", matches ? "passed" : "failed", matches
    ? "Evidence matches both targets and the exact migration manifest." : "Evidence target, migration versions or migration digest differs.", "operator");
  for (const group of ["migrations", "backups", "monitoring", "auth", "workers", "release"]) {
    for (const [name, proof] of Object.entries(value[group])) {
      if (!proof || typeof proof !== "object" || !Object.hasOwn(proof, "checkedAt")) continue;
      const age = now.getTime() - Date.parse(proof.checkedAt);
      const maxAge = group === "backups" ? 30 * day : 7 * day;
      add(`evidence.${group}.${name}`, age >= 0 && age <= maxAge ? "passed" : "failed",
        age >= 0 && age <= maxAge ? "Recent operator evidence recorded." : "Evidence is stale or dated in the future.", "operator");
    }
  }
}

async function probe(id, url, headers, kind, fetcher, add) {
  const json = kind !== "html";
  try {
    const response = await fetcher(url, { method: "GET", headers, redirect: "error", signal: AbortSignal.timeout(10000) });
    if (!response.ok || !response.headers.get("content-type")?.includes(json ? "application/json" : "text/html")) {
      await response.body?.cancel();
      add(id, "failed", "Endpoint returned an unsuccessful response or unexpected content type.");
      return;
    }
    if (json) {
      const settings = await response.json();
      if (kind === "auth" && (settings?.external?.email !== true || settings.mailer_autoconfirm !== false)) {
        add(id, "failed", "Auth email login and email confirmation must be enabled.");
        return;
      }
      if (kind === "health" && settings?.status !== "ok") {
        add(id, "failed", "App health response did not report ok.");
        return;
      }
    } else await response.body?.cancel();
    add(id, "passed", kind === "auth" ? "Auth settings require email confirmation."
      : kind === "health" ? "App liveness responded; this does not verify database or workers." : "Public route responded with HTML.");
  } catch {
    add(id, "failed", "Endpoint request failed, redirected or timed out.");
  }
}

export async function checkDeployment({ env, target, migrations, evidence, online = false, fetcher = fetch, now = new Date() }) {
  const checks = [];
  const add = (id, status, detail, source = "automated") => checks.push({ id, status, detail, source });
  let config;
  let manifest;
  try {
    manifest = migrationManifest(migrations);
    add("migrations.manifest", "passed", `${manifest.count} unique, nonempty migration files.`);
  } catch { add("migrations.manifest", "failed", "Migration names, contents or version uniqueness are invalid."); }
  try {
    config = configuration(env, target);
    add("configuration", "passed", "HTTPS targets and required app/worker configuration validated; secrets omitted.");
  } catch { add("configuration", "failed", "Provide the matching HTTPS --target, valid public/worker credentials and safe origins. See docs/deployment-readiness.md."); }
  if (config && manifest) checkEvidence(evidence, config, manifest, now, add);
  else add("evidence", "pending", "Evidence cannot be compared until configuration and migrations pass.", "operator");
  if (online && config) {
    await Promise.all([
      probe("online.health", `${config.siteUrl}/api/health`, {}, "health", fetcher, add),
      probe("online.catalog", `${config.siteUrl}/exercises`, {}, "html", fetcher, add),
      probe("online.signIn", `${config.siteUrl}/sign-in`, {}, "html", fetcher, add),
      probe("online.auth", `${config.supabaseUrl}/auth/v1/settings`, { apikey: config.publicKey }, "auth", fetcher, add),
    ]);
  } else add("online", "pending", "Run --online with valid configuration for public GET checks.");
  return { passed: checks.every(check => check.status === "passed"), migrationManifest: manifest ?? null,
    checks: checks.sort((a, b) => a.id.localeCompare(b.id)) };
}
