import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { redactEvidence } from "./lib/redact-evidence.mjs";

export function requireLoopbackOrigin(value) {
  const origin = new URL(value);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) || !["http:", "https:"].includes(origin.protocol)
    || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("Firefox fixtures require a bare loopback origin");
  }
  return origin.origin;
}

export function redactFirefoxEvidence(value) {
  return redactEvidence(value);
}

export function removeFirefoxProfile(directory) {
  const run = resolve(directory);
  if (dirname(run) !== resolve(".local-artifacts", "firefox-installed")
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(basename(run))) {
    throw new Error("Profile cleanup requires a generated Firefox artifact directory");
  }
  const profile = join(run, "profile");
  if (!existsSync(profile)) return;
  const resolvedProfile = realpathSync(profile);
  if (resolvedProfile !== join(realpathSync(run), "profile")) throw new Error("Disposable profile resolved outside its exact run path");
  rmSync(resolvedProfile, { recursive: true, force: true });
}

export function parseFirefoxOptions(args) {
  const values = { origin: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001",
    firefox: process.env.FIREFOX_EXECUTABLE ?? "C:/Program Files/Mozilla Firefox/firefox.exe", "timeout-seconds": "600" };
  const seen = new Set();
  for (const arg of args) {
    const match = /^--(origin|firefox|timeout-seconds)=(.+)$/.exec(arg);
    if (!match || seen.has(match[1])) throw new Error("Invalid or duplicate Firefox check option");
    seen.add(match[1]);
    values[match[1]] = match[2];
  }
  const origin = requireLoopbackOrigin(values.origin);
  const timeoutSeconds = Number(values["timeout-seconds"]);
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 60 || timeoutSeconds > 900) throw new Error("Firefox timeout must be 60..900 seconds");
  return { origin, executablePath: resolve(values.firefox), timeoutSeconds };
}

async function checkFirefox(options) {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const destination = new URL(requireLoopbackOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL));
  if (!existsSync(options.executablePath)) throw new Error("Firefox executable unavailable; provide --firefox=/absolute/path");
  // Node 24 strips the types; resolve this repository's extensionless TS imports.
  const hook = registerHooks({ resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (error.code === "ERR_MODULE_NOT_FOUND" && specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
        return nextResolve(specifier + ".ts", context);
      }
      throw error;
    }
  } });
  const [{ default: puppeteer }, { createClient }, { PerspectiveCamera, Vector3 }, { blankWorkshopScene }, { createStudioObject },
    { fitWorkshopCamera }, { cleanupLocalFixture }] = await Promise.all([
    import("puppeteer-core"), import("@supabase/supabase-js"), import("three"), import("../src/lib/motion/workshop.ts"),
    import("../src/lib/motion/studio.ts"), import("../src/lib/motion/workshop-camera.ts"), import("../tests/helpers/local-fixtures.ts"),
  ]);
  hook.deregister();
  const directory = resolve(".local-artifacts", "firefox-installed", randomUUID());
  const profile = join(directory, "profile");
  mkdirSync(profile, { recursive: true });
  const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
  const report = { schemaVersion: 1, startedAt: new Date().toISOString(), origin: options.origin,
    executablePath: options.executablePath, protocol: "WebDriver BiDi", checks: [], scans: [], passed: false,
    scope: "Installed Firefox, desktop keyboard/pointer and local fixture; excludes physical touch, screen readers and remote deployment" };
  const save = () => writeFileSync(join(directory, "results.json"), redactFirefoxEvidence(report) + "\n");
  const admin = createClient(destination.origin, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const owner = createClient(destination.origin, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const email = `firefox-readiness-${randomUUID()}@example.test`;
  const password = `Firefox-${randomUUID()}!`;
  let account;
  let browser;
  let page;
  const pageErrors = [];
  try {
    browser = await puppeteer.launch({ browser: "firefox", protocol: "webDriverBiDi", executablePath: options.executablePath,
      headless: true, userDataDir: profile, timeout: 30000, signal: AbortSignal.timeout(options.timeoutSeconds * 1000),
      env: Object.fromEntries(["PATH", "Path", "SystemRoot", "TEMP", "TMP", "APPDATA", "LOCALAPPDATA", "USERPROFILE",
        "HOME", "DISPLAY", "XAUTHORITY"].filter(key => process.env[key]).map(key => [key, process.env[key]])),
      defaultViewport: { width: 1440, height: 1000 }, dumpio: false });
    report.browserVersion = await browser.version();
    report.userAgent = await browser.userAgent();
    page = await browser.newPage();
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(30000);
    page.on("pageerror", error => pageErrors.push(error.message));
    const resetPage = async () => {
      const previous = page;
      page = await browser.newPage();
      page.setDefaultTimeout(15000);
      page.setDefaultNavigationTimeout(30000);
      page.on("pageerror", error => pageErrors.push(error.message));
      await previous.close();
    };
    const go = async path => {
      await page.goto(options.origin + path, { waitUntil: "networkidle2" });
      // ThemeControl enables this only after React hydrates, including on warm navigations.
      await page.waitForSelector('select[aria-label="Appearance"]:not([disabled])');
      // Native Tab can enter Firefox chrome. Activate the document before subsequent key input.
      if (!await page.evaluate(() => document.hasFocus())) await page.mouse.click(1, 1);
    };
    const element = async (name, selector = "button") => {
      const found = await page.waitForFunction((name, selector) => [...document.querySelectorAll(selector)].find(el =>
        (el.getAttribute("aria-label") === name || el.textContent.trim() === name) && el.getBoundingClientRect().width > 0),
      { polling: 100 }, name, selector);
      return found.asElement();
    };
    const press = async name => {
      const button = await element(name);
      await page.bringToFront();
      if (!await page.evaluate(() => document.hasFocus())) await page.mouse.click(1, 1);
      await button.focus();
      assert.equal(await button.evaluate(button => document.activeElement === button), true, `${name}: native keyboard trigger focus`);
      await page.keyboard.press("Enter");
      return button;
    };
    const click = async (name, selector) => (await element(name, selector)).click();
    const tab = async reverse => {
      if (reverse) await page.keyboard.down("Shift");
      try { await page.keyboard.press("Tab"); }
      finally { if (reverse) await page.keyboard.up("Shift"); }
    };
    const assertFocus = async (label, modal = true) => {
      const state = await page.evaluate(label => {
        const dialog = [...document.querySelectorAll("dialog[open]")].find(dialog =>
          (dialog.getAttribute("aria-label") || dialog.getAttribute("aria-labelledby")?.split(/\s+/)
            .map(id => document.getElementById(id)?.textContent.trim()).join(" ")) === label);
        return { modal: dialog?.matches(":modal") === true,
          contained: document.activeElement === document.body || dialog?.contains(document.activeElement) === true };
      }, label);
      assert.deepEqual(state, { modal, contained: true });
    };
    const scan = async name => {
      await page.evaluate(source => { (0, eval)(source); }, axeSource);
      const result = await page.evaluate(async () => window.axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
      }));
      writeFileSync(join(directory, `${name}.axe.json`), redactFirefoxEvidence({ url: page.url(), violations: result.violations, incomplete: result.incomplete }) + "\n");
      report.scans.push({ name, url: page.url(), violations: result.violations.length, incomplete: result.incomplete.length });
      save();
      assert.equal(result.violations.length, 0, `${name}: ${result.violations.map(rule => rule.id).join(",")}`);
      assert.equal(result.incomplete.filter(rule => rule.id === "aria-prohibited-attr").length, 0, `${name}: unnamed role exposure`);
    };
    const record = name => { report.checks.push({ name, passed: true }); save(); process.stdout.write(`${name}: PASS\n`); };
    const appearance = async theme => {
      await press("Site menu");
      await page.waitForSelector('dialog[aria-label="Site navigation"][open]');
      await page.select('select[aria-label="Appearance"]', theme);
      await click("Close menu");
      await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, {}, theme);
    };
    for (const theme of ["light", "dark"]) {
      await resetPage();
      await go("/");
      await appearance(theme);
      await scan(`${theme}-home`);
      await go("/exercises?jointAction=shoulder-abduction&equipment=cable");
      await page.waitForSelector('input[name="jointAction"][value="shoulder-abduction"]:checked');
      await page.waitForSelector('input[name="equipment"][value="cable"]:checked');
      await scan(`${theme}-combined-catalog`);
      const link = await page.waitForSelector('main a[href^="/exercises/"]');
      await link.click();
      await page.waitForFunction(() => /^\/exercises\/[^/?]+$/.test(location.pathname));
      await page.waitForSelector("main h1");
      await scan(`${theme}-exercise-detail`);
      record(`${theme}-shoulder-abduction-cable-detail`);
      await press("Site menu");
      await page.waitForSelector('dialog[aria-label="Site navigation"][open]');
      for (const key of ["Tab", "Shift+Tab"]) for (let index = 0; index < 12; index++) {
        await tab(key === "Shift+Tab");
        await assertFocus("Site navigation");
      }
      await scan(`${theme}-navigation-dialog`);
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.querySelector('dialog[aria-label="Site navigation"][open]')
        && document.activeElement?.getAttribute("aria-label") === "Site menu");
      record(`${theme}-navigation-keyboard-focus-escape`);
    }
    account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (account.error) throw new Error("Local Firefox fixture account could not be created");
    const signedIn = await owner.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw new Error("Local Firefox fixture could not authenticate");
    const scene = structuredClone(blankWorkshopScene);
    const weight = { ...createStudioObject("dumbbell", randomUUID(), 0), x: 1.4, y: 1.1, z: 0, attachment: "none" };
    scene.studio.objects = [weight];
    const draft = await owner.rpc("save_workshop_draft", { p_scene: scene, p_name: "Installed Firefox readiness fixture" });
    if (draft.error) throw new Error("Local Firefox workshop fixture could not be saved");
    report.fixture = { userId: account.data.user.id, draftId: draft.data };
    await resetPage();
    await go("/sign-in");
    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', password);
    await click("Sign in");
    await page.waitForFunction(() => location.pathname === "/dashboard");
    for (const theme of ["light", "dark"]) {
      await resetPage();
      await go("/dashboard");
      await appearance(theme);
      await go(`/my-exercises/${draft.data}/workshop`);
      await page.waitForSelector('[data-anatomy-state="ready"]', { timeout: 60000 });
      if (await page.$('[data-workshop="studio"][data-tutorial-open="true"]')) await click("Close tutorial");
      if (await page.$('[aria-label="Recover draft"]')) {
        await click("Keep server version");
        await page.waitForFunction(() => !document.querySelector('[aria-label="Recover draft"]'));
      }
      await scan(`${theme}-quick-workshop`);
      const advanced = await press("Advanced editing");
      await page.waitForFunction(button => button.getAttribute("aria-pressed") === "true", {}, advanced);
      await click("Position", 'button[role="tab"]');
      await click("Front");
      await click("Camera");
      await click("Fit scene");
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const canvas = await page.waitForSelector("canvas");
      await canvas.scrollIntoView();
      const bounds = await canvas.boundingBox();
      assert.ok(bounds && bounds.width > 0 && bounds.height > 0, "Visible workshop canvas required");
      const fit = fitWorkshopCamera(scene, "front", bounds.width / bounds.height, 34);
      const camera = new PerspectiveCamera(34, bounds.width / bounds.height, .1, 100);
      camera.position.copy(fit.position);
      camera.lookAt(fit.target);
      camera.updateMatrixWorld();
      const point = new Vector3(weight.x, weight.y + .2, weight.z).project(camera);
      await page.mouse.click(bounds.x + (point.x + 1) * bounds.width / 2, bounds.y + (1 - point.y) * bounds.height / 2, { count: 2 });
      await page.waitForFunction(() => document.querySelector('[aria-label="Selected item"] h2')?.textContent === "Dumbbell");
      await scan(`${theme}-selected-equipment`);
      await click("Equipment", 'button[role="tab"]');
      await press("Anatomical figure");
      await page.waitForFunction(() => document.querySelector('select[aria-label="Selected equipment"] option:checked')?.textContent === "Anatomical figure");
      await press("Dumbbell");
      await page.waitForFunction(() => document.querySelector('select[aria-label="Selected equipment"] option:checked')?.textContent === "Dumbbell");
      record(`${theme}-canvas-and-keyboard-equipment-selection`);
      const trigger = await element("Add equipment");
      await trigger.focus();
      await page.keyboard.press("Enter");
      await page.waitForSelector('dialog[open] input[type="search"]');
      await page.waitForFunction(() => document.activeElement === document.querySelector('dialog[open] input[type="search"]'));
      await trigger.focus();
      await page.waitForFunction(() => document.activeElement === document.querySelector('dialog[open] input[type="search"]'));
      for (const key of ["Tab", "Shift+Tab"]) for (let index = 0; index < 20; index++) {
        await tab(key === "Shift+Tab");
        await assertFocus("Choose equipment");
      }
      await scan(`${theme}-equipment-dialog`);
      await (await page.$('dialog[open] input[type="search"]')).focus();
      await page.keyboard.type("dumbbell");
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.querySelector('dialog[open]')
        && document.activeElement?.textContent.trim() === "Add equipment");
      record(`${theme}-equipment-keyboard-focus-escape`);
      await page.screenshot({ path: join(directory, `${theme}-workshop.png`) });
      await go("/dashboard");
    }
    assert.deepEqual(pageErrors, [], "Firefox page errors");
    report.passed = true;
  } catch (error) {
    report.failure = JSON.parse(redactFirefoxEvidence(error.message.split(password).join("[redacted password]").split(email).join("[redacted fixture email]")));
    if (page) report.failureState = await page.evaluate(() => ({ path: location.pathname,
      focusedTag: document.activeElement?.tagName, focusedLabel: document.activeElement?.getAttribute("aria-label"),
      documentFocused: document.hasFocus(), openDialogs: document.querySelectorAll("dialog[open]").length,
      themeControlHydrated: document.querySelector('select[aria-label="Appearance"]')?.disabled === false })).catch(() => null);
    if (page) await page.screenshot({ path: join(directory, "failure.png") }).catch(() => {});
    throw new Error(report.failure);
  } finally {
    const cleanupFailures = [];
    try {
      await browser?.close();
      report.browserClosed = true;
    } catch {
      report.browserClosed = false;
      cleanupFailures.push("Browser shutdown failed");
    }
    if (account?.data.user) {
      try {
        await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password, owner });
        report.fixtureRemoved = true;
      } catch {
        report.fixtureRemoved = false;
        cleanupFailures.push("Fixture cleanup failed");
      }
    }
    try {
      removeFirefoxProfile(directory);
      report.profileRemoved = true;
    } catch {
      report.profileRemoved = false;
      cleanupFailures.push("Disposable profile cleanup failed");
    }
    if (cleanupFailures.length) {
      report.passed = false;
      report.cleanupFailures = cleanupFailures;
    }
    report.finishedAt = new Date().toISOString();
    save();
    process.stdout.write(`Installed Firefox results: ${join(directory, "results.json")}\n`);
    if (cleanupFailures.length) throw new Error("Firefox check cleanup failed; inspect results.json");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await checkFirefox(parseFirefoxOptions(process.argv.slice(2)));
}
