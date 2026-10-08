import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect } from "@playwright/test";
import { hardwareProfileOptions, requireHardwareRenderer } from "../../scripts/lib/hardware-profile.mjs";
import { openWorkshopTool } from "../e2e/workshop-menu.helpers";
import { test } from "./workshop.fixture";

test.describe("separate hardware trace investigation", () => {
  test.skip(!process.env.HARDWARE_TRACE_SCENARIO, "Opt-in diagnostic trace, never part of budget timing");
  test("camera/linked comparison CPU and GPU command trace", async ({ page, request, hardwareFixture }) => {
    const options = hardwareProfileOptions(process.env);
    const scenario = process.env.HARDWARE_TRACE_SCENARIO;
    if (scenario !== "comparison" && scenario !== "camera") throw new Error("Trace scenario must be camera or comparison");
    const build = readFileSync(".next/BUILD_ID", "utf8").trim();
    expect(await (await request.get("/")).text()).toContain(build);
    await openWorkshopTool(page, "View");
    if (scenario === "comparison") await page.getByRole("button", { name: "Compare start and finish", exact: true }).click();
    else await page.getByRole("button", { name: "Play", exact: true }).click();
    const targets = page.locator('[data-anatomy-state="ready"]');
    await expect(targets).toHaveCount(scenario === "comparison" ? 2 : 1);
    const renderer = await targets.first().locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
      const gl = canvas.getContext("webgl2")!;
      const debug = gl.getExtension("WEBGL_debug_renderer_info");
      return String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    });
    requireHardwareRenderer(renderer, options.expectedRenderer);
    await page.waitForTimeout(3_000);
    const cdp = await page.context().newCDPSession(page);
    const completed = new Promise<string>(resolveStream => cdp.once("Tracing.tracingComplete", event => resolveStream(event.stream!)));
    await cdp.send("Tracing.start", {
      categories: "devtools.timeline,v8,blink,blink.user_timing,cc,gpu,disabled-by-default-devtools.timeline,disabled-by-default-v8.cpu_profiler",
      options: "record-as-much-as-possible", transferMode: "ReturnAsStream",
    });
    let gestures = 0;
    const started = Date.now();
    try {
      while (Date.now() - started < 10_000) {
        const canvas = targets.nth(gestures % (scenario === "comparison" ? 2 : 1)).locator("canvas");
        const bounds = (await canvas.boundingBox())!;
        const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
        await cdp.send("Runtime.evaluate", { expression: `performance.mark('hardware-input-${gestures}')` });
        await page.mouse.move(x, y);
        await page.mouse.down();
        try { await page.mouse.move(x + (gestures % 2 ? -60 : 60), y + (gestures % 2 ? -15 : 15), { steps: 30 }); }
        finally { await page.mouse.up(); }
        gestures++;
      }
    } finally { await cdp.send("Tracing.end"); }
    const stream = await completed;
    let trace = "";
    try {
      for (;;) {
        const chunk = await cdp.send("IO.read", { handle: stream });
        trace += chunk.base64Encoded ? Buffer.from(chunk.data, "base64").toString("utf8") : chunk.data;
        if (chunk.eof) break;
      }
    } finally { await cdp.send("IO.close", { handle: stream }); await cdp.detach(); }
    const directory = resolve(".local-artifacts/readiness/devices", `trace-${options.gpu}`, new Date().toISOString().replace(/[:.]/g, "-"), scenario);
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, "chrome-trace.json"), trace);
    writeFileSync(resolve(directory, "environment.json"), JSON.stringify({
      build, scenario, renderer, gpuRequest: options.gpu, gestures, fixtureDraftId: hardwareFixture.draftId,
      note: "Diagnostic trace has tracing overhead. GPU command-thread wall times are not GPU execution time. Input marks precede gesture dispatch and do not prove input-to-render latency.",
    }, null, 2));
    console.log(`Diagnostic trace: ${directory}`);
  });
});
