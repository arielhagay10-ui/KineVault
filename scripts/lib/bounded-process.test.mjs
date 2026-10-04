import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runProcess } from "./bounded-process.mjs";

test("a timed-out encoder exits before rejection and leaves no process running", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kinevault-process-test-"));
  try {
    const pidFile = join(directory, "pid");
    await assert.rejects(runProcess(process.execPath, ["-e",
      "require('fs').writeFileSync(process.argv[1], String(process.pid)); setInterval(() => {}, 1000)", pidFile,
    ], { timeoutMs: 500 }), /timed out/);
    const pid = Number(await readFile(pidFile, "utf8"));
    assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("cancellation terminates an encoder without waiting for its deadline", async () => {
  const controller = new AbortController();
  const operation = runProcess(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    timeoutMs: 30000, signal: controller.signal,
  });
  controller.abort(new Error("claim cancelled"));
  await assert.rejects(operation, /claim cancelled/);
});

test("a successful encoder resolves and reports bounded stderr on failure", async () => {
  await runProcess(process.execPath, ["-e", "process.exit(0)"], { timeoutMs: 5000 });
  await assert.rejects(runProcess(process.execPath, ["-e", "console.error('broken input'); process.exit(2)"], {
    timeoutMs: 5000,
  }), /\(2\).*broken input/s);
});
