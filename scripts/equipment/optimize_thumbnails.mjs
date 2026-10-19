import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const folder = path.resolve(".local-artifacts/visual-rollout/equipment/thumbnails");
const outputFolder = path.resolve("public/models/equipment/thumbnails");
await mkdir(outputFolder, { recursive: true });
for (const file of await readdir(folder)) {
  if (!file.endsWith(".png")) continue;
  const source = path.join(folder, file);
  const output = path.join(outputFolder, file.replace(/\.png$/, ".webp"));
  await sharp(source).resize(384, 384).webp({ quality: 80, alphaQuality: 80, effort: 6 }).toFile(output);
}
