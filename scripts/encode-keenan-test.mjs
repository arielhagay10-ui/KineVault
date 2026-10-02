import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import ffmpeg from "ffmpeg-static";

const directory = resolve(".local-artifacts/workshop/keenan-flaps");
for (const [name, rate] of [["demo", 20], ["slow", 10]]) {
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-framerate", String(rate),
    "-i", resolve(directory, "playback/frame-%04d.png"), "-vf", "scale=1080:-2", "-an",
    "-c:v", "libx264", "-preset", "medium", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", resolve(directory, `${name}.mp4`)], { stdio: "inherit" });
}
console.log(`Encoded normal and half-speed Keenan flaps under ${directory}`);
