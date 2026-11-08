import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { captureEvidence } from "../helpers/ci";
import { addWorkshopEquipment, dismissWorkshopTutorial, openWorkshopTool, selectWorkshopJoint, selectWorkshopObject, jointField } from "./workshop-menu.helpers";

test.use({ viewport: { width: 1440, height: 1000 }, launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });

test("standing calf raise picker, default repetition, driven legs and private save survive reload", async ({ page }) => {
  test.setTimeout(240_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname)) throw Error("Local fixtures only");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `calf-raise-${randomUUID()}@example.test`, password = `Calf-${randomUUID()}!`;
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const errors: string[] = [], evidence = ".local-artifacts/workshop/calf-raise";
  mkdirSync(evidence, { recursive: true });
  page.on("pageerror", error => errors.push(error.message));
  try {
    const login = await owner.auth.signInWithPassword({ email, password });
    if (login.error) throw login.error;
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/my-exercises/new");
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await dismissWorkshopTutorial(page);
    await addWorkshopEquipment(page, "Standing calf raise");
    await expect(page.locator('[data-equipment-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await page.getByText("More", { exact: true }).click();
    await page.getByText("Recovery and shortcuts", { exact: true }).click();
    await page.getByRole("button", { name: "Reset to example", exact: true }).click();
    await page.getByText("More", { exact: true }).click();
    await page.getByLabel("Exercise name", { exact: true }).fill("Standing calf raise");
    await page.getByRole("button", { name: "Save exercise", exact: true }).click();
    await expect(page).toHaveURL(/\/my-exercises\/[0-9a-f-]+\/workshop$/, { timeout: 60_000 });
    await expect(page.getByText(/Saved privately|Saved at.*Private/)).toBeVisible();
    // The machine drives the legs; ankles and knees stay locked to it.
    await openWorkshopTool(page, "Pose");
    await selectWorkshopJoint(page, "Left knee");
    await expect(jointField(page, "x")).toBeDisabled();
    await page.getByRole("button", { name: "Side", exact: true }).click();
    for (const [name, time] of [["stretch", 0], ["top", 1600]] as const) {
      await page.getByLabel("Preview time", { exact: true }).fill(String(time));
      await captureEvidence(page.locator("canvas"), `${evidence}/${name}.png`);
    }
    await page.reload();
    await expect(page.locator('[data-equipment-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByLabel("Exercise name", { exact: true })).toHaveValue("Standing calf raise");
    const id = page.url().split("/").at(-2)!;
    const draft = await owner.from("private_exercises").select("content_id").eq("id", id).single();
    if (draft.error) throw draft.error;
    const saved = await owner.from("exercise_scenes").select("studio_layout").eq("content_id", draft.data.content_id).single();
    if (saved.error) throw saved.error;
    expect(saved.data.studio_layout.objects).toHaveLength(1);
    expect(saved.data.studio_layout.objects[0]).toMatchObject({ slug: "calf-raise-machine", machineUse: true });
    expect(saved.data.studio_layout.objects[0].frames).toHaveLength(17);
    await selectWorkshopObject(page, "Standing calf raise");
    await openWorkshopTool(page, "Timeline");
    await expect(page.getByLabel("Heel raise percent", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally { await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password }); }
});
