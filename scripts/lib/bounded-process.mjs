import { spawn } from "node:child_process";

// Wait for close after killing: the caller can safely remove frame/output files.
export function runProcess(executable, args, { timeoutMs = 120000, signal, label = "Encoder" } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new Error("Invalid process timeout");
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    let cancelled;
    const cancel = reason => {
      if (cancelled) return;
      cancelled = reason;
      child.kill("SIGKILL");
    };
    const abort = () => cancel(signal.reason ?? new Error(`${label} cancelled`));
    const timer = setTimeout(() => cancel(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    };
    signal?.addEventListener("abort", abort, { once: true });
    child.stderr.on("data", chunk => { stderr = (stderr + chunk.toString()).slice(-2000); });
    child.once("error", error => { cleanup(); reject(error); });
    child.once("close", code => {
      cleanup();
      if (cancelled) reject(cancelled);
      else if (code === 0) resolve();
      else reject(new Error(`${label} failed (${code}): ${stderr}`));
    });
    if (signal?.aborted) abort();
  });
}
