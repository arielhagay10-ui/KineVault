import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Locator, type Page } from "@playwright/test";
import { calibrateDeviceCaptures, checkDeviceBudget } from "../../src/lib/motion/device-profile";
import { hardwareProfileOptions, requireHardwareRenderer } from "../../scripts/lib/hardware-profile.mjs";
import { openWorkshopTool } from "../e2e/workshop-menu.helpers";
import { fixtureWorkload, test } from "./workshop.fixture";

type Capture = { renderer: string; valid: boolean; reason: string | null; frames: { p95Ms: number }; captureId: string };
const durationMs = 15_000;
const measurementSession = new Date().toISOString().replace(/[:.]/g, "-");

async function orbit(page: Page, canvas: Locator, direction: number) {
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Visible canvas required");
  const x = bounds.x + bounds.width * 0.5, y = bounds.y + bounds.height * 0.5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  try { await page.mouse.move(x + direction * 60, y + direction * 15, { steps: 30 }); }
  finally { await page.mouse.up(); }
}

for (const scenario of ["playback", "comparison", "camera", "selection"] as const) {
  test(`warm hardware workshop ${scenario}`, async ({ page, request, browser, hardwareFixture }) => {
    const options = hardwareProfileOptions(process.env);
    const build = readFileSync(".next/BUILD_ID", "utf8").trim();
    const response = await request.get("/");
    expect(response.ok(), "Production origin must respond").toBe(true);
    expect(await response.text(), "Origin must serve the current production build ID").toContain(build);
    const directory = resolve(".local-artifacts/readiness/devices", `workshop-${options.gpu}`, measurementSession, scenario);
    mkdirSync(directory, { recursive: true });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const cdp = await browser.newBrowserCDPSession();
    const gpuInfo = await cdp.send("SystemInfo.getInfo");
    await cdp.detach();
    await openWorkshopTool(page, scenario === "selection" ? "Position" : "View");
    if (scenario === "comparison") {
      await page.getByRole("button", { name: "Compare start and finish", exact: true }).click();
      await expect(page.locator('[data-anatomy-state="ready"]')).toHaveCount(2);
    } else {
      await page.getByRole("button", { name: "Camera", exact: true }).click();
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    }
    const targets = page.locator('[data-anatomy-state="ready"]');
    const canvasCount = scenario === "comparison" ? 2 : 1;
    await expect(targets).toHaveCount(canvasCount);
    const verifiedRenderers: string[] = [];
    for (let index = 0; index < canvasCount; index++) {
      const renderer = await targets.nth(index).locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
        const gl = canvas.getContext("webgl2");
        if (!gl) throw new Error("Existing WebGL2 renderer required");
        const debug = gl.getExtension("WEBGL_debug_renderer_info");
        return String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
      });
      verifiedRenderers.push(renderer);
    }
    writeFileSync(resolve(directory, "renderer-probe.json"), JSON.stringify({
      build, gpuRequest: options.gpu, launchArgs: options.launchArgs, expectedRenderer: options.expectedRenderer,
      browserVersion: browser.version(), gpu: gpuInfo.gpu, renderers: verifiedRenderers,
    }, null, 2));
    for (const renderer of verifiedRenderers) requireHardwareRenderer(renderer, options.expectedRenderer);
    await page.waitForTimeout(3_000);
    if (scenario === "comparison") await orbit(page, targets.first().locator("canvas"), 1);
    await page.screenshot({ path: resolve(directory, "workload.png") });
    const environment = {
      build, device: options.device, gpuRequest: options.gpu, launchArgs: options.launchArgs,
      browserVersion: browser.version(), gpu: gpuInfo.gpu, verifiedRenderers,
      fixture: fixtureWorkload, fixtureDraftId: hardwareFixture.draftId,
      mode: "Installed Chrome headless on local hardware; operator attested physical host",
      conditions: process.env.HARDWARE_CONDITIONS ?? "Power/thermal conditions uncontrolled; Parsec virtual display",
      comparisonLimitation: scenario === "comparison" ? "Fixed start/finish poses with continuous linked camera drags; each canvas measured separately; no aggregate GPU execution time or playback claim" : null,
      selectionLimitation: scenario === "selection" ? "Equipment selection pauses playback by design; each actual selection is followed by Play" : null,
    };
    writeFileSync(resolve(directory, "environment.json"), JSON.stringify(environment, null, 2));
    const captures: Capture[][] = Array.from({ length: canvasCount }, () => []);
    for (let run = 1; run <= 3; run++) {
      const beforeCamera = await targets.evaluateAll(elements => elements.map(element => element.getAttribute("data-camera-position")));
      const beforeSolves = await targets.first().getAttribute("data-pose-solves");
      await targets.evaluateAll((elements, detail) => elements.forEach((element, index) => {
        element.dispatchEvent(new CustomEvent("kinevault:profile", { detail: { ...detail,
          workload: `${detail.workload}-${elements.length === 1 ? "single" : index === 0 ? "start" : "finish"}` } }));
      }), { device: options.device, physical: true, scenario, workload: `${fixtureWorkload}-${scenario}`, build, durationMs });
      const started = Date.now();
      let gestures = 0;
      while (Date.now() - started < durationMs + 100) {
        if (scenario === "camera" || scenario === "comparison") {
          await orbit(page, targets.nth(gestures % canvasCount).locator("canvas"), gestures % 2 ? -1 : 1);
          gestures++;
        } else if (scenario === "selection") {
          const equipment = page.getByRole("combobox", { name: "Selected equipment", exact: true });
          await equipment.selectOption({ label: gestures % 2 ? "Anatomical figure" : "Dumbbell" });
          await expect(equipment.locator("option:checked")).toHaveText(gestures % 2 ? "Anatomical figure" : "Dumbbell");
          await page.getByRole("button", { name: "Play", exact: true }).click();
          await page.waitForTimeout(700);
          gestures++;
        } else await page.waitForTimeout(500);
      }
      await expect.poll(async () => targets.evaluateAll(elements => elements.every(element => !!element.getAttribute("data-device-profile")))).toBe(true);
      const results = await targets.evaluateAll(elements => elements.map(element => JSON.parse(element.getAttribute("data-device-profile")!))) as Capture[];
      const afterCamera = await targets.evaluateAll(elements => elements.map(element => element.getAttribute("data-camera-position")));
      const afterSolves = await targets.first().getAttribute("data-pose-solves");
      const evidence = { run, gestures, beforeCamera, afterCamera, beforeSolves, afterSolves };
      writeFileSync(resolve(directory, `run-${run}-interaction.json`), JSON.stringify(evidence, null, 2));
      if (scenario === "camera" || scenario === "comparison") {
        expect(gestures).toBeGreaterThan(2);
        expect(afterCamera).not.toEqual(beforeCamera);
      }
      if (scenario !== "comparison") expect(Number(afterSolves)).toBeGreaterThan(Number(beforeSolves));
      for (const [index, result] of results.entries()) {
        writeFileSync(resolve(directory, `canvas-${index + 1}-run-${run}.json`), JSON.stringify(result, null, 2));
        expect(result.valid, result.reason ?? "capture invalid").toBe(true);
        requireHardwareRenderer(result.renderer, options.expectedRenderer);
        captures[index].push(result);
      }
    }
    for (const [index, runs] of captures.entries()) {
      const proposal = calibrateDeviceCaptures(runs);
      const summary = scenario === "comparison" ? { ...proposal,
        status: "held", p95Ms: null, needsLodEvaluation: null, renderingBudgetEligible: false,
        interpretation: "Demand-render cadence includes driver/input gaps; not rendering cost, GPU execution time, 30Hz capability or a LOD decision",
      } : proposal;
      const summaryName = scenario === "comparison" ? "cadence-summary" : "budget-proposal";
      writeFileSync(resolve(directory, `canvas-${index + 1}-${summaryName}.json`), JSON.stringify(summary, null, 2));
      if (process.env.HARDWARE_BUDGET_DIR && scenario !== "comparison") {
        const budgetFile = resolve(process.env.HARDWARE_BUDGET_DIR, `${scenario}-canvas-${index + 1}.json`);
        const checked = checkDeviceBudget(runs, JSON.parse(readFileSync(budgetFile, "utf8")));
        writeFileSync(resolve(directory, `canvas-${index + 1}-budget-check.json`), JSON.stringify(checked, null, 2));
        expect(checked.passed, `p95 ${checked.observedP95Ms} ms exceeds approved ${checked.budgetP95Ms} ms`).toBe(true);
      }
    }
    expect(errors).toEqual([]);
    console.log(`Hardware captures: ${directory}`);
  });
}
