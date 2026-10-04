import { chromium } from "@playwright/test";
import ffmpegStatic from "ffmpeg-static";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { runProcess } from "./bounded-process.mjs";

function encode(args, options) {
  return runProcess(process.env.FFMPEG_PATH ?? ffmpegStatic,
    ["-hide_banner", "-loglevel", "error", "-y", ...args], { ...options, label: "FFmpeg" });
}

export async function captureMotion({ scene, pageUrl, token, directory, signal: parentSignal,
  timeoutMs = 480000, encodeTimeoutMs = 120000, onMetrics }) {
  if (!Number.isInteger(scene.durationMs) || scene.durationMs < 250 || scene.durationMs > 12000) throw new Error("Invalid scene duration");
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 480000) throw new Error("Invalid capture timeout");
  const deadline = new AbortController();
  const signal = parentSignal ? AbortSignal.any([parentSignal, deadline.signal]) : deadline.signal;
  const timer = setTimeout(() => deadline.abort(new Error(`Capture timed out after ${timeoutMs}ms`)), timeoutMs);
  const metrics = { durationMs: scene.durationMs, frameCount: 0 };
  const started = performance.now();
  let browser;
  let closing;
  const close = () => {
    if (browser && !closing) closing = browser.close();
    return closing;
  };
  signal.addEventListener("abort", close, { once: true });
  const phase = async (name, operation) => {
    signal.throwIfAborted();
    const start = performance.now();
    try { return await operation(); }
    finally { metrics[name] = Math.round(performance.now() - start); }
  };
  try {
    browser = await phase("browserLaunchMs", () => chromium.launch({ headless: true,
      timeout: Math.min(timeoutMs, 30000), ...(process.platform === "win32" ? { channel: "chrome" } : {}),
      args: ["--use-gl=angle", "--use-angle=swiftshader"] }));
    signal.throwIfAborted();
    // Each job owns an isolated browser context, including its render token.
    const context = await browser.newContext({ viewport: { width: 640, height: 640 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.setExtraHTTPHeaders({ "x-kinevault-render-token": token });
    await phase("pageReadyMs", async () => {
      const response = await page.goto(pageUrl, { waitUntil: "networkidle", timeout: 60000 });
      if (response?.status() !== 200) throw new Error(`Render page returned ${response?.status() ?? "no response"}`);
      await page.waitForFunction(() => typeof window.kinevaultRenderFrame === "function");
      await page.locator('#render-frame [data-anatomy-state="ready"]').waitFor({ timeout: 60000 });
    });
    const frameCount = Math.ceil(scene.durationMs * 24 / 1000) + 1;
    metrics.frameCount = frameCount;
    await phase("captureMs", async () => {
      for (let index = 0; index < frameCount; index++) {
        signal.throwIfAborted();
        await page.evaluate(async time => {
          window.kinevaultRenderFrame(time);
          await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
        }, Math.round(index * scene.durationMs / (frameCount - 1)));
        await page.locator("#render-frame").screenshot({ path: join(directory, `frame-${String(index).padStart(4, "0")}.png`) });
      }
    });
    const frames = join(directory, "frame-%04d.png");
    const webm = join(directory, "demo.webm"), mp4 = join(directory, "demo.mp4"), poster = join(directory, "poster.webp");
    const options = { signal, timeoutMs: encodeTimeoutMs };
    await phase("webmMs", () => encode(["-framerate", "24", "-i", frames, "-an", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34", "-pix_fmt", "yuv420p", webm], options));
    await phase("mp4Ms", () => encode(["-framerate", "24", "-i", frames, "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "25", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4], options));
    await phase("posterMs", () => encode(["-i", join(directory, `frame-${String(Math.floor((frameCount - 1) * 0.4)).padStart(4, "0")}.png`), "-frames:v", "1", "-c:v", "libwebp", "-quality", "82", poster], options));
    return { webm, mp4, poster };
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", close);
    await close();
    metrics.totalMs = Math.round(performance.now() - started);
    onMetrics?.(metrics);
  }
}
