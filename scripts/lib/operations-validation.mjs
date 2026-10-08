import { createHash } from "node:crypto";
import { z } from "zod";

export function localOrigin(value) {
  const url = new URL(value);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    || !["http:", "https:"].includes(url.protocol) || url.username || url.password
    || url.pathname !== "/" || url.search || url.hash) throw new Error("Local origin required");
  return url.origin;
}

export function isolatedNames(value) {
  const suffix = z.uuid().parse(value).replaceAll("-", "");
  return { source: `kinevault_recovery_source_${suffix}`, restore: `kinevault_recovery_restore_${suffix}`, suffix };
}

export function migrationDifference(local, remote) {
  const versions = z.array(z.string().regex(/^(?:\d{12}|\d{14})$/));
  versions.parse(local); versions.parse(remote);
  if (new Set(local).size !== local.length || new Set(remote).size !== remote.length) throw new Error("Duplicate migration versions");
  const missing = local.filter(version => !remote.includes(version)).sort();
  const unexpected = remote.filter(version => !local.includes(version)).sort();
  return { passed: !missing.length && !unexpected.length, missing, unexpected, localCount: local.length, remoteCount: remote.length };
}

export function evaluateQueues(value, maxAgeSeconds = 900) {
  const count = z.number().int().nonnegative();
  const queue = z.object({ queued: count, failed: count, stale: count, oldestSeconds: z.number().nonnegative() });
  const snapshot = z.object({ render: queue.extend({ running: count }), notification: queue.extend({ sending: count }) }).parse(value);
  z.number().int().positive().max(86400).parse(maxAgeSeconds);
  const checks = Object.entries(snapshot).map(([name, item]) => ({
    name, passed: item.failed === 0 && item.stale === 0 && item.oldestSeconds <= maxAgeSeconds,
    ...item,
  }));
  return { passed: checks.every(item => item.passed), maxAgeSeconds, checks };
}

export function verifyBytes(expected, actual) {
  const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
  const checksum = sha256(expected);
  if (expected.length !== actual.length || checksum !== sha256(actual)) throw new Error("Backup bytes differ");
  return { bytes: actual.length, sha256: checksum };
}

// Supabase Storage documents 401/403 denials and 404 hidden/missing objects.
// Legacy gateways can wrap those codes in HTTP 400; a bare 400 proves nothing.
export function requireStorageDenial(result) {
  const status = result?.status;
  const expected = [401, 403, 404];
  if (expected.includes(status)) return status;
  if (status !== 400) throw new Error("Storage authorization or missing-object response required");
  const codes = { InvalidJWT: 401, InvalidSignature: 403, SignatureDoesNotMatch: 403, AccessDenied: 403,
    NoSuchBucket: 404, NoSuchKey: 404, not_found: 404, unauthorized: 403 };
  const code = result.code ?? result.error ?? result.statusCode;
  if (Object.hasOwn(codes, code)) return codes[code];
  if (result.code) throw new Error("Unexpected Storage error code");
  const declaredStatus = Number(result.statusCode ?? result.httpStatusCode);
  if (expected.includes(declaredStatus)) return declaredStatus;
  throw new Error("Unexpected Storage error status");
}

// Aggregates only. No job IDs, email payloads, provider receipts or signed URLs.
export const queueSnapshotSql = `begin read only;
set local statement_timeout='5s';
select json_build_object(
  'render', (select json_build_object(
    'queued',count(*) filter(where status='queued'),'running',count(*) filter(where status='running'),
    'failed',count(*) filter(where status='failed'),
    'stale',count(*) filter(where status='running' and started_at < now()-interval '10 minutes'),
    'oldestSeconds',coalesce(greatest(0,extract(epoch from now()-min(queued_at) filter(where status='queued'))),0)
  ) from public.render_jobs),
  'notification', (select json_build_object(
    'queued',count(*) filter(where status='queued'),'sending',count(*) filter(where status='sending'),
    'failed',count(*) filter(where status='failed'),
    'stale',count(*) filter(where status='sending' and started_at < now()-interval '5 minutes'),
    'oldestSeconds',coalesce(greatest(0,extract(epoch from now()-min(next_attempt_at) filter(where status='queued' and next_attempt_at<=now()))),0)
  ) from public.notification_deliveries));
commit;`;
