import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cpus, platform, arch } from "node:os";
import { Group } from "three";
import { createAnatomyRig } from "../../src/lib/motion/anatomy";
import { createSupportSetup } from "../../src/lib/motion/support-setups";
import { createStudioObject } from "../../src/lib/motion/studio";
import { blankWorkshopScene } from "../../src/lib/motion/workshop";
import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { productionBuildMode } from "../helpers/workshop-performance";
import { dismissWorkshopTutorial, openWorkshopTool, setWorkshopLanguage } from "../e2e/workshop-menu.helpers";

test("production supports: three matched playback runs and camera solve reuse", async ({ page, request }) => {
  test.setTimeout(360_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("Support performance fixtures require local Supabase");
  const origin = new URL(process.env.PERFORMANCE_BASE_URL ?? "http://127.0.0.1:3000");
  if (!["localhost", "127.0.0.1"].includes(origin.hostname)) throw new Error("Support performance captures require a local production server");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const email = `support-performance-${randomUUID()}@example.test`, password = `SupportPerformance-${randomUUID()}!`;
  const directory = ".local-artifacts/supports/performance";
  mkdirSync(directory, { recursive: true });
  const errors: string[] = [], runs: Record<string, unknown>[] = [];
  const p95ByMode: Record<"baseline" | "anchored", number[]> = { baseline: [], anchored: [] };
  const result: Record<string, unknown> = { measuredAt: new Date().toISOString(), viewport: { width: 1440, height: 1000 },
    hardware: { cpu: cpus()[0]?.model, platform: platform(), arch: arch() }, physicalDeviceVerified: false,
    note: "Matched automated browser cadence only; renderer identity is recorded below. Software rendering does not establish physical GPU performance.", runs };
  let userId: string | undefined;
  try {
    const response = await request.get("/");
    expect(response.ok()).toBe(true);
    Object.assign(result, productionBuildMode(readFileSync(`${process.env.KINEVAULT_DIST_DIR ?? ".next"}/BUILD_ID`, "utf8"), await response.text()));
    const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (account.error) throw account.error;
    userId = account.data.user.id;
    const login = await owner.auth.signInWithPassword({ email, password });
    if (login.error) throw login.error;
    const rig = createAnatomyRig(new Group());
    const scene = structuredClone(blankWorkshopScene);
    scene.studio!.objects = [{ ...createStudioObject("bench", randomUUID(), 0), x: 0, z: 0 }];
    const anchored = (() => { try { return createSupportSetup(scene, "bench-hand-knee", rig); } finally { rig.dispose(); } })();
    const pose = anchored.keyframes[0].poses;
    anchored.durationMs = 2400;
    anchored.keyframes = [0, 1200, 2400].map((timeMs, index) => ({ timeMs, poses: { ...structuredClone(pose), "right-shoulder": { x: index === 1 ? -10 : -65, y: 0, z: 0 }, "right-elbow": { x: index === 1 ? 100 : 10, y: 0, z: 0 } } }));
    const baseline = structuredClone(anchored); baseline.studio!.supports = [];
    const ids: Record<string, string> = {};
    for (const [mode, fixture] of Object.entries({ baseline, anchored })) {
      const draft = await owner.rpc("save_workshop_draft", { p_scene: fixture, p_name: `Support performance ${mode}` });
      if (draft.error) throw draft.error;
      ids[mode] = draft.data;
    }
    result.fixtures = { baseline, anchored };
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    for (let run = 0; run < 3; run++) for (const mode of (run % 2 ? ["anchored", "baseline"] : ["baseline", "anchored"]) as ("baseline" | "anchored")[]) {
      await page.goto(`/my-exercises/${ids[mode]}/workshop?metrics=1`);
      await dismissWorkshopTutorial(page);
      await setWorkshopLanguage(page, "en");
      const viewer = page.locator('[data-anatomy-state="ready"]').first();
      await expect(viewer).toBeVisible({ timeout: 60_000 });
      await openWorkshopTool(page, "View");
      await page.getByLabel("Preview detail", { exact: true }).selectOption("economy");
      await expect(viewer).toHaveAttribute("data-anatomy-quality", "economy");
      await openWorkshopTool(page, "Item settings");
      await page.getByRole("button", { name: "Camera", exact: true }).click();
      await page.bringToFront();
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
      // Warm sixty frames for each mode before the independent 120-interval capture.
      await page.evaluate(() => new Promise<void>(resolve => { let count = 0; const tick = () => ++count >= 60 ? resolve() : requestAnimationFrame(tick); requestAnimationFrame(tick); }));
      const capture = await viewer.evaluate(element => new Promise<{
        intervals: number[]; p95Ms: number; elapsedMs: number; maximumCalls: number; before: { frames: number; solves: number; commits: number }; after: { frames: number; solves: number; commits: number };
        canvas: { width: number; height: number }; canvasAfter: { width: number; height: number }; hidden: boolean; renderer: string; vendor: string; softwareRenderer: boolean; userAgent: string; concurrency: number;
      }>(resolve => {
        const metric = (name: string) => { const value = element.getAttribute(name); if (value === null || !Number.isFinite(Number(value))) throw new Error(`Missing performance metric ${name}`); return Number(value); };
        const snapshot = () => { const commits = document.querySelector("[data-workshop-commits]")?.getAttribute("data-workshop-commits"); if (commits === null || commits === undefined) throw new Error("Missing React commit metric"); return { frames: metric("data-render-frames"), solves: metric("data-pose-solves"), commits: Number(commits) }; };
        const canvas = element.querySelector("canvas") ?? document.querySelector("canvas");
        if (!canvas) throw new Error("Missing workshop canvas");
        const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
        if (!gl) throw new Error("Missing WebGL renderer");
        const debug = gl.getExtension("WEBGL_debug_renderer_info");
        const renderer = String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
        const vendor = String(gl.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : gl.VENDOR));
        const size = { width: canvas.width, height: canvas.height }, before = snapshot(), intervals: number[] = [];
        let previous: number | undefined, started = 0, maximumCalls = metric("data-render-calls"), hidden = document.hidden;
        const tick = (now: number) => {
          if (previous !== undefined) intervals.push(now - previous); else started = now;
          previous = now; maximumCalls = Math.max(maximumCalls, metric("data-render-calls")); hidden ||= document.hidden;
          if (intervals.length < 120) requestAnimationFrame(tick);
          else { const sorted = [...intervals].sort((a, b) => a - b); resolve({ intervals, p95Ms: sorted[Math.ceil(sorted.length * .95) - 1], elapsedMs: now - started, maximumCalls, before, after: snapshot(), canvas: size, canvasAfter: { width: canvas.width, height: canvas.height }, hidden, renderer, vendor, softwareRenderer: /swiftshader|llvmpipe|software|microsoft basic render/i.test(renderer), userAgent: navigator.userAgent, concurrency: navigator.hardwareConcurrency }); }
        };
        requestAnimationFrame(tick);
      }));
      const commitsPerSecond = (capture.after.commits - capture.before.commits) * 1000 / capture.elapsedMs;
      const measurement = { run: run + 1, mode, ...capture, commitsPerSecond };
      runs.push(measurement); p95ByMode[mode].push(capture.p95Ms);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page.waitForTimeout(500);
      await page.getByRole("button", { name: "Zoom out", exact: true }).click();
      await page.waitForTimeout(500);
      const cameraBefore = Number(await viewer.getAttribute("data-pose-solves"));
      await page.getByRole("button", { name: "Zoom in", exact: true }).click();
      await page.waitForTimeout(500);
      const cameraOnlySolves = Number(await viewer.getAttribute("data-pose-solves")) - cameraBefore;
      Object.assign(measurement, { cameraOnlySolves });
      expect.soft(capture.intervals).toHaveLength(120);
      expect.soft(capture.hidden).toBe(false);
      expect.soft(capture.canvasAfter).toEqual(capture.canvas);
      expect.soft(capture.after.frames - capture.before.frames).toBeGreaterThan(0);
      expect.soft(capture.after.solves - capture.before.solves).toBeGreaterThan(0);
      expect.soft(capture.maximumCalls).toBeLessThan(900);
      expect.soft(commitsPerSecond).toBeLessThan(15);
      expect.soft(cameraOnlySolves).toBe(0);
    }
    const median = (values: number[]) => [...values].sort((a, b) => a - b)[1];
    const comparison = { baselineMedianP95Ms: median(p95ByMode.baseline), anchoredMedianP95Ms: median(p95ByMode.anchored), targetRatio: 1.10 };
    const ratio = comparison.anchoredMedianP95Ms / comparison.baselineMedianP95Ms;
    result.comparison = { ...comparison, ratio };
    expect(ratio, "Median of three matched p95 captures must regress by no more than 10%").toBeLessThanOrEqual(1.10);
    expect(errors).toEqual([]);
  } catch (error) { result.failure = String(error); throw error; }
  finally {
    try {
      writeFileSync(`${directory}/matched-browser.json`, JSON.stringify({ ...result, errors }, null, 2));
      await test.info().attach("supports-matched-browser", { path: `${directory}/matched-browser.json`, contentType: "application/json" });
    } finally {
      if (userId) { try { await page.close(); } finally { await cleanupLocalFixture({ admin, owner, userId, email, password }); } }
    }
  }
});
