import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captureMotion } from "./capture-motion.mjs";

test("a stalled capture is cancelled and the next isolated capture encodes all outputs", { timeout: 15000 }, async () => {
  const server = createServer((request, response) => {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<div id="render-frame" style="width:640px;height:640px;background:#999">
      <span data-anatomy-state="ready">Render fixture</span></div><script>
      window.kinevaultRenderFrame = ${request.url === "/stalled"
        ? "() => { while (true) {} }"
        : "time => { document.querySelector('#render-frame').style.background = time ? '#aaa' : '#999'; }"};
      </script>`);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const directory = await mkdtemp(join(tmpdir(), "kinevault-capture-test-"));
  const url = `http://127.0.0.1:${server.address().port}`;
  let timedOutMetrics;
  let successfulMetrics;
  try {
    await assert.rejects(captureMotion({ scene: { durationMs: 250 }, pageUrl: `${url}/stalled`,
      token: "local-test-token", directory, timeoutMs: 2500,
      onMetrics: metrics => { timedOutMetrics = metrics; },
    }), /Capture timed out/);
    assert.ok(timedOutMetrics.totalMs < 6000, "browser cleanup must remain bounded");
    const files = await captureMotion({ scene: { durationMs: 250 }, pageUrl: `${url}/ready`,
      token: "local-test-token", directory, timeoutMs: 10000,
      onMetrics: metrics => { successfulMetrics = metrics; },
    });
    for (const file of Object.values(files)) assert.ok((await stat(file)).size > 0);
    assert.equal(successfulMetrics.frameCount, 7);
    for (const phase of ["browserLaunchMs", "pageReadyMs", "captureMs", "webmMs", "mp4Ms", "posterMs"]) {
      assert.ok(successfulMetrics[phase] >= 0, `missing ${phase}`);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});

test("an already cancelled claim never starts its capture", async () => {
  await assert.rejects(captureMotion({ scene: { durationMs: 250 }, pageUrl: "http://127.0.0.1:1",
    token: "unused", directory: tmpdir(), signal: AbortSignal.abort(new Error("expired claim")),
  }), /expired claim/);
});
