import { chromium } from "@playwright/test";
import ffmpegStatic from "ffmpeg-static";
import { spawn } from "node:child_process";
import { join } from "node:path";

function encode(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.FFMPEG_PATH ?? ffmpegStatic, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", chunk => { stderr = (stderr + chunk.toString()).slice(-2000); });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve() : reject(new Error(`FFmpeg failed (${code}): ${stderr}`)));
  });
}

export async function captureMotion({ scene, pageUrl, token, directory }) {
  if (!Number.isInteger(scene.durationMs) || scene.durationMs < 250 || scene.durationMs > 12000) throw new Error("Invalid scene duration");
  const browser = await chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "chrome" } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader"] });
  try {
    const page = await browser.newPage({ viewport: { width: 640, height: 640 }, deviceScaleFactor: 1 });
    await page.setExtraHTTPHeaders({ "x-kinevault-render-token": token });
    const response = await page.goto(pageUrl, { waitUntil: "networkidle" });
    if (response?.status() !== 200) throw new Error(`Render page returned ${response?.status() ?? "no response"}`);
    await page.waitForFunction(() => typeof window.kinevaultRenderFrame === "function");
    await page.locator('#render-frame [data-anatomy-state="ready"]').waitFor({ timeout: 60000 });
    const frameCount = Math.ceil(scene.durationMs * 24 / 1000) + 1;
    for (let index = 0; index < frameCount; index++) {
      await page.evaluate(async time => {
        window.kinevaultRenderFrame(time);
        await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
      }, Math.round(index * scene.durationMs / (frameCount - 1)));
      await page.locator("#render-frame").screenshot({ path: join(directory, `frame-${String(index).padStart(4, "0")}.png`) });
    }
    const frames = join(directory, "frame-%04d.png");
    const webm = join(directory, "demo.webm"), mp4 = join(directory, "demo.mp4"), poster = join(directory, "poster.webp");
    await encode(["-framerate", "24", "-i", frames, "-an", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34", "-pix_fmt", "yuv420p", webm]);
    await encode(["-framerate", "24", "-i", frames, "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "25", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4]);
    await encode(["-i", join(directory, `frame-${String(Math.floor((frameCount - 1) * 0.4)).padStart(4, "0")}.png`), "-frames:v", "1", "-c:v", "libwebp", "-quality", "82", poster]);
    return { webm, mp4, poster };
  } finally { await browser.close(); }
}
