import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect } from "@playwright/test";
import { test } from "../e2e/published-catalog.helpers";
import { dismissWorkshopTutorial, openWorkshopTool, setWorkshopLanguage } from "../e2e/workshop-menu.helpers";
import { performanceRenderBudgets, performanceWorkloadScene, productionBuildMode, type PerformanceWorkload } from "../helpers/workshop-performance";

test("verified production route transfer, lazy anatomy and workshop resource baseline", async ({ page, context, request, publishedCableRaise }) => {
  // Software CI needs time for 120 frame samples plus every comparison and view.
  test.setTimeout(240_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname)) throw new Error("Local fixtures required");
  const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `performance-${randomUUID()}@example.test`, password = "PerformanceFixture2026!";
  const account = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  const errors: string[] = [];
  const result: Record<string, unknown> = { measuredAt: new Date().toISOString(), viewport: "1440×1000", renderer: "Chrome / SwiftShader", production: false };
  mkdirSync(".local-artifacts/efficiency-review", { recursive: true });
  try {
    const response = await request.get("/");
    expect(response.ok()).toBe(true);
    Object.assign(result, productionBuildMode(readFileSync(`${process.env.KINEVAULT_DIST_DIR ?? ".next"}/BUILD_ID`, "utf8"), await response.text()));
    page.on("pageerror", error => errors.push(error.message));
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    const network = new Map<string, { url: string; mime: string; bytes: number }>();
    cdp.on("Network.responseReceived", event => network.set(event.requestId, { url: event.response.url, mime: event.response.mimeType, bytes: 0 }));
    cdp.on("Network.loadingFinished", event => { const item = network.get(event.requestId); if (item) item.bytes = event.encodedDataLength; });
    mkdirSync(".local-artifacts/efficiency-review", { recursive: true });
    const routes = ["/", "/exercises", `/exercises/${publishedCableRaise.slug}`];
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
    await page.goto(`/exercises/${publishedCableRaise.slug}`);
    const modelStart = Date.now();
    await page.getByRole("button", { name: "Inspect motion in 3D", exact: true }).click();
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    result.previewReadyMs = Date.now() - modelStart;
    await cdp.send("Performance.enable");
    const sample = async () => {
      const { metrics } = await cdp.send("Performance.getMetrics");
      return Object.fromEntries(metrics.map(item => [item.name, item.value]));
    };
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/my-exercises/new?metrics=1");
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    const closeTutorial = page.getByRole("button", { name: "Close tutorial", exact: true });
    if (await closeTutorial.isVisible()) await closeTutorial.click();
    // Comparison uses Contact while the software-rendered recorder uses Economy.
    // Warm both in this document so teardown measures instance cleanup, not the
    // first retained useGLTF source cache. Earlier page.goto calls discard caches.
    await openWorkshopTool(page, "View");
    await cdp.send("HeapProfiler.collectGarbage");
    result.beforeContactCacheHeapBytes = (await sample()).JSHeapUsedSize;
    await page.getByRole("combobox", { name: "Preview detail", exact: true }).selectOption("contact");
    await expect(page.locator('[data-anatomy-state="ready"]')).toHaveAttribute("data-anatomy-quality", "contact", { timeout: 60_000 });
    await cdp.send("HeapProfiler.collectGarbage");
    result.contactCacheHeapBytes = (await sample()).JSHeapUsedSize;
    // Auto changes pixel ratio in response to slow software-rendered frames,
    // which invalidates a device capture requiring fixed render dimensions.
    await page.getByRole("combobox", { name: "Preview detail", exact: true }).selectOption("economy");
    await expect(page.locator('[data-anatomy-state="ready"]')).toHaveAttribute("data-anatomy-quality", "economy");
    await page.waitForTimeout(1000); // Let initial asset preparation and camera damping settle.
    const beforeIdle = await sample();
    await page.waitForTimeout(2000);
    const afterIdle = await sample();
    result.idleTaskMsPerSecond = Math.round((afterIdle.TaskDuration - beforeIdle.TaskDuration) * 500);
    result.workshopHeapBytes = afterIdle.JSHeapUsedSize;
    // Frame cadence is environment dependent, so record rather than enforce a GPU-specific threshold.
    await page.bringToFront();
    const play = page.getByRole("button", { name: "Play", exact: true });
    await play.click();
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    const profileDownload = page.waitForEvent("download", { timeout: 45_000 });
    await page.locator('[data-anatomy-state="ready"]').first().evaluate((element, build) => {
      element.dispatchEvent(new CustomEvent("kinevault:profile", { detail: {
        device: "Automated software-renderer smoke", physical: false, scenario: "playback",
        workload: "blank-workshop-playback",
        build, durationMs: 30_000,
      } }));
    }, String(result.build));
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
    await test.info().attach("device-profile-smoke", { body: JSON.stringify(deviceProfile), contentType: "application/json" });
    expect(deviceProfile.physical).toBe(false);
    expect(deviceProfile.scenario).toBe("playback");
    expect(deviceProfile.workload).toBe("blank-workshop-playback");
    expect(deviceProfile.renderer).toBeTruthy();
    const renderSize = await page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => ({ width: canvas.width, height: canvas.height }));
    expect(deviceProfile.canvas).toMatchObject(renderSize);
    expect(deviceProfile.frames.frames).toBeGreaterThan(0);
    expect(deviceProfile.frames.elapsedMs).toBeGreaterThanOrEqual(10_000);
    expect(deviceProfile.captureState, "Keep the profiling page in front and its render dimensions fixed").toEqual({ hidden: false, resized: false });
    // Software CI can render fewer than 120 intervals in this window. Verify
    // that the recorder rejects that capture without imposing a GPU speed gate.
    expect(deviceProfile.valid).toBe(deviceProfile.frames.frames >= 120);
    if (deviceProfile.valid) expect(deviceProfile.reason).toBeNull();
    else expect(deviceProfile.reason).toContain("at least 120 intervals");
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
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(page.locator('[data-anatomy-state="ready"]')).toHaveCount(2, { timeout: 60_000 });
    await expect(page.getByRole("link", { name: "CC BY-SA 4.0", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.waitForTimeout(500);
    await cdp.send("HeapProfiler.collectGarbage");
    result.comparisonHeapBytes = (await sample()).JSHeapUsedSize;
    result.beforeComparisonHeapBytes = beforeComparison.JSHeapUsedSize;
    await page.screenshot({ path: ".local-artifacts/efficiency-review/comparison-mobile-dark.png", fullPage: true });
    for (const pose of ["Start", "Finish"]) await page.getByRole("region", { name: `${pose} pose comparison`, exact: true })
      .screenshot({ path: `.local-artifacts/efficiency-review/comparison-${pose.toLowerCase()}-mobile-dark.png` });
    await openWorkshopTool(page, "View");
    await page.getByRole("button", { name: "Close comparison", exact: true }).click();
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(page.locator('[data-anatomy-state="ready"]')).toHaveCount(1, { timeout: 60_000 });
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
      if (mobile) await page.getByRole("button", { name: "Preview", exact: true }).click();
      await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
      if (await closeTutorial.isVisible()) await closeTutorial.click();
      await setWorkshopLanguage(page, "en");
      await openWorkshopTool(page, "View");
      if (mobile) await page.getByRole("button", { name: "Preview", exact: true }).click();
      for (const language of ["en", "he"] as const) {
        await setWorkshopLanguage(page, language);
        if (language === "he") {
          await expect(page.getByRole("button", { name: "שמירת תרגיל", exact: true })).toBeVisible();
          await expect(page.getByRole("button", { name: "קירוב", exact: true })).toBeVisible();
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: `.local-artifacts/efficiency-review/workshop-${mobile ? "mobile" : "desktop"}-${theme}-${language}.png`, fullPage: true });
      }
    }
    result.errors = errors;
    expect(errors).toEqual([]);
  } catch (error) {
    result.failure = String(error);
    throw error;
  } finally {
    writeFileSync(".local-artifacts/efficiency-review/browser-performance.json", JSON.stringify({ ...result, errors }, null, 2));
    await cleanupLocalFixture({ admin: service, userId: account.data.user.id, email, password });
  }
});

for (const workload of ["blank", "held", "machine"] as const satisfies readonly PerformanceWorkload[]) {
  test(`production workshop ${workload}: independent rendering, solver and React budgets`, async ({ page, request }) => {
    test.setTimeout(120_000);
    const directory = ".local-artifacts/efficiency-review";
    mkdirSync(directory, { recursive: true });
    const result: Record<string, unknown> = { workload, measuredAt: new Date().toISOString(), production: false,
      renderer: "Chrome / SwiftShader", timing: "Rendered-frame cadence; software smoke, no hardware FPS claim" };
    const errors: string[] = [];
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname)) throw new Error("Local fixtures required");
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const email = `performance-${workload}-${randomUUID()}@example.test`, password = `Performance-${randomUUID()}!`;
    let userId: string | undefined;
    try {
      const response = await request.get("/");
      expect(response.ok()).toBe(true);
      const mode = productionBuildMode(readFileSync(`${process.env.KINEVAULT_DIST_DIR ?? ".next"}/BUILD_ID`, "utf8"), await response.text());
      Object.assign(result, mode);
      const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (account.error) throw account.error;
      userId = account.data.user.id;
      const login = await owner.auth.signInWithPassword({ email, password });
      if (login.error) throw login.error;
      const scene = performanceWorkloadScene(workload);
      const draft = await owner.rpc("save_workshop_draft", { p_scene: scene, p_name: `Performance ${workload} v1` });
      if (draft.error) throw draft.error;
      result.fixture = scene;
      page.on("pageerror", error => errors.push(error.message));
      await page.goto("/sign-in");
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL(/\/dashboard$/);
      await page.goto(`/my-exercises/${draft.data}/workshop?metrics=1`);
      await dismissWorkshopTutorial(page);
      const viewer = page.locator('[data-anatomy-state="ready"]');
      await expect(viewer).toBeVisible({ timeout: 60_000 });
      // Fix resolution for comparable captures. Auto's adaptive DPR intentionally
      // invalidates a device profile if its render dimensions change mid-capture.
      await openWorkshopTool(page, "View");
      await page.getByLabel("Preview detail", { exact: true }).selectOption("economy");
      await openWorkshopTool(page, "Equipment");
      await page.getByRole("button", { name: "Camera", exact: true }).click();
      await page.waitForTimeout(1000);
      const sample = () => viewer.evaluate(element => {
        const number = (name: string) => {
          const value = element.getAttribute(name);
          if (value === null || !Number.isFinite(Number(value))) throw new Error(`Missing numeric performance metric: ${name}`);
          return Number(value);
        };
        return { at: performance.now(), calls: number("data-render-calls"), geometries: number("data-render-geometries"),
          textures: number("data-render-textures"), solves: number("data-pose-solves"), solveMs: number("data-pose-solve-ms"),
          frames: number("data-render-frames"), commits: Number(document.querySelector("[data-workshop-commits]")?.getAttribute("data-workshop-commits")),
          quality: element.getAttribute("data-anatomy-quality") };
      });
      const idleBefore = await sample();
      await page.waitForTimeout(1000);
      const idleAfter = await sample();
      result.idle = { before: idleBefore, after: idleAfter };
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
      await page.waitForTimeout(1000);
      const before = await sample();
      result.playback = { before };
      const profileDownload = page.waitForEvent("download", { timeout: 45_000 });
      await viewer.evaluate((element, detail) => element.dispatchEvent(new CustomEvent("kinevault:profile", { detail })), {
        device: "Automated software-renderer smoke", physical: false, scenario: "playback", workload: `${workload}-workshop-v1`,
        build: mode.build, durationMs: 20_000,
      });
      await (await profileDownload).saveAs(`${directory}/${workload}-device-profile.json`);
      const after = await sample();
      const profile = JSON.parse((await viewer.getAttribute("data-device-profile"))!);
      const elapsedSeconds = (after.at - before.at) / 1000;
      const solves = after.solves - before.solves, frames = after.frames - before.frames;
      const commits = after.commits - before.commits;
      const solver = { solves, elapsedMs: after.solveMs - before.solveMs, solvesPerFrame: solves / frames,
        msPerSolve: solves ? (after.solveMs - before.solveMs) / solves : 0 };
      const react = { commits, commitsPerSecond: commits / elapsedSeconds };
      result.playback = { before, after, elapsedSeconds, frames, solver, react, profile };
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page.waitForTimeout(500);
      // Publish a settled pause frame before checking camera-only solve reuse.
      await page.getByRole("button", { name: "Zoom out", exact: true }).click();
      await page.waitForTimeout(500);
      const cameraBefore = await sample();
      await page.getByRole("button", { name: "Zoom in", exact: true }).click();
      await page.waitForTimeout(500);
      const cameraAfter = await sample();
      result.camera = { before: cameraBefore, after: cameraAfter };
      await page.screenshot({ path: `${directory}/${workload}-workload.png` });
      // Collect every measurement before asserting any performance budget.
      expect(idleAfter.solves - idleBefore.solves, "idle must reuse the pose").toBe(0);
      expect(profile.physical).toBe(false);
      expect(profile.workload).toBe(`${workload}-workshop-v1`);
      expect(profile.frames?.frames).toBeGreaterThan(0);
      expect(profile.valid).toBe(!profile.hidden && !profile.resized && profile.frames.frames >= 120 && profile.frames.elapsedMs >= 10_000);
      expect(profile.valid, "capture must collect 120 foreground intervals with stable dimensions").toBe(true);
      expect(frames).toBeGreaterThan(0);
      expect(solves).toBeGreaterThan(0);
      expect(solver.solvesPerFrame, "at most one anatomy pose solve per rendered frame").toBeLessThanOrEqual(1);
      expect(solver.elapsedMs).toBeGreaterThan(0);
      expect(solver.elapsedMs, "solver time cannot exceed elapsed wall time").toBeLessThanOrEqual(elapsedSeconds * 1000);
      expect(react.commitsPerSecond, "playback must not commit the editor shell every frame").toBeLessThan(1);
      expect(profile.maximumCalls).toBeLessThanOrEqual(performanceRenderBudgets[workload].calls);
      expect(after.geometries).toBeLessThanOrEqual(performanceRenderBudgets[workload].geometries);
      expect(cameraAfter.solves - cameraBefore.solves, "camera-only frames must reuse the solved pose").toBe(0);
      expect(errors).toEqual([]);
    } catch (error) {
      result.failure = String(error);
      throw error;
    } finally {
      writeFileSync(`${directory}/${workload}-performance.json`, JSON.stringify({ ...result, errors }, null, 2));
      if (userId) {
        try { await page.close(); }
        finally { await cleanupLocalFixture({ admin, userId, email, password, owner }); }
      }
    }
  });
}
