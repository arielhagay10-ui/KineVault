import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { shardSpecs, specMinutes } from "./e2e-shards.mjs";

const specs = readdirSync("tests/e2e").filter(name => name.endsWith(".spec.ts"));

test("every e2e spec runs in exactly one non-empty shard", () => {
  const shards = shardSpecs([...specs, "new-feature.spec.ts"], 5);
  assert.deepEqual(shards.flat().sort(), [...specs, "new-feature.spec.ts"].sort());
  assert.ok(shards.every(shard => shard.length > 0));
});

test("no shard runs much longer than the slowest spec or an even split", () => {
  const minutes = shardSpecs(specs, 5).map(shard => shard.reduce((sum, spec) => sum + specMinutes[spec], 0));
  const even = minutes.reduce((sum, value) => sum + value, 0) / minutes.length;
  const limit = Math.max(...specs.map(spec => specMinutes[spec]), even * 1.2);
  assert.ok(Math.max(...minutes) <= limit, `unbalanced shards: ${minutes.join(", ")}`);
});

test("the timing table only names existing specs", () => {
  assert.deepEqual(Object.keys(specMinutes).filter(name => !specs.includes(name)), []);
});
