import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { randomUUID } from "node:crypto";
import { resolve, join } from "node:path";
import ffmpeg from "ffmpeg-static";
import { createClient } from "@supabase/supabase-js";
import { localOrigin, verifyBytes, requireStorageDenial } from "./lib/operations-validation.mjs";

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/drill-storage-recovery.mjs\nLoads .env.local when present, retaining explicit environment values. Creates one UUID private local bucket and real tiny WebM/MP4/WebP fixtures. Downloads backups, deletes originals, restores bytes, verifies checksums and signed/unsigned access, then removes only that bucket. Rejects remote URLs.");
  process.exit(0);
}
if (existsSync(".env.local")) loadEnvFile(".env.local");
const runId = randomUUID();
const bucketId = `kinevault-recovery-${runId}`;
const directory = resolve(".local-artifacts", "operations", runId);
mkdirSync(directory, { recursive: true });
const report = { version: 1, scope: "local synthetic private Storage", startedAt: new Date().toISOString(), passed: false, cleanupPassed: false, objects: [] };
let service; let bucket; let ownsBucket = false; let creationUncertain = false;
const paths = ["demo.webm", "demo.mp4", "poster.webp"];
const mimeTypes = ["video/webm", "video/mp4", "image/webp"];
const demand = result => { if (result.error) throw new Error("Storage operation failed"); return result.data; };
const boundedFetch = (url, options = {}) => fetch(url, { ...options, redirect: "error", signal: AbortSignal.timeout(10000) });
const denialResponse = async response => requireStorageDenial({ ...(await response.json()), status: response.status });
try {
  if (process.argv.length > 2) throw new Error("Unexpected arguments");
  const origin = localOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const configuredPort = Number(readFileSync("supabase/config.toml", "utf8").match(/\[api\][\s\S]*?\nport\s*=\s*(\d+)/)?.[1]);
  if (!Number.isInteger(configuredPort) || new URL(origin).port !== String(configuredPort)) throw new Error("Configured local API port required");
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!publicKey || !secret || publicKey === secret) throw new Error("Local keys required");
  // Explicit fixed local instance identity. Avoid mutating an arbitrary service on loopback.
  const running = execFileSync("docker", ["inspect", "--format", "{{.State.Running}}", "supabase_storage_kinevault"], { encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] }).trim();
  if (running !== "true") throw new Error("Local Storage container required");
  const clientOptions = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: boundedFetch } };
  service = createClient(origin, secret, clientOptions);
  const visitor = createClient(origin, publicKey, clientOptions);
  for (let index = 0; index < paths.length; index++) {
    const extra = index === 0 ? ["-c:v", "libvpx-vp9"] : index === 1 ? ["-c:v", "libx264", "-pix_fmt", "yuv420p"] : ["-frames:v", "1", "-c:v", "libwebp"];
    execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=black:s=32x32:r=10:d=0.2", ...extra, "-y", join(directory, paths[index])], { timeout: 30000, stdio: "pipe" });
  }
  creationUncertain = true;
  demand(await service.storage.createBucket(bucketId, { public: false, fileSizeLimit: 1048576, allowedMimeTypes: mimeTypes }));
  ownsBucket = true;
  creationUncertain = false;
  bucket = service.storage.from(bucketId);
  const backupDirectory = join(directory, "backup");
  mkdirSync(backupDirectory);
  const backupStarted = Date.now();
  for (let index = 0; index < paths.length; index++) {
    const name = paths[index];
    const expected = readFileSync(join(directory, name));
    demand(await bucket.upload(name, expected, { contentType: mimeTypes[index], upsert: false }));
    const bytes = Buffer.from(await demand(await bucket.download(name)).arrayBuffer());
    const proof = verifyBytes(expected, bytes);
    writeFileSync(join(backupDirectory, name), bytes);
    report.objects.push({ name, ...proof });
  }
  report.backupCompletedAt = new Date().toISOString();
  demand(await bucket.remove(paths));
  for (const name of paths) {
    if (requireStorageDenial((await bucket.download(name)).error) !== 404) throw new Error("Deleted object absence was not confirmed");
  }
  const restoreStarted = Date.now();
  for (let index = 0; index < paths.length; index++) {
    const name = paths[index];
    const backup = readFileSync(join(backupDirectory, name));
    verifyBytes(readFileSync(join(directory, name)), backup);
    demand(await bucket.upload(name, backup, { contentType: mimeTypes[index], upsert: false }));
    verifyBytes(backup, Buffer.from(await demand(await bucket.download(name)).arrayBuffer()));
    const anonymous = await visitor.storage.from(bucketId).download(name);
    const anonymousStatus = requireStorageDenial(anonymous.error);
    const signed = demand(await bucket.createSignedUrl(name, 60));
    const url = new URL(signed.signedUrl);
    if (url.origin !== origin) throw new Error("Signed target mismatch");
    const response = await boundedFetch(url);
    if (!response.ok) throw new Error("Signed download failed");
    verifyBytes(backup, Buffer.from(await response.arrayBuffer()));
    const token = url.searchParams.get("token");
    if (!token) throw new Error("Signed token missing");
    const offset = Math.floor(token.length * 0.9);
    url.searchParams.set("token", token.slice(0, offset) + (token[offset] === "a" ? "b" : "a") + token.slice(offset + 1));
    const rejected = await boundedFetch(url);
    const invalidSignatureStatus = await denialResponse(rejected);
    const publicUrl = bucket.getPublicUrl(name).data.publicUrl;
    if (new URL(publicUrl).origin !== origin) throw new Error("Public target mismatch");
    const publicResponse = await boundedFetch(publicUrl);
    const publicStatus = await denialResponse(publicResponse);
    report.objects[index].denialStatuses = { anonymous: anonymousStatus, invalidSignature: invalidSignatureStatus, public: publicStatus };
  }
  report.signedAccessPassed = true;
  report.anonymousDenied = true;
  report.invalidSignatureDenied = true;
  report.backupAgeAtRestoreSeconds = (restoreStarted - backupStarted) / 1000;
  report.syntheticDataLossSeconds = 0;
  report.rtoSeconds = (Date.now() - restoreStarted) / 1000;
  report.passed = true;
} catch {
  report.error = "Local Storage recovery failed. Check local credentials, Storage and media encoders. Provider responses and signed URLs omitted.";
} finally {
  if (ownsBucket && service && bucket && /^kinevault-recovery-[a-f0-9-]{36}$/.test(bucketId)) {
    try {
      demand(await bucket.remove(paths));
      demand(await service.storage.deleteBucket(bucketId));
      report.cleanupPassed = true;
    } catch { report.cleanupPassed = false; }
  } else {
    report.cleanupPassed = !ownsBucket && !creationUncertain;
    if (creationUncertain) report.unconfirmedBucket = bucketId;
  }
  report.passed = report.passed && report.cleanupPassed;
  report.completedAt = new Date().toISOString();
  writeFileSync(join(directory, "storage-recovery.json"), JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify({ ...report, artifact: join(directory, "storage-recovery.json") }, null, 2));
process.exitCode = report.passed ? 0 : 1;
