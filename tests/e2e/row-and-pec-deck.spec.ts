import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { machineDemoScene } from "../../src/lib/motion/studio-machines";
import { studioAssetNames } from "../../src/lib/motion/studio";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });
test("cable row and pec deck can be added, animated, saved and reloaded", async ({ page }) => {
  test.setTimeout(240_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `row-deck-${Date.now()}@example.test`, password = "EquipmentFixture2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  await owner.auth.signInWithPassword({ email, password });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    for (const slug of ["cable-row-machine", "pec-deck"] as const) {
      const scene = machineDemoScene(slug, randomUUID());
      const created = await owner.rpc("create_workshop_exercise", { p_scene: scene });
      if (created.error) throw created.error;
      await page.goto(`/my-exercises/${created.data}/workshop`);
      await page.getByRole("button", { name: "Advanced editing", exact: true }).click();
      await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60000 });
      await expect(page.locator("[data-highlight-count]")).not.toHaveAttribute("data-highlight-count", "0");
      await page.getByRole("button", { name: "Add equipment", exact: true }).click();
      await expect(page.getByRole("dialog").getByRole("button", { name: "Cable row", exact: true })).toBeVisible();
      await expect(page.getByRole("dialog").getByRole("button", { name: "Pec deck", exact: true })).toBeVisible();
      await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
      await page.getByLabel("Scene objects").getByRole("button", { name: studioAssetNames[slug], exact: true }).click();
      await expect(page.getByRole("button", { name: "Stop using machine", exact: true })).toHaveAttribute("aria-pressed", "true");
      await page.getByText("Advanced timeline", { exact: false }).click();
      const artifacts = `.local-artifacts/machines/review/${slug}`;
      mkdirSync(artifacts, { recursive: true });
      for (const view of ["Three-quarter", "Side"]) {
        await page.getByRole("button", { name: view, exact: true }).click();
        for (let step = 0; step <= 8; step++) {
          await page.getByLabel("Scrub timeline", { exact: true }).fill(String(step * 600));
          await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
          await page.locator("canvas").screenshot({ path: `${artifacts}/${view.toLowerCase()}-${step}.png` });
        }
      }
      await page.getByRole("button", { name: "Three-quarter", exact: true }).click();
      if (slug === "pec-deck") {
        await page.getByLabel("Pec deck mode", { exact: true }).selectOption("reverse");
        await expect(page.getByText("Arm opening", { exact: true })).toBeVisible();
      }
      await page.getByRole("button", { name: "Play", exact: true }).click();
      const first = await page.getByLabel("Scrub timeline", { exact: true }).inputValue();
      await expect.poll(() => page.getByLabel("Scrub timeline", { exact: true }).inputValue()).not.toBe(first);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page.getByRole("button", { name: /^Start ·/ }).click();
      const travelLabel = slug === "pec-deck" ? "Arm opening percent" : "Row pull percent";
      await page.getByLabel(travelLabel, { exact: true }).fill("42");
      await page.getByLabel(travelLabel, { exact: true }).press("Enter");
      await page.getByRole("button", { name: "Save scene", exact: true }).click();
      await expect(page.getByText(/Saved at.*Private/)).toBeVisible();
      await page.reload();
      await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible();
      await page.getByRole("button", { name: "Advanced editing", exact: true }).click();
      await page.getByLabel("Scene objects").getByRole("button", { name: studioAssetNames[slug], exact: true }).click();
      await expect(page.getByLabel(travelLabel, { exact: true })).toHaveValue("42");
      if (slug === "pec-deck") {
        await expect(page.getByLabel("Pec deck mode", { exact: true })).toHaveValue("reverse");
        const saved = await owner.from("private_exercises").select("content_id").eq("id", created.data).single();
        if (saved.error) throw saved.error;
        const stored = await owner.from("exercise_scenes").select("studio_layout").eq("content_id", saved.data.content_id).single();
        if (stored.error) throw stored.error;
        expect(stored.data.studio_layout).toMatchObject({ objects: [{ machineMode: "reverse", machineUse: true }], presentation: { highlight: "group:chest" } });
        await page.getByLabel("Pec deck mode", { exact: true }).selectOption("regular");
        await expect(page.getByText("Arm closure", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Save scene", exact: true }).click();
        await expect(page.getByText(/Saved at.*Private/)).toBeVisible();
        await page.reload();
        await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible();
        await page.getByRole("button", { name: "Advanced editing", exact: true }).click();
        await page.getByRole("button", { name: "Select machine", exact: true }).click();
        await expect(page.getByLabel("Pec deck mode", { exact: true })).toHaveValue("regular");
      }
      await page.getByRole("button", { name: "Stop using machine", exact: true }).click();
      await expect(page.getByRole("button", { name: "Use this machine", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Use this machine", exact: true }).click();
      await page.screenshot({ path: `${artifacts}/workshop.png`, fullPage: true });
      await page.setViewportSize({ width: 320, height: 800 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.setViewportSize({ width: 1600, height: 1100 });
    }
    expect(errors).toEqual([]);
  } finally { await admin.auth.admin.deleteUser(account.data.user.id); }
});
