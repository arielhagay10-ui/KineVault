// Prints the e2e spec paths for one CI shard: node scripts/e2e-shard.mjs <shard>/<total>
import { readdirSync } from "node:fs";
import { shardSpecs } from "./lib/e2e-shards.mjs";

const [shard, total] = (process.argv[2] ?? "").split("/").map(Number);
if (!Number.isInteger(shard) || !Number.isInteger(total) || shard < 1 || shard > total) {
  throw new Error("Usage: node scripts/e2e-shard.mjs <shard>/<total>");
}
const specs = shardSpecs(readdirSync("tests/e2e").filter(name => name.endsWith(".spec.ts")), total)[shard - 1];
// Playwright runs every spec when it gets no file filter.
if (!specs.length) throw new Error(`Shard ${shard}/${total} has no specs`);
console.log(specs.map(name => `tests/e2e/${name}`).join(" "));
