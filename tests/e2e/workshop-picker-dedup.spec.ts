import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { equipmentPreferencesKey } from "../../src/lib/motion/quick-create";
import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { dismissWorkshopTutorial } from "./workshop-menu.helpers";

test("picker prioritizes sections without duplicate cards, including search", async ({ page }) => {
  test.setTimeout(90_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `picker-${randomUUID()}@example.test`, password = `Picker-${randomUUID()}!`;
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  try {
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.evaluate(key => localStorage.setItem(key, JSON.stringify({
      recent: ["dumbbell", "pec-deck"], favorites: ["dumbbell", "pec-deck", "cable-row-machine"],
    })), equipmentPreferencesKey(account.data.user.id));
    await page.goto("/my-exercises/new");
    await dismissWorkshopTutorial(page);
    await page.getByRole("button", { name: "Add equipment", exact: true }).filter({ visible: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "View all equipment", exact: true }).click();
    const equipment = ["Dumbbell", "Pec deck", "Cable row"];
    for (const name of equipment) {
      await expect(dialog.getByRole("button", { name, exact: true })).toHaveCount(1);
      await expect(dialog.getByRole("button", { name: `Favorite ${name}`, exact: true })).toHaveCount(1);
    }
    await expect(dialog.getByRole("region", { name: "Essentials", exact: true }).getByRole("button", { name: "Dumbbell", exact: true })).toBeVisible();
    await expect(dialog.getByRole("region", { name: "Recent equipment", exact: true }).getByRole("button", { name: "Pec deck", exact: true })).toBeVisible();
    await expect(dialog.getByRole("region", { name: "Favorite equipment", exact: true }).getByRole("button", { name: "Cable row", exact: true })).toBeVisible();
    await dialog.getByRole("searchbox").fill("seated row");
    await expect(dialog.getByRole("button", { name: "Cable row", exact: true })).toHaveCount(1);
    await expect(dialog.getByRole("button", { name: "Pec deck", exact: true })).toHaveCount(0);
    await dialog.getByRole("searchbox").fill("pec dek");
    await expect(dialog.getByRole("button", { name: "Pec deck", exact: true })).toHaveCount(1);
    await dialog.getByRole("searchbox").fill("");
    for (const name of equipment) await expect(dialog.getByRole("button", { name, exact: true })).toHaveCount(1);
    await dialog.getByRole("button", { name: "Pec deck", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Selected item", exact: true }).locator("option:checked")).toHaveText("Pec deck");
  } finally {
    try { await page.close(); }
    finally { await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password }); }
  }
});
