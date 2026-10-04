import { test } from "node:test";
import assert from "node:assert/strict";
import { failRenderClaim } from "./fail-render.mjs";

function fixture(status, failureError = null) {
  const files = new Set(["claim/demo.webm", "claim/demo.mp4", "claim/poster.webp"]);
  const state = { status };
  const client = {
    rpc: async (name, args) => {
      assert.equal(name, "fail_render_job");
      assert.deepEqual(args, { p_job_id: "job", p_claim_id: "claim", p_error_code: "render_error" });
      if (failureError) return { error: failureError };
      if (state.status !== "running") return { error: { message: "render claim is expired or no longer current" } };
      state.status = "queued";
      return { error: null };
    },
    storage: { from: bucket => {
      assert.equal(bucket, "exercise-private");
      return { remove: async paths => { for (const path of paths) files.delete(path); return { error: null }; } };
    } },
  };
  return { client, files, state, paths: [...files] };
}

const job = { job_id: "job", claim_id: "claim" };

test("a committed render keeps referenced outputs after its completion response is lost", async () => {
  const value = fixture("succeeded");
  const error = await failRenderClaim(value.client, job, value.paths);
  assert.match(error.message, /no longer current/);
  assert.equal(value.state.status, "succeeded");
  assert.equal(value.files.size, 3);
});

test("an uncertain failure callback retains outputs for reconciliation", async () => {
  const value = fixture("running", { message: "network timeout" });
  const error = await failRenderClaim(value.client, job, value.paths);
  assert.equal(error.message, "network timeout");
  assert.equal(value.files.size, 3);
});

test("a confirmed failure queues a retry and removes only that claim's outputs", async () => {
  const value = fixture("running");
  assert.equal(await failRenderClaim(value.client, job, value.paths), null);
  assert.equal(value.state.status, "queued");
  assert.equal(value.files.size, 0);
});
