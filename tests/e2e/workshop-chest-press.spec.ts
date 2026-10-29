import { randomUUID } from "node:crypto";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { addWorkshopEquipment, dismissWorkshopTutorial, openWorkshopRecovery, openWorkshopTool } from "./workshop-menu.helpers";

test.use({ viewport: { width: 1440, height: 1000 }, launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });

test("chest press exposes three grips and plays a complete converging repetition", async ({ page }) => {
  test.setTimeout(240_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("Local fixture required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `chest-press-${randomUUID()}@example.test`, password = "ChestPressFixture2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const signedIn = await owner.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  const directory = ".local-artifacts/chest-press/browser";
  mkdirSync(directory, { recursive: true });
  const errors: string[] = [];
  page.setDefaultTimeout(30_000);
  const checkpoint = (message: string) => appendFileSync(`${directory}/progress.log`, `${new Date().toISOString()} ${message}\n`);
  try {
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/my-exercises/new");
    checkpoint("Opened editor");
    await dismissWorkshopTutorial(page);
    await addWorkshopEquipment(page, "Converging chest press");
    checkpoint("Added machine");
    await openWorkshopTool(page, "Contacts");
    await expect(page.getByRole("button", { name: "Stop using machine", exact: true })).toBeVisible();
    checkpoint("Seated figure");
    await openWorkshopRecovery(page);
    checkpoint("Opened recovery");
    await page.getByRole("button", { name: "Reset to example", exact: true }).click();
    checkpoint("Loaded repetition");
    await openWorkshopTool(page, "Contacts");
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    const preview = page.getByRole("group", { name: "3D exercise preview", exact: true });
    const slider = page.getByRole("slider", { name: "Preview time", exact: true });
    const duration = Number(await slider.getAttribute("max"));
    await page.getByRole("button", { name: "Fit scene", exact: true }).click();
    for (const grip of ["wide", "angled", "neutral"]) {
      await page.getByRole("combobox", { name: "Press grip", exact: true }).selectOption(grip);
      checkpoint(`Grip ${grip}`);
      await slider.press("Home");
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await expect.poll(async () => Number(await slider.inputValue()), { timeout: 20_000 }).toBeGreaterThan(duration * .8);
      await expect.poll(async () => Number(await slider.inputValue()), { timeout: 20_000 }).toBeLessThan(duration * .25);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      for (const view of ["Three-quarter", "Side"]) {
        await page.getByRole("button", { name: view, exact: true }).click();
        for (let sample = 0; sample <= 8; sample++) {
          const box = (await slider.boundingBox())!;
          await page.mouse.click(box.x + 8 + (box.width - 16) * sample / 8, box.y + box.height / 2);
          await preview.screenshot({ path: `${directory}/${grip}-${view}-${sample}.png` });
        }
      }
    }
    await page.getByRole("combobox", { name: "Press grip", exact: true }).selectOption("wide");
    await page.getByRole("button", { name: "Three-quarter", exact: true }).click();
    await page.getByLabel("Preview speed", { exact: true }).selectOption("0.25");
    await slider.press("Home");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => Number(await slider.inputValue()), { timeout: 20_000 }).toBeGreaterThan(duration * .5);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByLabel("Exercise name", { exact: true }).fill("Converging chest press QA");
    await page.getByRole("button", { name: "Save exercise", exact: true }).click();
    await expect(page.getByText(/Saved at.*Private/)).toBeVisible({ timeout: 30_000 });
    const drafts = await owner.from("private_exercises").select("id").eq("owner_id", account.data.user.id);
    if (drafts.error) throw drafts.error;
    expect(drafts.data).toHaveLength(1);
    await page.goto(`/my-exercises/${drafts.data![0].id}/workshop`);
    await dismissWorkshopTutorial(page);
    await openWorkshopTool(page, "Contacts");
    await page.getByRole("combobox", { name: "Selected item", exact: true }).selectOption({ label: "Converging chest press" });
    await expect(page.getByRole("combobox", { name: "Press grip", exact: true })).toHaveValue("wide");
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => Number(await page.getByRole("slider", { name: "Preview time", exact: true }).inputValue()), { timeout: 20_000 }).toBeGreaterThan(duration * .8);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    expect(errors).toEqual([]);
    writeFileSync(`${directory}/checks.json`, JSON.stringify({ grips: ["wide", "angled", "neutral"], views: ["Three-quarter", "Side"], samples: 9, savedReloaded: true, slowPlayback: true, errors }, null, 2));
  } finally {
    await page.screenshot({ path: `${directory}/last-state.png` });
    writeFileSync(`${directory}/last-state.txt`, await page.locator("body").ariaSnapshot());
    await page.close();
    await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password, owner });
  }
});
