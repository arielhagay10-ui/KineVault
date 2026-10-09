import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { inspectMachineMoment, setWorkshopMode, setWorkshopLanguage, selectWorkshopObject, openWorkshopRecovery } from "./workshop-menu.helpers";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { createQuickScene } from "../../src/lib/motion/quick-create";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });
test.beforeEach(async ({ page }) => page.setDefaultTimeout(60_000));

test("workshop shortcuts edit scenes, respect controls and save pending field edits", async ({ page }) => {
  test.setTimeout(120_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `shortcuts-${randomUUID()}@example.test`, password = "WorkshopKeyboard2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;

  try {
    const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await owner.auth.signInWithPassword({ email, password });
    const created = await owner.rpc("save_workshop_draft", { p_scene: createQuickScene("cable-row-machine"), p_name: "Keyboard fixture" });
    if (created.error) throw created.error;
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/my-exercises/${created.data}/workshop`);
    const workshop = page.locator('[data-workshop="studio"]');
    await inspectMachineMoment(page, "Cable row", "Finish");
    const finish = page.getByLabel("Row pull percent", { exact: true });
    await finish.fill("65"); await finish.press("Enter");
    await page.locator("canvas").click({ position: { x: 20, y: 200 } });
    await page.keyboard.press("Control+z");
    await expect(finish).toHaveValue("100");
    await page.keyboard.press("Control+Shift+z"); await expect(finish).toHaveValue("65");
    await page.keyboard.press("Control+z"); await page.keyboard.press("Control+y");
    await expect(finish).toHaveValue("65");
    // A new edit replaces the redo branch.
    await page.keyboard.press("Control+z");
    await finish.fill("72"); await finish.press("Enter"); await workshop.focus();
    await expect(page.getByRole("button", { name: "Redo", exact: true }).filter({ visible: true }).first()).toBeDisabled();
    await page.keyboard.press("Control+y"); await expect(finish).toHaveValue("72");
    // Space activates a focused button once, and toggles playback from the viewport.
    await page.getByRole("region", { name: "Playback controls" }).getByRole("button", { name: "View start", exact: true }).click();
    await page.getByRole("button", { name: "Play", exact: true }).focus();
    await page.keyboard.press("Space"); await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await workshop.focus(); await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
    await page.keyboard.press("]"); await expect(page.getByLabel("Preview time", { exact: true })).toHaveValue("1600");
    await page.keyboard.press("["); await expect(page.getByLabel("Preview time", { exact: true })).toHaveValue("0");
    await page.keyboard.press("e");
    await expect(page.getByRole("button", { name: "Move with mouse", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("c");
    await expect(page.getByRole("button", { name: "Move with mouse", exact: true })).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("Shift+?");
    await expect(page.getByRole("region", { name: "Keyboard shortcuts", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("region", { name: "Keyboard shortcuts", exact: true })).not.toBeVisible();
    await setWorkshopMode(page, "advanced");
    const name = page.getByLabel("Exercise name", { exact: true });
    await name.focus(); await page.keyboard.press("End"); await page.keyboard.insertText(" revised");
    await page.keyboard.press("Control+z");
    await expect(name).toHaveValue("Keyboard fixture");
    await inspectMachineMoment(page, "Cable row", "Finish");
    await expect(finish).toHaveValue("72");
    await setWorkshopMode(page, "advanced");
    await name.fill("Keyboard fixture saved");
    // Save commits a numeric field's blur first and persists that committed scene.
    await selectWorkshopObject(page, "Cable row");
    await page.getByRole("tab", { name: "Timeline", exact: true }).click();
    const travel = page.getByLabel("Row pull percent", { exact: true });
    const committed = page.waitForResponse(response => {
      const request = response.request();
      const body = request.postData() ?? "";
      return request.method() === "POST" && !!request.headers()["next-action"]
        && body.includes("Keyboard fixture saved") && body.includes('"machinePosition":0.31') && response.ok();
    });
    await travel.fill("31"); await travel.press("Control+s");
    await committed;
    await expect(page.getByText(/Saved at.*Private/)).toBeVisible({ timeout: 20_000 });
    await page.reload(); await setWorkshopMode(page, "advanced");
    await expect(name).toHaveValue("Keyboard fixture saved");
    await inspectMachineMoment(page, "Cable row", "Finish");
    await expect(travel).toHaveValue("31");
    await page.getByRole("tab", { name: "Equipment", exact: true }).click();
    await workshop.focus(); await page.keyboard.press("Control+d");
    await expect(page.getByLabel("Scene objects").getByRole("button", { name: "Cable row copy", exact: true })).toBeVisible();
    await page.keyboard.press("Control+z");
    await expect(page.getByLabel("Scene objects").getByRole("button", { name: "Cable row copy", exact: true })).toHaveCount(0);
    await page.keyboard.press("Control+Shift+z");
    await expect(page.getByLabel("Scene objects").getByRole("button", { name: "Cable row copy", exact: true })).toBeVisible();
    await selectWorkshopObject(page, "Cable row copy");
    await page.getByRole("tab", { name: "Equipment", exact: true }).click();
    await workshop.focus(); await page.keyboard.press("Delete");
    await expect(page.getByLabel("Scene objects").getByRole("button", { name: "Cable row copy", exact: true })).toHaveCount(0);
    await page.keyboard.press("Control+z");
    await expect(page.getByLabel("Scene objects").getByRole("button", { name: "Cable row copy", exact: true })).toBeVisible();
    // Modal search keeps its keys; no scene commands leak through the picker.
    await page.getByRole("button", { name: "Add equipment", exact: true }).filter({ visible: true }).click();
    await page.getByRole("dialog").getByRole("searchbox").press("Control+z");
    await page.getByRole("dialog").getByRole("searchbox").press("Escape");
    await expect(page.getByLabel("Scene objects").getByRole("button", { name: "Cable row copy", exact: true })).toBeVisible();
    await openWorkshopRecovery(page);
    await expect(page.getByRole("region", { name: "Keyboard shortcuts", exact: true })).toBeVisible();
    mkdirSync(".local-artifacts/workshop/shortcuts", { recursive: true });
    await page.screenshot({ path: ".local-artifacts/workshop/shortcuts/desktop.png", fullPage: true });
    await setWorkshopLanguage(page, "he");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: ".local-artifacts/workshop/shortcuts/mobile-hebrew.png", fullPage: true });
    expect(errors).toEqual([]);
  } finally { await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password }); }
});
