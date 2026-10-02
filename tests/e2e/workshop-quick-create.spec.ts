import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import type { Database } from "../../src/lib/database.types";
import { machineDemoScene } from "../../src/lib/motion/studio-machines";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });
test("guided private creation, recovery, picker, RTL and mobile controls", async ({ page, context }) => {
  test.setTimeout(240_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixture required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `quick-workshop-${Date.now()}@example.test`, password = "PrivateWorkshop2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  const owner = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  await owner.auth.signInWithPassword({ email, password });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  mkdirSync(".local-artifacts/workshop/simplification/browser", { recursive: true });
  try {
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/my-exercises/new");
    await expect(page.getByRole("button", { name: "Quick create", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: /Cable row.*Pull to the torso/ }).click();
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60000 });
    await expect(page.locator('[data-highlight-count]')).toHaveAttribute("data-highlight-count", "0");
    await expect(page.getByLabel("Start Row pull percent", { exact: true })).toHaveValue("0");
    await page.getByLabel("Finish Row pull percent", { exact: true }).fill("");
    await page.getByRole("heading", { name: "Handle near torso", exact: true }).click();
    await expect(page.getByText("Enter a number from 0 to 100.", { exact: true })).toBeVisible();
    await page.getByLabel("Finish Row pull percent", { exact: true }).fill("65");
    await page.getByLabel("Finish Row pull percent", { exact: true }).press("Enter");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByLabel("Preview speed", { exact: true }).selectOption("0.25");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByLabel("Exercise name", { exact: true }).fill("Guided recovery row");
    await expect(page.getByText(/Saved at.*Private/)).toBeVisible({ timeout: 20000 });
    const library = await owner.from("private_exercises").select("id,content_id,exercise_content(name)");
    const draft = library.data?.find(item => item.exercise_content?.name === "Guided recovery row");
    expect(draft).toBeTruthy();
    const saved = await owner.from("exercise_scenes").select("studio_layout,duration_ms").eq("content_id", draft!.content_id).single();
    expect(saved.data?.duration_ms).toBe(3200);
    expect((saved.data?.studio_layout as { objects: { frames: { machinePosition: number }[] }[] }).objects[0].frames.some(frame => frame.machinePosition === .65)).toBe(true);
    await page.screenshot({ path: ".local-artifacts/workshop/simplification/browser/desktop-saved.png", fullPage: true });
    await page.getByRole("button", { name: "Start and finish", exact: true }).click();
    await context.setOffline(true);
    await page.getByLabel("Finish Row pull percent", { exact: true }).fill("70");
    await page.getByLabel("Finish Row pull percent", { exact: true }).press("Enter");
    await expect(page.getByText(/Offline.*draft kept/)).toBeVisible();
    await context.setOffline(false);
    // Failed saves keep the local recovery snapshot; reloading offers it rather than overwriting silently.
    await page.goto(`/my-exercises/${draft!.id}/workshop`);
    await expect(page.getByRole("button", { name: "Restore recovered draft", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Restore recovered draft", exact: true }).click();
    await page.getByRole("button", { name: "Start and finish", exact: true }).click();
    await expect(page.getByLabel("Finish Row pull percent", { exact: true })).toHaveValue("70");
    await expect(page.getByText(/Saved at.*Private/)).toBeVisible({ timeout: 20000 });
    const sameLibrary = await owner.from("private_exercises").select("id");
    expect(sameLibrary.data).toHaveLength(1);
    // Returning to the server baseline must discard the older local recovery.
    await context.setOffline(true);
    await page.getByLabel("Finish Row pull percent", { exact: true }).fill("75");
    await page.getByLabel("Finish Row pull percent", { exact: true }).press("Enter");
    await page.getByText("Recovery and shortcuts", { exact: true }).click();
    await page.getByRole("button", { name: "Restore last saved", exact: true }).click();
    await expect(page.getByLabel("Finish Row pull percent", { exact: true })).toHaveValue("70");
    await context.setOffline(false);
    await page.reload();
    await expect(page.getByRole("button", { name: "Restore recovered draft", exact: true })).not.toBeVisible();
    await page.getByRole("button", { name: "Choose equipment", exact: true }).click();
    const opener = page.getByRole("button", { name: "Add equipment", exact: true }).filter({ visible: true });
    await opener.click();
    await page.getByRole("dialog").getByRole("searchbox").fill("buterfly");
    await expect(page.getByRole("dialog").getByRole("button", { name: /Pec deck/ }).filter({ hasNotText: "Favorite" }).first()).toBeVisible();
    await page.getByRole("dialog").getByRole("searchbox").press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(opener).toBeFocused();
    await page.getByLabel("Workshop language", { exact: true }).selectOption("he");
    await expect(page.locator('[data-workshop="studio"]')).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("button", { name: "הבא", exact: true })).toBeVisible();
    await page.setViewportSize({ width: 320, height: 780 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: ".local-artifacts/workshop/simplification/browser/mobile-rtl.png", fullPage: true });
    await page.locator('select').filter({ has: page.locator('option[value="en"]') }).selectOption("en");
    await page.getByRole("button", { name: "Collapse preview", exact: true }).click();
    await expect(page.getByRole("button", { name: "Show preview", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await context.setOffline(false);
    await admin.auth.admin.deleteUser(account.data.user.id);
  }
});

test("finish inspection keeps the editing pose and animated placement locked", async ({ page }) => {
  test.setTimeout(120_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixture required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `endpoints-workshop-${Date.now()}@example.test`, password = "PrivateWorkshop2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  const owner = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  await owner.auth.signInWithPassword({ email, password });
  try {
    const scene = machineDemoScene("cable-row-machine", randomUUID());
    scene.keyframes = [scene.keyframes[0], scene.keyframes.at(-1)!];
    const created = await owner.rpc("create_workshop_exercise", { p_scene: scene });
    expect(created.error).toBeNull();
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/my-exercises/${created.data}/workshop`);
    await page.getByRole("button", { name: "Check both hands at finish", exact: true }).press("Enter");
    await expect(page.getByLabel("Preview time", { exact: true })).toHaveValue(String(scene.durationMs / 2));
    await expect(page.getByText(/Editing pose 1.*0\.00s/)).toBeVisible();
    await page.getByRole("button", { name: "Advanced editing", exact: true }).press("Enter");
    await page.getByLabel("Scene objects", { exact: true }).getByRole("button", { name: "Cable row", exact: true }).press("Enter");
    await expect(page.getByLabel("Position X meters", { exact: true })).toBeDisabled();
    await expect(page.getByLabel("Row pull percent", { exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Stop animation and edit placement", exact: true }).press("Enter");
    await expect(page.getByLabel("Position X meters", { exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Animate selected item", exact: true }).press("Enter");
    await expect(page.getByLabel("Position X meters", { exact: true })).toBeDisabled();
    await expect(page.getByText("Advanced timeline", { exact: false })).toBeVisible();
  } finally { await admin.auth.admin.deleteUser(account.data.user.id); }
});

test("a committed first save survives a lost response and reload without duplicating", async ({ page }) => {
  test.setTimeout(120_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixture required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `uncertain-workshop-${Date.now()}@example.test`, password = "PrivateWorkshop2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  const owner = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  await owner.auth.signInWithPassword({ email, password });
  try {
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/my-exercises/new");
    await page.getByRole("button", { name: /Pec deck.*Close both arms in front/ }).press("Enter");
    await page.getByRole("button", { name: "Name and save", exact: true }).press("Enter");
    let lost = false;
    await page.route("**/my-exercises/new", async route => {
      if (!lost && route.request().method() === "POST" && route.request().headers()["next-action"]) {
        lost = true;
        const response = await route.fetch();
        expect(response.ok()).toBe(true);
        await route.abort("failed");
      } else await route.continue();
    });
    await page.getByLabel("Exercise name", { exact: true }).fill("Lost response pec deck");
    await expect.poll(() => lost).toBe(true);
    await expect(page.getByText(/Could not save.*draft retained/)).toBeVisible();
    const first = await owner.from("private_exercises").select("id");
    expect(first.error).toBeNull();
    expect(first.data).toHaveLength(1);
    await page.unroute("**/my-exercises/new");
    await page.reload();
    await page.getByRole("button", { name: "Restore recovered draft", exact: true }).press("Enter");
    await expect(page.getByText(/Saved at.*Private/)).toBeVisible({ timeout: 20000 });
    const after = await owner.from("private_exercises").select("id");
    expect(after.data).toEqual(first.data);
    await page.getByRole("button", { name: "Name and save", exact: true }).press("Enter");
    await expect(page.getByRole("article", { name: "Saved private exercise", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Add optional details", exact: true }).press("Enter");
    await expect(page).toHaveURL(new RegExp(`/my-exercises/${first.data![0].id}/edit\\?sceneSaved=1$`));
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Lost response pec deck");
  } finally {
    await page.unroute("**/my-exercises/new");
    await admin.auth.admin.deleteUser(account.data.user.id);
  }
});

test.describe("touch and enlarged text", () => {
  test.use({ hasTouch: true, viewport: { width: 320, height: 780 }, reducedMotion: "reduce" });
  test("guided controls work by touch with RTL and text resizing", async ({ page }) => {
    test.setTimeout(120_000);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixture required");
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const email = `touch-workshop-${Date.now()}@example.test`, password = "PrivateWorkshop2026!";
    const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (account.error) throw account.error;
    try {
      await page.goto("/sign-in");
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Sign in", exact: true }).tap();
      await expect(page).toHaveURL(/\/dashboard$/);
      await page.goto("/my-exercises/new");
      await page.getByRole("button", { name: /Reverse pec deck.*Open both arms/ }).tap();
      await expect(page.getByRole("button", { name: "Palms outward", exact: true })).toHaveAttribute("aria-pressed", "true");
      await page.getByRole("button", { name: "Check both hands at finish", exact: true }).tap();
      await expect(page.getByLabel("Preview time", { exact: true })).toHaveValue("1600");
      await page.getByRole("button", { name: "Next", exact: true }).tap();
      await page.getByRole("button", { name: "Next", exact: true }).tap();
      await page.getByLabel("Exercise name", { exact: true }).fill("Touch reverse pec deck");
      await expect(page.getByText(/Saved at.*Private/)).toBeVisible({ timeout: 20000 });
      await page.getByRole("button", { name: "Start and finish", exact: true }).tap();
      await page.getByLabel("Workshop language", { exact: true }).selectOption("he");
      await expect(page.getByRole("button", { name: "כפות ידיים החוצה", exact: true })).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: ".local-artifacts/workshop/simplification/browser/touch-rtl.png", fullPage: true });
      await page.setViewportSize({ width: 640, height: 900 });
      await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: ".local-artifacts/workshop/simplification/browser/text-200-percent.png", fullPage: true });
      await page.getByRole("button", { name: "הבא", exact: true }).tap();
      await expect(page.getByRole("button", { name: "הבא", exact: true })).toBeVisible();
    } finally { await admin.auth.admin.deleteUser(account.data.user.id); }
  });
});

test("a late save response cannot erase a newer resumed draft", async ({ page, context }) => {
  test.setTimeout(120_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixture required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `late-workshop-${Date.now()}@example.test`, password = "PrivateWorkshop2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  const owner = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  await owner.auth.signInWithPassword({ email, password });
  let release: (() => void) | undefined;
  try {
    const created = await owner.rpc("create_workshop_exercise", { p_scene: machineDemoScene("cable-row-machine", randomUUID()) });
    expect(created.error).toBeNull();
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    const routeUrl = `**/my-exercises/${created.data}/workshop`;
    await page.goto(`/my-exercises/${created.data}/workshop`);
    await page.route(routeUrl, async route => {
      if (!release && route.request().method() === "POST" && route.request().headers()["next-action"]) {
        const response = await route.fetch();
        await new Promise<void>(resolve => { release = resolve; });
        await route.fulfill({ response }).catch(() => {});
      } else await route.continue();
    });
    await page.getByLabel("Finish Row pull percent", { exact: true }).fill("65");
    await page.getByLabel("Finish Row pull percent", { exact: true }).press("Enter");
    await expect.poll(() => !!release).toBe(true);
    // Client navigation keeps the old component's pending completion in this document.
    await page.getByRole("link", { name: "← Exercise details", exact: true }).click();
    await expect(page).toHaveURL(/\/edit$/);
    await page.getByRole("link", { name: "Open motion workshop →", exact: true }).click();
    await expect(page).toHaveURL(/\/workshop$/);
    if (await page.getByRole("button", { name: "Keep server version", exact: true }).isVisible()) {
      await page.getByRole("button", { name: "Keep server version", exact: true }).click();
    }
    await context.setOffline(true);
    await page.getByLabel("Finish Row pull percent", { exact: true }).fill("70");
    await page.getByLabel("Finish Row pull percent", { exact: true }).press("Enter");
    const key = `kinevault.workshop.draft.${account.data.user.id}.${created.data}`;
    await expect.poll(() => page.evaluate(key => localStorage.getItem(key), key)).toContain('"machinePosition":0.7');
    release!();
    await page.waitForTimeout(500);
    await context.setOffline(false);
    // Next may refresh its invalidated route when the delayed response arrives;
    // reconnect before reading storage from an actual application document.
    await page.goto(`/my-exercises/${created.data}/workshop`);
    expect(await page.evaluate(key => localStorage.getItem(key), key)).toContain('"machinePosition":0.7');
    await page.getByRole("button", { name: "Restore recovered draft", exact: true }).click();
    await expect(page.getByLabel("Finish Row pull percent", { exact: true })).toHaveValue("70");
  } finally {
    release?.();
    await context.setOffline(false);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await admin.auth.admin.deleteUser(account.data.user.id);
  }
});

test("expired sign-in provides a repair and preserves the latest unsaved name", async ({ page, context }) => {
  test.setTimeout(120_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixture required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `session-workshop-${Date.now()}@example.test`, password = "PrivateWorkshop2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  const owner = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  await owner.auth.signInWithPassword({ email, password });
  try {
    const created = await owner.rpc("create_workshop_exercise", { p_scene: machineDemoScene("pec-deck", randomUUID()) });
    expect(created.error).toBeNull();
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/my-exercises/${created.data}/workshop`);
    await page.getByRole("button", { name: "Name and save", exact: true }).click();
    await context.clearCookies();
    await page.getByLabel("Exercise name", { exact: true }).fill("Recovered after sign-in");
    await expect(page.getByRole("article", { name: "Saved private exercise", exact: true })).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in again", exact: true })).toBeVisible({ timeout: 20000 });
    await page.getByRole("link", { name: "Sign in again", exact: true }).click();
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/workshop$/);
    await page.getByRole("button", { name: "Restore recovered draft", exact: true }).click();
    await page.getByRole("button", { name: "Name and save", exact: true }).click();
    await expect(page.getByLabel("Exercise name", { exact: true })).toHaveValue("Recovered after sign-in");
    await expect(page.getByText(/Saved at.*Private/)).toBeVisible({ timeout: 20000 });
  } finally { await admin.auth.admin.deleteUser(account.data.user.id); }
});

test("opposite-side and zoom inspection survive playback rerenders", async ({ page }) => {
  test.setTimeout(120_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixture required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `camera-workshop-${Date.now()}@example.test`, password = "PrivateWorkshop2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  const owner = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  await owner.auth.signInWithPassword({ email, password });
  const difference = async (a: Buffer, b: Buffer) => {
    const left = await sharp(a).ensureAlpha().raw().toBuffer();
    const right = await sharp(b).ensureAlpha().raw().toBuffer();
    expect(right.length).toBe(left.length);
    let sum = 0;
    for (let i = 0; i < left.length; i++) sum += Math.abs(left[i] - right[i]);
    return sum / left.length;
  };
  try {
    const created = await owner.rpc("create_workshop_exercise", { p_scene: machineDemoScene("cable-row-machine", randomUUID()) });
    expect(created.error).toBeNull();
    await page.setViewportSize({ width: 1500, height: 1000 });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/my-exercises/${created.data}/workshop`);
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60000 });
    await page.getByRole("button", { name: "Fit scene", exact: true }).click();
    const original = await page.locator("canvas").screenshot();
    await page.getByRole("button", { name: "Opposite side", exact: true }).click();
    const opposite = await page.locator("canvas").screenshot();
    expect(await difference(original, opposite)).toBeGreaterThan(1);
    for (const action of [null, "Zoom in"] as const) {
      if (action) await page.getByRole("button", { name: action, exact: true }).click();
      const before = await page.locator("canvas").screenshot();
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await page.waitForTimeout(800);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page.getByRole("region", { name: "Playback controls" }).getByRole("button", { name: "View start", exact: true }).click();
      const after = await page.locator("canvas").screenshot();
      // Compare rendered pixels at the same pose; a camera reset changes the full view.
      expect(await difference(before, after)).toBeLessThan(.3);
    }
    await page.screenshot({ path: ".local-artifacts/workshop/simplification/browser/camera-persistence.png", fullPage: true });
  } finally { await admin.auth.admin.deleteUser(account.data.user.id); }
});
