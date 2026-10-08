import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { openWorkshopTool, setWorkshopLanguage } from "../e2e/workshop-menu.helpers";

test("production route transfer, lazy anatomy and workshop resource baseline", async ({ page, context }) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname)) throw new Error("Local fixtures required");
  const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `performance-${randomUUID()}@example.test`, password = "PerformanceFixture2026!";
  const account = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  const errors: string[] = [];
  const result: Record<string, unknown> = { measuredAt: new Date().toISOString(), viewport: "1440×1000", renderer: "Chrome / SwiftShader", production: true };
  try {
    page.on("pageerror", error => errors.push(error.message));
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    const network = new Map<string, { url: string; mime: string; bytes: number }>();
    cdp.on("Network.responseReceived", event => network.set(event.requestId, { url: event.response.url, mime: event.response.mimeType, bytes: 0 }));
    cdp.on("Network.loadingFinished", event => { const item = network.get(event.requestId); if (item) item.bytes = event.encodedDataLength; });
    mkdirSync(".local-artifacts/efficiency-review", { recursive: true });
    const routes = ["/", "/exercises", "/exercises/cable-lateral-raise"];
    for (const route of routes) {
      network.clear();
      await page.goto(route, { waitUntil: "networkidle" });
      const measured = await page.evaluate(() => {
        const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
        const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
        return { requests: resources.length, jsBytes: resources.filter(item => /\.js(?:\?|$)/.test(item.name)).reduce((sum, item) => sum + item.encodedBodySize, 0),
          transferBytes: resources.reduce((sum, item) => sum + item.transferSize, 0),
          modelRequests: resources.filter(item => /\.glb(?:\?|$)/.test(item.name)).length,
          posterBytes: resources.filter(item => /\.webp(?:\?|$)/.test(item.name)).reduce((sum, item) => sum + item.encodedBodySize, 0),
          responseMs: Math.round(navigation.responseStart), domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
        };
      });
      const responses = [...network.values()];
      const posters = responses.filter(item => item.mime === "image/webp");
      const transfer = { requests: responses.length, bytes: responses.reduce((sum, item) => sum + item.bytes, 0),
        posterBytes: posters.reduce((sum, item) => sum + item.bytes, 0), largestPosterBytes: Math.max(0, ...posters.map(item => item.bytes)) };
      // CDP includes cross-origin image bytes hidden by Resource Timing without TAO headers.
      Object.assign(measured, { network: transfer });
      result[route] = measured;
      expect(measured.modelRequests, `${route} must not load anatomy until requested`).toBe(0);
      expect(measured.jsBytes, `${route} initial JS budget`).toBeLessThan(200_000);
      expect(transfer.requests, `${route} bounded initial requests`).toBeLessThan(65);
      for (const theme of ["light", "dark"]) for (const mobile of [false, true]) {
        await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
        await page.getByRole("button", { name: "Site menu", exact: true }).click();
        await page.getByRole("combobox", { name: "Appearance", exact: true }).selectOption(theme);
        await page.getByRole("button", { name: "Close menu", exact: true }).click();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const label = route === "/" ? "home" : route.split("/").filter(Boolean).join("-");
        await page.screenshot({ path: `.local-artifacts/efficiency-review/${label}-${mobile ? "mobile" : "desktop"}-${theme}.png`, fullPage: true });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await page.goto("/");
    const modelStart = Date.now();
    await page.getByRole("button", { name: "Try the movement viewer", exact: true }).click();
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    result.previewReadyMs = Date.now() - modelStart;
    await cdp.send("Performance.enable");
    const sample = async () => {
      const { metrics } = await cdp.send("Performance.getMetrics");
      return Object.fromEntries(metrics.map(item => [item.name, item.value]));
    };
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email); await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/my-exercises/new?metrics=1");
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    const closeTutorial = page.getByRole("button", { name: "Close tutorial", exact: true });
    if (await closeTutorial.isVisible()) await closeTutorial.click();
    await page.waitForTimeout(1000); // Let initial asset preparation and camera damping settle.
    const beforeIdle = await sample();
    await page.waitForTimeout(2000);
    const afterIdle = await sample();
    result.idleTaskMsPerSecond = Math.round((afterIdle.TaskDuration - beforeIdle.TaskDuration) * 500);
    result.workshopHeapBytes = afterIdle.JSHeapUsedSize;
    // Frame cadence is environment dependent, so record rather than enforce a GPU-specific threshold.
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    const play = page.getByRole("button", { name: "Play", exact: true });
    if (await play.isVisible()) await play.click();
    const profileDownload = page.waitForEvent("download", { timeout: 45_000 });
    await page.locator('[data-anatomy-state="ready"]').first().evaluate(element => {
      element.dispatchEvent(new CustomEvent("kinevault:profile", { detail: {
        device: "Automated software-renderer smoke", physical: false, scenario: "playback",
        workload: "blank-workshop-playback",
        build: "automation-smoke", durationMs: 30_000,
      } }));
    });
    const commitsBefore = await page.locator('[data-workshop-commits]').getAttribute("data-workshop-commits");
    const playbackStarted = Date.now();
    result.playbackFrames = await page.evaluate(() => new Promise(resolve => {
      const samples: number[] = []; let previous = performance.now();
      const frame = (now: number) => { samples.push(now - previous); previous = now;
        if (samples.length < 120) requestAnimationFrame(frame);
        else { samples.sort((a, b) => a - b); resolve({ medianMs: samples[60], p95Ms: samples[114], maximumMs: samples[119] }); }
      }; requestAnimationFrame(frame);
    }));
    const downloadedProfile = await profileDownload;
    await downloadedProfile.saveAs(".local-artifacts/efficiency-review/device-profile-smoke.json");
    const deviceProfile = JSON.parse((await page.locator('[data-device-profile]').first().getAttribute("data-device-profile"))!);
    expect(deviceProfile.physical).toBe(false);
    expect(deviceProfile.scenario).toBe("playback");
    expect(deviceProfile.workload).toBe("blank-workshop-playback");
    expect(deviceProfile.renderer).toBeTruthy();
    const renderSize = await page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => ({ width: canvas.width, height: canvas.height }));
    expect(deviceProfile.canvas).toMatchObject(renderSize);
    expect(deviceProfile.frames.frames).toBeGreaterThanOrEqual(120);
    expect(deviceProfile.valid).toBe(true);
    result.deviceProfileSmoke = deviceProfile;
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    const commitsAfter = await page.locator('[data-workshop-commits]').getAttribute("data-workshop-commits");
    const commitsPerSecond = (Number(commitsAfter) - Number(commitsBefore)) * 1000 / (Date.now() - playbackStarted);
    result.playbackReactCommits = { before: commitsBefore, after: commitsAfter, delta: Number(commitsAfter) - Number(commitsBefore), perSecond: commitsPerSecond };
    expect(commitsPerSecond).toBeLessThan(15);
    result.renderer = await page.locator('[data-anatomy-state="ready"]').first().evaluate(element => ({
      calls: element.getAttribute("data-render-calls"), geometries: element.getAttribute("data-render-geometries"),
      textures: element.getAttribute("data-render-textures"), solves: element.getAttribute("data-pose-solves"),
    }));
    expect(Number((result.renderer as { calls: string }).calls)).toBeLessThanOrEqual(4);
    expect(Number((result.renderer as { geometries: string }).geometries)).toBeLessThanOrEqual(4);
    // Demand canvases stop before the 250 ms metrics interval can publish the
    // final pause solve. Render a settled camera frame before the baseline.
    await page.getByRole("button", { name: "Zoom out", exact: true }).click();
    await page.waitForTimeout(500);
    const readyViewer = page.locator('[data-anatomy-state="ready"]').first();
    const solvesBeforeCamera = Number(await readyViewer.getAttribute("data-pose-solves"));
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await page.waitForTimeout(500);
    result.cameraOnlyPoseSolves = Number(await readyViewer.getAttribute("data-pose-solves")) - solvesBeforeCamera;
    expect(result.cameraOnlyPoseSolves).toBe(0);
    await page.screenshot({ path: ".local-artifacts/efficiency-review/workshop-desktop-dark.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: ".local-artifacts/efficiency-review/workshop-mobile-dark.png", fullPage: true });
    await openWorkshopTool(page, "View");
    await cdp.send("HeapProfiler.collectGarbage");
    const beforeComparison = await sample();
    await page.getByRole("button", { name: "Compare start and finish", exact: true }).click();
    await expect(page.locator('[data-anatomy-state="ready"]')).toHaveCount(2);
    await expect(page.getByRole("link", { name: "CC BY-SA 4.0", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.waitForTimeout(500);
    await cdp.send("HeapProfiler.collectGarbage");
    result.comparisonHeapBytes = (await sample()).JSHeapUsedSize;
    result.beforeComparisonHeapBytes = beforeComparison.JSHeapUsedSize;
    await page.screenshot({ path: ".local-artifacts/efficiency-review/comparison-mobile-dark.png", fullPage: true });
    for (const pose of ["Start", "Finish"]) await page.getByRole("region", { name: `${pose} pose comparison`, exact: true })
      .screenshot({ path: `.local-artifacts/efficiency-review/comparison-${pose.toLowerCase()}-mobile-dark.png` });
    await page.getByRole("button", { name: "Close comparison", exact: true }).click();
    await expect(page.locator('[data-anatomy-state="ready"]')).toHaveCount(1);
    await cdp.send("HeapProfiler.collectGarbage");
    result.afterComparisonHeapBytes = (await sample()).JSHeapUsedSize;
    expect(Number(result.afterComparisonHeapBytes) - Number(result.beforeComparisonHeapBytes)).toBeLessThan(3_000_000);
    for (const theme of ["light", "dark"]) for (const mobile of [false, true]) {
      await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
      await page.goto("/my-exercises");
      await page.getByRole("button", { name: "Site menu", exact: true }).click();
      await page.getByRole("combobox", { name: "Appearance", exact: true }).selectOption(theme);
      await page.getByRole("button", { name: "Close menu", exact: true }).click();
      await page.goto("/my-exercises/new?metrics=1");
      await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
      if (await closeTutorial.isVisible()) await closeTutorial.click();
      await setWorkshopLanguage(page, "en");
      await openWorkshopTool(page, "View");
      for (const language of ["en", "he"] as const) {
        await setWorkshopLanguage(page, language);
        if (language === "he") {
          await expect(page.getByRole("button", { name: "שמירה", exact: true })).toBeVisible();
          await expect(page.getByRole("button", { name: "קירוב", exact: true })).toBeVisible();
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: `.local-artifacts/efficiency-review/workshop-${mobile ? "mobile" : "desktop"}-${theme}-${language}.png`, fullPage: true });
      }
    }
    result.errors = errors;
    expect(errors).toEqual([]);
    writeFileSync(".local-artifacts/efficiency-review/browser-performance.json", JSON.stringify(result, null, 2));
  } catch (error) {
    writeFileSync(".local-artifacts/efficiency-review/browser-performance.json", JSON.stringify({ ...result, errors, failure: String(error) }, null, 2));
    throw error;
  } finally { await cleanupLocalFixture({ admin: service, userId: account.data.user.id, email, password }); }
});
